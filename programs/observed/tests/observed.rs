//! Tests against docs/01-PROGRAM.md §5b/§6: every instruction has a happy path and at least
//! one rejection. Real mainnet SGT fixtures, real mainnet constants, controllable clock.
mod common;
use {
    common::*,
    observed::{RoundStatus, MISSING_SCORE_BPS},
    pyth_solana_receiver_sdk::price_update::VerificationLevel,
    solana_signer::Signer,
};

const SALT: [u8; 32] = [7u8; 32];
/// reference 150.00000000 with offset +1 % → threshold 151.50000000
const THRESHOLD: i64 = 15_150_000_000;

// ---------------------------------------------------------------- happy path

#[test]
fn full_round_yes_reveal_and_score() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();

    let c = commitment(&env, 0, 4_000, SALT);
    let cu_commit = sendx!(env, &player, [ix_commit(&env, 0, c)]).expect("commit");

    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let upd = reference_update(&mut env);
    let cu_ref = sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    let round = read_round(&env, 0);
    assert_eq!(round.status, RoundStatus::Referenced as u8);
    assert_eq!(
        round.threshold_mantissa, THRESHOLD,
        "threshold = ref × (1 + offset)"
    );

    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000); // 152.00 > 151.50 → Yes
    let cu_res = sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    assert_eq!(read_round(&env, 0).outcome, observed::Outcome::Yes as u8);

    let cu_rev = sendx!(env, &player, [ix_reveal(&env, 0, 4_000, SALT)]).expect("reveal");
    let round = read_round(&env, 0);
    assert_eq!(round.reveal_count, 1);
    assert_eq!(round.histogram[8], 1, "p=40% lands in bucket 8");

    let cu_score = sendx!(env, &payer, [ix_score(&env, 0)]).expect("score_entry");
    let entry = read_entry(&env, 0).expect("entry");
    // k=8, y=20 → 25·(8−20)² = 3600 → Brier 0.360
    assert_eq!(entry.score_bps, 3_600);
    assert!(entry.scored && !entry.scored_as_missing);
    let p = read_player(&env);
    assert_eq!(
        (
            p.commits,
            p.reveals,
            p.scored_rounds,
            p.score_sum,
            p.missing_scored
        ),
        (1, 1, 1, 3_600, 0)
    );

    println!("CU commit={cu_commit} set_reference={cu_ref} resolve={cu_res} reveal={cu_rev} score_entry={cu_score}");
}

#[test]
fn equality_resolves_no() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 5_000, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, THRESHOLD); // exactly the threshold
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    assert_eq!(
        read_round(&env, 0).outcome,
        observed::Outcome::No as u8,
        "equality is No"
    );
}

#[test]
fn exponent_mismatch_is_scaled_not_truncated() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    // same price as the threshold but with exponent −6: 151.500000 → must resolve No, not Yes
    let data = price_update(
        env.feed_id,
        151_500_000,
        1_000,
        -6,
        OUTCOME_TIME,
        OUTCOME_TIME - 1,
        VerificationLevel::Full,
    );
    let out = put_price_update(&mut env, data);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    assert_eq!(read_round(&env, 0).outcome, observed::Outcome::No as u8);
}

// ---------------------------------------------------------------- NO_RESOLVE

/// A round without valid evidence must leave every commit untouched: no score, no penalty.
#[test]
fn no_resolve_leaves_commits_unscored() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");

    // nobody posts a reference; the reveal window passes, then the deadline
    set_time(&mut env.svm, RESOLVE_DEADLINE + 1);
    let cu = sendx!(env, &payer, [ix_cancel(0)]).expect("cancel_round");
    assert_eq!(read_round(&env, 0).status, RoundStatus::Cancelled as u8);
    assert_eq!(read_round(&env, 0).outcome, observed::Outcome::Unset as u8);

    expect_err(sendx!(env, &payer, [ix_score(&env, 0)]), "RoundNotResolved");
    let p = read_player(&env);
    assert_eq!(
        (p.scored_rounds, p.score_sum, p.missing_scored),
        (0, 0, 0),
        "nobody is scored in NO_RESOLVE"
    );
    assert_eq!(
        (p.commits, p.reveals),
        (1, 0),
        "the commit stays visible as a fact"
    );

    // rent can still be reclaimed
    sendx!(env, &player, [ix_close_entry(&env, 0)]).expect("close_entry");
    assert!(read_entry(&env, 0).is_none());
    println!("CU cancel_round={cu}");
}

#[test]
fn cancel_before_deadline_fails_and_resolved_round_cannot_be_cancelled() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, RESOLVE_DEADLINE - 1);
    expect_err(sendx!(env, &payer, [ix_cancel(0)]), "TooEarly");

    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    set_time(&mut env.svm, RESOLVE_DEADLINE + 1);
    expect_err(sendx!(env, &payer, [ix_cancel(0)]), "AlreadyResolved");
}

// ---------------------------------------------------------------- reveal

#[test]
fn reveal_after_window_fails_and_counts_as_missing() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");

    set_time(&mut env.svm, REVEAL_CLOSE); // exactly at the close: already too late
    expect_err(
        sendx!(env, &player, [ix_reveal(&env, 0, 4_000, SALT)]),
        "OutsideRevealWindow",
    );

    let cu = sendx!(env, &payer, [ix_score(&env, 0)]).expect("score missing");
    let entry = read_entry(&env, 0).expect("entry");
    assert_eq!(entry.score_bps, MISSING_SCORE_BPS);
    assert!(entry.scored_as_missing);
    let p = read_player(&env);
    assert_eq!(
        (p.scored_rounds, p.score_sum, p.missing_scored, p.reveals),
        (1, 10_000, 1, 0)
    );
    println!("CU score_entry(missing)={cu}");
}

#[test]
fn reveal_before_outcome_time_fails() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, OUTCOME_TIME - 1);
    expect_err(
        sendx!(env, &player, [ix_reveal(&env, 0, 4_000, SALT)]),
        "OutsideRevealWindow",
    );
}

#[test]
fn reveal_with_wrong_salt_or_wrong_number_fails() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    expect_err(
        sendx!(env, &player, [ix_reveal(&env, 0, 4_000, [8u8; 32])]),
        "CommitmentMismatch",
    );
    expect_err(
        sendx!(env, &player, [ix_reveal(&env, 0, 4_500, SALT)]),
        "CommitmentMismatch",
    );
    expect_err(
        sendx!(env, &player, [ix_reveal(&env, 0, 4_100, SALT)]),
        "InvalidProbability",
    );
    sendx!(env, &player, [ix_reveal(&env, 0, 4_000, SALT)]).expect("correct reveal still works");
    expect_err(
        sendx!(env, &player, [ix_reveal(&env, 0, 4_000, SALT)]),
        "AlreadyRevealed",
    );
}

#[test]
fn reveal_by_someone_else_fails() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let mut ix = ix_reveal(&env, 0, 4_000, SALT);
    ix.accounts[0].pubkey = payer.pubkey(); // beneficiary slot
    expect_err(sendx!(env, &payer, [ix]), "WrongBeneficiary");
}

// ---------------------------------------------------------------- commit

#[test]
fn second_commit_for_same_round_fails() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("first");
    expect_err(
        sendx!(
            env,
            &player,
            [ix_commit(&env, 0, commitment(&env, 0, 6_000, SALT))]
        ),
        "already in use",
    );
    assert_eq!(read_round(&env, 0).commit_count, 1);
}

#[test]
fn commit_outside_window_or_paused_fails() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let authority = env.authority.insecure_clone();

    set_time(&mut env.svm, COMMIT_CLOSE); // window is [open, close)
    expect_err(
        sendx!(env, &player, [ix_commit(&env, 0, [1u8; 32])]),
        "OutsideCommitWindow",
    );

    set_time(&mut env.svm, DAY0 + 60);
    sendx!(env, &authority, [ix_pause(&env, true)]).expect("pause");
    expect_err(
        sendx!(env, &player, [ix_commit(&env, 0, [1u8; 32])]),
        "Paused",
    );
    sendx!(env, &authority, [ix_pause(&env, false)]).expect("unpause");
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit after unpause");
}

#[test]
fn pause_by_wrong_authority_fails() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    let mut ix = ix_pause(&env, true);
    ix.accounts[0].pubkey = payer.pubkey();
    expect_err(sendx!(env, &payer, [ix]), "WrongAuthority");
}

// ---------------------------------------------------------------- set_reference

#[test]
fn set_reference_twice_fails() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let a = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, a)]).expect("first");
    let b = reference_update(&mut env);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, b)]),
        "RoundNotOpen",
    );
}

#[test]
fn set_reference_rejects_early_late_and_bad_updates() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();

    // before commit close
    set_time(&mut env.svm, COMMIT_CLOSE - 1);
    let early = reference_update(&mut env);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, early)]),
        "TooEarly",
    );

    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    // not the first update after 12:00 (prev_publish_time >= t)
    let d = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        COMMIT_CLOSE + 10,
        COMMIT_CLOSE,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, d);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, k)]),
        "NotFirstAfter",
    );

    // more than 60 s late
    let d = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        COMMIT_CLOSE + 61,
        COMMIT_CLOSE - 1,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, d);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, k)]),
        "OutsideOracleWindow",
    );

    // confidence wider than 50 bps (0.6 % of price)
    let d = price_update(
        env.feed_id,
        15_000_000_000,
        90_000_000,
        -8,
        COMMIT_CLOSE,
        COMMIT_CLOSE - 1,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, d);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, k)]),
        "ConfidenceTooWide",
    );

    // partially verified
    let d = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        COMMIT_CLOSE,
        COMMIT_CLOSE - 1,
        VerificationLevel::Partial { num_signatures: 5 },
    );
    let k = put_price_update(&mut env, d);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, k)]),
        "NotFullyVerified",
    );

    // wrong feed
    let d = price_update(
        [9u8; 32],
        15_000_000_000,
        100_000,
        -8,
        COMMIT_CLOSE,
        COMMIT_CLOSE - 1,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, d);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, k)]),
        "WrongFeed",
    );

    // a valid one still works afterwards (a rejected update does not poison the round)
    let ok = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, ok)]).expect("valid reference");
}

#[test]
fn price_update_owned_by_someone_else_is_rejected() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let data = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        COMMIT_CLOSE,
        COMMIT_CLOSE - 1,
        VerificationLevel::Full,
    );
    let key = anchor_lang::prelude::Pubkey::new_unique();
    put(
        &mut env.svm,
        key,
        anchor_lang::prelude::Pubkey::new_unique(),
        10_000_000,
        data,
    );
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, key)]),
        "AccountOwnedByWrongProgram",
    );
}

// ---------------------------------------------------------------- resolve

#[test]
fn resolve_without_reference_fails() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    expect_err(
        sendx!(env, &payer, [ix_resolve(&env, 0, out)]),
        "NoReference",
    );
}

#[test]
fn resolve_twice_and_out_of_window_fails() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");

    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let late = price_update(
        env.feed_id,
        15_200_000_000,
        100_000,
        -8,
        OUTCOME_TIME + 61,
        OUTCOME_TIME - 1,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, late);
    expect_err(
        sendx!(env, &payer, [ix_resolve(&env, 0, k)]),
        "OutsideOracleWindow",
    );

    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    let again = outcome_update(&mut env, 15_900_000_000);
    expect_err(
        sendx!(env, &payer, [ix_resolve(&env, 0, again)]),
        "NoReference",
    );

    set_time(&mut env.svm, RESOLVE_DEADLINE + 1);
    let out2 = outcome_update(&mut env, 15_200_000_000);
    expect_err(
        sendx!(env, &payer, [ix_resolve(&env, 0, out2)]),
        "NoReference",
    );
}

// ---------------------------------------------------------------- score / close

#[test]
fn score_entry_is_idempotent_and_respects_the_window() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");

    // not revealed and window still open → must not be scored as missing yet
    expect_err(
        sendx!(env, &payer, [ix_score(&env, 0)]),
        "RevealWindowStillOpen",
    );
    // closing before scoring is impossible
    expect_err(sendx!(env, &player, [ix_close_entry(&env, 0)]), "TooEarly");

    sendx!(env, &player, [ix_reveal(&env, 0, 4_000, SALT)]).expect("reveal");
    sendx!(env, &payer, [ix_score(&env, 0)]).expect("score");
    expect_err(sendx!(env, &payer, [ix_score(&env, 0)]), "AlreadyScored");

    set_time(&mut env.svm, REVEAL_CLOSE + 1);
    let cu = sendx!(env, &player, [ix_close_entry(&env, 0)]).expect("close_entry");
    println!("CU close_entry={cu}");
}

#[test]
fn unscored_entry_cannot_be_closed_in_a_resolved_round() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    set_time(&mut env.svm, REVEAL_CLOSE + 1);
    // the missing penalty must not be escapable by closing the entry first
    expect_err(
        sendx!(env, &player, [ix_close_entry(&env, 0)]),
        "EntryNotClosable",
    );
    sendx!(env, &payer, [ix_score(&env, 0)]).expect("score missing");
    sendx!(env, &player, [ix_close_entry(&env, 0)]).expect("close after scoring");
}

// ---------------------------------------------------------------- calendar

#[test]
fn round_without_valid_proof_is_impossible() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    let payer_pk = payer.pubkey();
    let mut terms = env.terms;
    terms.offset_bps = 200; // not the calendar's rule
    let proof = env.proof.clone();
    expect_err(
        sendx!(
            env,
            &payer,
            [ix_create_round(&payer_pk, 1, terms, proof.clone())]
        ),
        "BadMerkleProof",
    );
    // right terms, wrong proof length
    expect_err(
        sendx!(
            env,
            &payer,
            [ix_create_round(
                &payer_pk,
                1,
                env.terms,
                proof[..5].to_vec()
            )]
        ),
        "BadProofLength",
    );
    // right terms, but a round id that is not next
    expect_err(
        sendx!(
            env,
            &payer,
            [ix_create_round(&payer_pk, 7, env.terms, proof)]
        ),
        "WrongRoundId",
    );
}

#[test]
fn calendar_bounds_and_second_publish_are_enforced() {
    let mut env = setup();
    let authority = env.authority.insecure_clone();
    let auth_pk = authority.pubkey();
    let (root, _) = calendar(&[1u8; 32], 0);
    expect_err(
        sendx!(env, &authority, [ix_publish_calendar(&auth_pk, root, 0)]),
        "SeasonNotFinished",
    );
    // season is running (round 0 exists, 63 leaves left) → no second calendar
    expect_err(
        sendx!(env, &authority, [ix_publish_calendar(&auth_pk, root, 64)]),
        "SeasonNotFinished",
    );
}

#[test]
fn create_round_rejects_bad_windows() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    let payer_pk = payer.pubkey();
    let mut terms = env.terms;
    terms.commit_close = terms.commit_open - 1;
    let th = terms.hash(SEASON, 1);
    let (_, proof) = calendar(&th, 1);
    expect_err(
        sendx!(env, &payer, [ix_create_round(&payer_pk, 1, terms, proof)]),
        "BadWindows",
    );
}

// ---------------------------------------------------------------- real mainnet evidence

/// The real, fully verified SOL/USD update from Spike 1 (mainnet bytes, posted on devnet):
/// publish_time 2026-09-17 00:00:00 UTC, prev 23:59:59, price 98.57775490, conf 0.01822971.
#[test]
fn real_mainnet_price_update_is_accepted() {
    const REAL_PUBLISH: i64 = 1_789_603_200;
    let mut env = setup_day(REAL_PUBLISH - 24 * 3600); // outcome_time == that update's publish_time
    let payer = env.payer.insecure_clone();

    set_time(&mut env.svm, REAL_PUBLISH - 12 * 3600 + 5);
    let data = price_update(
        env.feed_id,
        9_857_775_490,
        1_822_971,
        -8,
        REAL_PUBLISH - 12 * 3600,
        REAL_PUBLISH - 12 * 3600 - 1,
        VerificationLevel::Full,
    );
    let r = put_price_update(&mut env, data);
    sendx!(env, &payer, [ix_set_reference(&env, 0, r)]).expect("set_reference");

    set_time(&mut env.svm, REAL_PUBLISH + 5);
    let real = put_fixture_account(&mut env, "pyth/real-sol-outcome");
    sendx!(env, &payer, [ix_resolve(&env, 0, real)]).expect("resolve with the real update");
    let round = read_round(&env, 0);
    assert_eq!(
        round.evidence_price, 9_857_775_490,
        "price decoded from real bytes"
    );
    assert_eq!(round.evidence_publish_time, REAL_PUBLISH);
    assert_eq!(round.evidence_prev_publish_time, REAL_PUBLISH - 1);
    // 98.577… vs threshold 99.563… (98.577 × 1.01) → No
    assert_eq!(round.outcome, observed::Outcome::No as u8);
}

/// The real partially verified account from Spike 1 must be refused.
#[test]
fn real_partially_verified_update_is_refused() {
    const REAL_PUBLISH: i64 = 1_789_603_200;
    let mut env = setup_day(REAL_PUBLISH - 24 * 3600);
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, REAL_PUBLISH - 12 * 3600 + 5);
    let partial = put_fixture_account(&mut env, "pyth/real-sol-partial");
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, partial)]),
        "NotFullyVerified",
    );
}

// ---------------------------------------------------------------- calendar fixture

/// The generator (services/calendar/generate.mjs) and the program must agree byte for byte:
/// every terms_hash, every proof and the root are recomputed here with the program's own code.
#[test]
fn calendar_fixture_matches_program() {
    let path = format!(
        "{}/../../tests/fixtures/calendar/season1.json",
        env!("CARGO_MANIFEST_DIR")
    );
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let v: serde_json::Value = serde_json::from_str(&raw).expect("json");
    let season = v["season"].as_u64().expect("season") as u16;
    let root = hex_to_32(v["merkleRoot"].as_str().expect("root"));
    let rounds = v["rounds"].as_array().expect("rounds");
    assert_eq!(rounds.len(), 64, "season 1 has 64 leaves");

    for r in rounds {
        let round_id = r["roundId"].as_u64().expect("roundId") as u32;
        let terms = observed::RoundTerms {
            feed_id: hex_to_32(r["feedId"].as_str().expect("feedId")),
            offset_bps: r["offsetBps"].as_i64().expect("offsetBps") as i32,
            max_conf_bps: r["maxConfBps"].as_u64().expect("maxConfBps") as u16,
            commit_open: r["commitOpen"].as_i64().expect("commitOpen"),
            commit_close: r["commitClose"].as_i64().expect("commitClose"),
            outcome_time: r["outcomeTime"].as_i64().expect("outcomeTime"),
        };
        let hash = terms.hash(season, round_id);
        assert_eq!(
            hash,
            hex_to_32(r["termsHash"].as_str().expect("termsHash")),
            "terms_hash mismatch in round {round_id}"
        );
        let proof: Vec<[u8; 32]> = r["proof"]
            .as_array()
            .expect("proof")
            .iter()
            .map(|p| hex_to_32(p.as_str().expect("proof hex")))
            .collect();
        assert_eq!(proof.len(), 6, "depth 6");
        assert!(
            observed::verify_leaf(&hash, round_id, &proof, &root),
            "proof does not verify for round {round_id}"
        );
        // windows must satisfy what create_round enforces
        assert!(terms.commit_open < terms.commit_close && terms.commit_close < terms.outcome_time);
        assert_eq!(terms.max_conf_bps, 50);
    }

    // a tampered rule must not verify under the published root
    let mut tampered = observed::RoundTerms {
        feed_id: hex_to_32(rounds[0]["feedId"].as_str().expect("feedId")),
        offset_bps: 999,
        max_conf_bps: 50,
        commit_open: rounds[0]["commitOpen"].as_i64().expect("o"),
        commit_close: rounds[0]["commitClose"].as_i64().expect("c"),
        outcome_time: rounds[0]["outcomeTime"].as_i64().expect("t"),
    };
    let proof: Vec<[u8; 32]> = rounds[0]["proof"]
        .as_array()
        .expect("proof")
        .iter()
        .map(|p| hex_to_32(p.as_str().expect("hex")))
        .collect();
    assert!(!observed::verify_leaf(
        &tampered.hash(season, 0),
        0,
        &proof,
        &root
    ));
    tampered.offset_bps = rounds[0]["offsetBps"].as_i64().expect("offset") as i32;
    assert!(
        observed::verify_leaf(&tampered.hash(season, 0), 0, &proof, &root),
        "untampered still verifies"
    );
}

/// Backs docs/operations-daily-job.md: rounds can be created in advance, in one go, so a dead
/// cron cannot stop players from committing. create_round only enforces the id order.
#[test]
fn rounds_can_be_created_in_advance() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    let payer_pk = payer.pubkey();
    let feed = env.feed_id;
    let day0 = env.day0;

    // three future rounds, created today, while round 0 is still open and unresolved
    for round_id in 1..=3u32 {
        let terms = terms_of(day0, round_id, feed);
        let proof = env.proofs[round_id as usize].clone();
        sendx!(
            env,
            &payer,
            [ix_create_round(&payer_pk, round_id, terms, proof)]
        )
        .unwrap_or_else(|e| panic!("create_round {round_id}: {e}"));
        let r = read_round(&env, round_id);
        assert_eq!(r.status, RoundStatus::Open as u8);
        assert_eq!(r.commit_open, day0 + round_id as i64 * 86_400);
    }

    // and today's round still accepts a commit
    let player = env.player.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");
    assert_eq!(read_round(&env, 0).commit_count, 1);

    // a commit for a future round is refused by its own window, not by ordering
    set_time(&mut env.svm, day0 + 60);
    let c = commitment(&env, 1, 4_000, SALT);
    expect_err(
        sendx!(env, &player, [ix_commit(&env, 1, c)]),
        "OutsideCommitWindow",
    );
}

// ---------------------------------------------------------------- incentives

/// The property the product depends on: staying silent is never CHEAPER than revealing.
/// Note the `<=`, not `<`: for p = 0 % or 100 % on the wrong side both are 10 000, so silence
/// gains nothing — that is intended. Anything below 10 000 would make hiding a lost confident
/// call strictly profitable (review 18.09.2026).
#[test]
fn hiding_is_never_better_than_revealing() {
    for k in 0..=20u16 {
        let p_bps = k * 500;
        for yes in [true, false] {
            let revealed = observed::brier_score_bps(p_bps, yes).expect("score");
            assert!(
                revealed <= MISSING_SCORE_BPS,
                "p={p_bps} yes={yes}: revealing costs {revealed}, hiding only {MISSING_SCORE_BPS}"
            );
        }
    }
    // and the worst revealed case is exactly the missing penalty
    assert_eq!(
        observed::brier_score_bps(0, true).expect("score"),
        MISSING_SCORE_BPS
    );
    assert_eq!(
        observed::brier_score_bps(10_000, false).expect("score"),
        MISSING_SCORE_BPS
    );
}

/// NO_RESOLVE means nobody is scored — not even as missing. Nobody may carry a full miss for a
/// round that never had an outcome (owner decision 18.09.2026).
#[test]
fn cancelled_round_scores_nobody() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 10_000, SALT))]
    )
    .expect("commit");

    set_time(&mut env.svm, RESOLVE_DEADLINE + 1);
    sendx!(env, &payer, [ix_cancel(0)]).expect("cancel_round");
    expect_err(sendx!(env, &payer, [ix_score(&env, 0)]), "RoundNotResolved");

    let p = read_player(&env);
    assert_eq!(
        (p.scored_rounds, p.score_sum, p.missing_scored),
        (0, 0, 0),
        "a cancelled round must not add a score, and not a missing either"
    );
    let entry = read_entry(&env, 0).expect("entry");
    assert!(!entry.scored && !entry.scored_as_missing && entry.score_bps == 0);

    // rent still comes back, without a scoring precondition
    sendx!(env, &player, [ix_close_entry(&env, 0)]).expect("close_entry on cancelled round");
    assert!(read_entry(&env, 0).is_none());
}

/// initialize is bound to one key, so deploy day is not a race for the config.
/// Uses a game_id the harness has not used, so the failure is the authority check and not
/// "account already in use".
#[test]
fn initialize_by_a_stranger_fails() {
    use anchor_lang::{
        prelude::Pubkey, solana_program::system_program, InstructionData, ToAccountMetas,
    };
    let mut env = setup();
    let stranger = solana_keypair::Keypair::new();
    env.svm
        .airdrop(&stranger.pubkey(), 1_000_000_000)
        .expect("airdrop");

    let game_id: u64 = 999;
    let config =
        Pubkey::find_program_address(&[b"config", &game_id.to_le_bytes()], &observed::id()).0;
    let ix = anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::Initialize {
            game_id,
            calendar_authority: stranger.pubkey(),
            pause_authority: stranger.pubkey(),
        }
        .data(),
        observed::accounts::Initialize {
            payer: stranger.pubkey(),
            config,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    expect_err(sendx!(env, &stranger, [ix]), "WrongAuthority");

    // the deploy authority itself may do it
    let payer = env.payer.insecure_clone();
    let ok = anchor_lang::solana_program::instruction::Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::Initialize {
            game_id,
            calendar_authority: payer.pubkey(),
            pause_authority: payer.pubkey(),
        }
        .data(),
        observed::accounts::Initialize {
            payer: payer.pubkey(),
            config,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    sendx!(env, &payer, [ok]).expect("deploy authority may initialize");
}

/// A mainnet artefact must never carry the devnet key. Only compiled with --features mainnet.
#[cfg(feature = "mainnet")]
#[test]
fn mainnet_build_does_not_use_the_devnet_authority() {
    let devnet: anchor_lang::prelude::Pubkey = "AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9"
        .parse()
        .expect("pubkey");
    assert_ne!(
        observed::DEPLOY_AUTHORITY,
        devnet,
        "mainnet build still points at the devnet key"
    );
    assert_ne!(
        observed::DEPLOY_AUTHORITY,
        anchor_lang::prelude::Pubkey::default(),
        "DEPLOY_AUTHORITY is still the placeholder"
    );
}

/// Writes the Entry account the program itself produced to tests/fixtures/generated, so the
/// resolver (TypeScript) can prove its byte offsets against it — see
/// services/resolver/test/decode.test.ts. Regenerated on every run of the suite.
#[test]
fn entry_layout_fixture() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 6_500, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, COMMIT_CLOSE + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    sendx!(env, &player, [ix_reveal(&env, 0, 6_500, SALT)]).expect("reveal");
    sendx!(env, &payer, [ix_score(&env, 0)]).expect("score");

    let key = entry_pda(round_pda(0), env.sgt_mint);
    let account = env.svm.get_account(&key).expect("entry account");
    let entry = read_entry(&env, 0).expect("entry");
    let json = format!(
        r#"{{
  "note": "written by programs/observed/tests/observed.rs::entry_layout_fixture — do not edit by hand",
  "pubkey": "{key}",
  "owner": "{owner}",
  "data_base64": "{data}",
  "expected": {{
    "round": "{round}",
    "sgt_mint": "{mint}",
    "revealed": {revealed},
    "p_bps": {p_bps},
    "scored": {scored},
    "scored_as_missing": {missing},
    "score_bps": {score_bps}
  }}
}}
"#,
        key = key,
        owner = account.owner,
        data = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &account.data),
        round = entry.round,
        mint = entry.sgt_mint,
        revealed = entry.revealed,
        p_bps = entry.p_bps,
        scored = entry.scored,
        missing = entry.scored_as_missing,
        score_bps = entry.score_bps,
    );
    let dir = format!(
        "{}/../../tests/fixtures/generated",
        env!("CARGO_MANIFEST_DIR")
    );
    std::fs::create_dir_all(&dir).expect("mkdir");
    std::fs::write(format!("{dir}/entry-layout.json"), json).expect("write fixture");
    assert!(entry.revealed && entry.scored && !entry.scored_as_missing);
    assert_eq!(entry.p_bps, 6_500);
}
