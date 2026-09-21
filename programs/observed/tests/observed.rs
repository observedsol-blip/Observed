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

    set_time(&mut env.svm, REFERENCE_TIME + 5);
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
    set_time(&mut env.svm, REFERENCE_TIME + 5);
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
    set_time(&mut env.svm, REFERENCE_TIME + 5);
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
    {
        set_time(&mut env.svm, CLOSABLE_TIME);
        sendx!(env, &player, [ix_close_entry(&env, 0)]).expect("close_entry");
    }
    assert!(read_entry(&env, 0).is_none());
    println!("CU cancel_round={cu}");
}

#[test]
fn cancel_before_deadline_fails_and_resolved_round_cannot_be_cancelled() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    // the reference window is still open at its last second
    set_time(&mut env.svm, REFERENCE_TIME + WINDOW_SECS as i64);
    expect_err(sendx!(env, &payer, [ix_cancel(0)]), "TooEarly");

    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    // referenced: the outcome window is still open at its last second
    set_time(&mut env.svm, OUTCOME_TIME + WINDOW_SECS as i64);
    expect_err(sendx!(env, &payer, [ix_cancel(0)]), "TooEarly");

    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    set_time(&mut env.svm, RESOLVE_DEADLINE + 1);
    expect_err(sendx!(env, &payer, [ix_cancel(0)]), "AlreadyResolved");
}

/// NO_RESOLVE shows the same day: once a reading can no longer arrive, anyone may cancel.
#[test]
fn missed_reading_can_be_cancelled_as_soon_as_its_window_closes() {
    // no reference in [T, T+W]
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, REFERENCE_TIME + WINDOW_SECS as i64 + 1);
    let late = reference_update(&mut env);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, late)]),
        "OutsideSubmissionWindow",
    );
    sendx!(env, &payer, [ix_cancel(0)]).expect("cancel after the reference window");
    assert_eq!(read_round(&env, 0).status, RoundStatus::Cancelled as u8);

    // reference taken, but no outcome in its window
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + WINDOW_SECS as i64 + 1);
    let out = outcome_update(&mut env, 15_200_000_000);
    expect_err(
        sendx!(env, &payer, [ix_resolve(&env, 0, out)]),
        "OutsideSubmissionWindow",
    );
    sendx!(env, &payer, [ix_cancel(0)]).expect("cancel after the outcome window");
    assert_eq!(read_round(&env, 0).status, RoundStatus::Cancelled as u8);
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
    set_time(&mut env.svm, REFERENCE_TIME + 5);
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
    set_time(&mut env.svm, REFERENCE_TIME + 5);
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

    // before the reference time
    set_time(&mut env.svm, REFERENCE_TIME - 1);
    let early = reference_update(&mut env);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, early)]),
        "TooEarly",
    );

    set_time(&mut env.svm, REFERENCE_TIME + 5);
    // older than A at the moment of submission (publish 61 s before now)
    let d = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        REFERENCE_TIME + 5 - MAX_AGE_SECS as i64 - 1,
        REFERENCE_TIME - 100,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, d);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, k)]),
        "StaleReading",
    );

    // a valid-looking update in another account of the same feed
    let d = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        REFERENCE_TIME,
        REFERENCE_TIME - 1,
        VerificationLevel::Full,
    );
    let other = put_price_update_at(&mut env, anchor_lang::prelude::Pubkey::new_unique(), d);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, other)]),
        "WrongPriceAccount",
    );

    // confidence wider than 50 bps (0.6 % of price)
    let d = price_update(
        env.feed_id,
        15_000_000_000,
        90_000_000,
        -8,
        REFERENCE_TIME,
        REFERENCE_TIME - 1,
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
        REFERENCE_TIME,
        REFERENCE_TIME - 1,
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
        REFERENCE_TIME,
        REFERENCE_TIME - 1,
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
    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let data = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        REFERENCE_TIME,
        REFERENCE_TIME - 1,
        VerificationLevel::Full,
    );
    // right address, but written by some other program
    let key = env.price_account;
    for owner in [
        anchor_lang::prelude::Pubkey::new_unique(),
        // the pre-upgrade receiver: its accounts retire with Pythnet and are refused
        PYTH_RECEIVER_OLD.parse().expect("old receiver"),
    ] {
        put(&mut env.svm, key, owner, 10_000_000, data.clone());
        expect_err(
            sendx!(env, &payer, [ix_set_reference(&env, 0, key)]),
            "AccountOwnedByWrongProgram",
        );
    }
}

// ---------------------------------------------------------------- rule O1

/// The first valid submission fixes the reading; a later, more convenient value of the same
/// account cannot replace it. What was chosen, when and by whom stays in the round.
#[test]
fn first_valid_submission_wins_and_is_recorded() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    let other = solana_keypair::Keypair::new();
    env.svm
        .airdrop(&other.pubkey(), 1_000_000_000)
        .expect("airdrop");

    set_time(&mut env.svm, REFERENCE_TIME + 7);
    let upd = reference_update(&mut env); // 150.00, published at REFERENCE_TIME
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("first submission");
    let slot = env.svm.get_sysvar::<solana_clock::Clock>().slot;
    let r = read_round(&env, 0).reference;
    assert_eq!(
        (
            r.price,
            r.publish_time,
            r.posted_slot,
            r.submitted_at,
            r.submitted_slot,
            r.submitter
        ),
        (
            15_000_000_000,
            REFERENCE_TIME,
            POSTED_SLOT,
            REFERENCE_TIME + 7,
            slot,
            payer.pubkey()
        ),
        "value, its publish time, its update tx slot, and the moment of choice are all stored"
    );

    // the sponsor moves on, someone else would prefer the new value
    set_time(&mut env.svm, REFERENCE_TIME + 20);
    let d = price_update(
        env.feed_id,
        14_000_000_000,
        100_000,
        -8,
        REFERENCE_TIME + 19,
        REFERENCE_TIME + 18,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, d);
    let ix = ix_set_reference(&env, 0, k);
    let ix = anchor_lang::solana_program::instruction::Instruction {
        accounts: ix
            .accounts
            .into_iter()
            .map(|mut m| {
                if m.pubkey == payer.pubkey() {
                    m.pubkey = other.pubkey();
                }
                m
            })
            .collect(),
        ..ix
    };
    expect_err(sendx!(env, &other, [ix]), "RoundNotOpen");
    assert_eq!(
        read_round(&env, 0).reference.price,
        15_000_000_000,
        "unchanged"
    );
}

/// A value from before T is admissible if it is not older than A at submission; one second
/// older is not. That is the rule as decided, not "first update after T".
#[test]
fn reading_age_is_measured_at_submission() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, REFERENCE_TIME + 10);
    let d = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        REFERENCE_TIME + 10 - MAX_AGE_SECS as i64 - 1,
        REFERENCE_TIME - 200,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, d);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, k)]),
        "StaleReading",
    );
    let d = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        REFERENCE_TIME + 10 - MAX_AGE_SECS as i64,
        REFERENCE_TIME - 200,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, d);
    sendx!(env, &payer, [ix_set_reference(&env, 0, k)]).expect("exactly A old is still valid");
    assert_eq!(
        read_round(&env, 0).reference.publish_time,
        REFERENCE_TIME + 10 - MAX_AGE_SECS as i64
    );
}

// ---------------------------------------------------------------- question kind MOVE

/// "More than x % above or below": strict both ways, equality is No, exact (no rounding).
#[test]
fn move_question_counts_both_directions_and_equality_is_no() {
    // reference 150.00000000, x = 2 % → Yes above 153.00, below 147.00
    let cases: [(i64, bool, &str); 6] = [
        (15_300_000_001, true, "just above +2 %"),
        (15_300_000_000, false, "exactly +2 % is No"),
        (15_000_000_000, false, "unchanged"),
        (14_700_000_000, false, "exactly −2 % is No"),
        (14_699_999_999, true, "just below −2 %"),
        (13_000_000_000, true, "far below"),
    ];
    for (price, yes, why) in cases {
        let mut env = setup_with(DAY0, observed::KIND_MOVE, 200);
        let payer = env.payer.insecure_clone();
        set_time(&mut env.svm, REFERENCE_TIME + 5);
        let upd = reference_update(&mut env);
        sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
        let round = read_round(&env, 0);
        assert_eq!(
            (round.threshold_mantissa, round.threshold_low_mantissa),
            (15_300_000_000, 14_700_000_000),
            "display thresholds"
        );
        set_time(&mut env.svm, OUTCOME_TIME + 5);
        let out = outcome_update(&mut env, price);
        sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
        let want = if yes {
            observed::Outcome::Yes
        } else {
            observed::Outcome::No
        } as u8;
        assert_eq!(read_round(&env, 0).outcome, want, "{why}");
    }
}

/// A round decided inside the measurement band is marked as such on chain: `outcome_margin_bps`
/// says how far the outcome cleared the threshold, `band_bps` (from the terms) how far the
/// choice of measurement moment could have moved it. Everyone can recompute "close".
#[test]
fn close_rounds_are_visible_in_the_margin() {
    // reference 150.00000000, MOVE with x = 2 % → thresholds 153.00 / 147.00
    let cases: [(i64, i32, bool, &str); 5] = [
        (
            15_301_500_000,
            1,
            true,
            "+2.01 %: Yes by one basis point, inside the band",
        ),
        (
            15_298_500_000,
            -1,
            false,
            "+1.99 %: No by one basis point, just as close",
        ),
        (
            14_695_500_000,
            3,
            true,
            "−2.03 %: Yes by three basis points on the lower side",
        ),
        (15_600_000_000, 200, true, "+4 %: Yes, far outside the band"),
        (
            15_000_000_000,
            -200,
            false,
            "unchanged: No, far outside the band",
        ),
    ];
    for (price, margin, yes, why) in cases {
        let mut env = setup_with(DAY0, observed::KIND_MOVE, 200);
        let payer = env.payer.insecure_clone();
        set_time(&mut env.svm, REFERENCE_TIME + 5);
        let upd = reference_update(&mut env);
        sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
        set_time(&mut env.svm, OUTCOME_TIME + 5);
        let out = outcome_update(&mut env, price);
        sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
        let round = read_round(&env, 0);
        let want = if yes {
            observed::Outcome::Yes
        } else {
            observed::Outcome::No
        } as u8;
        assert_eq!(round.outcome, want, "{why}");
        assert_eq!(round.outcome_margin_bps, margin, "{why}");
        assert_eq!(round.band_bps, BAND_BPS, "band comes from the terms");
        let close = round.outcome_margin_bps.abs() <= i32::from(round.band_bps);
        assert_eq!(close, margin.abs() <= BAND_BPS as i32, "{why}");
    }
}

/// The promise in the copy: "The reference is taken after sealing closes. Nobody who sealed
/// could have seen it." Enforced by create_round, not by the calendar's good behaviour.
#[test]
fn no_admissible_reference_was_visible_while_sealing() {
    // at the earliest valid submission, the oldest admissible reading is REFERENCE_TIME − A,
    // which is strictly after COMMIT_CLOSE; anything published up to that point is refused
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    assert!(REFERENCE_TIME - (MAX_AGE_SECS as i64) > COMMIT_CLOSE);
    set_time(&mut env.svm, REFERENCE_TIME);
    for published in [
        COMMIT_CLOSE - 1,
        COMMIT_CLOSE,
        REFERENCE_TIME - MAX_AGE_SECS as i64 - 1,
    ] {
        let d = price_update(
            env.feed_id,
            15_000_000_000,
            100_000,
            -8,
            published,
            published - 1,
            VerificationLevel::Full,
        );
        let k = put_price_update(&mut env, d);
        expect_err(
            sendx!(env, &payer, [ix_set_reference(&env, 0, k)]),
            "StaleReading",
        );
    }

    // a calendar that puts the reference too close to the seal close cannot create a round
    let payer_pk = payer.pubkey();
    let mut terms = terms_of(env.day0, 1, env.feed_id);
    terms.reference_time = terms.commit_close + MAX_AGE_SECS as i64; // oldest == close: refused
    let (_, proof) = calendar(&terms.hash(SEASON, 1), 1);
    expect_err(
        sendx!(env, &payer, [ix_create_round(&payer_pk, 1, terms, proof)]),
        "ReferenceBeforeSealCloses",
    );
}

/// A round the player never sealed leaves no trace: no Entry, nothing to score, no missing.
/// The Player account itself only exists from the first seal on. (Owner question 19.09.:
/// the season opens 24.09., the app runs on the owner's device from 26.09.)
#[test]
fn rounds_without_a_seal_leave_no_trace_in_the_record() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    let player = env.player.insecure_clone();
    let payer_pk = payer.pubkey();
    for round_id in 1..=2u32 {
        let terms = terms_of(env.day0, round_id, env.feed_id);
        let proof = env.proofs[round_id as usize].clone();
        sendx!(
            env,
            &payer,
            [ix_create_round(&payer_pk, round_id, terms, proof)]
        )
        .expect("create_round");
    }

    // round 0 runs completely without the player: referenced, resolved, reveal window over
    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    set_time(&mut env.svm, REVEAL_CLOSE + 1);
    assert!(read_entry(&env, 0).is_none(), "no seal, no entry");
    expect_err(
        sendx!(env, &payer, [ix_score(&env, 0)]),
        "AccountNotInitialized",
    );
    assert!(
        env.svm
            .get_account(&player_pda(env.sgt_mint))
            .is_none_or(|a| a.data.is_empty()),
        "no Player account before the first seal"
    );

    // first seal in round 2: the record starts here, at zero
    let day2 = env.day0 + 2 * 86_400;
    set_time(&mut env.svm, day2 + 60);
    let t2 = terms_of(env.day0, 2, env.feed_id);
    let c = observed::commitment_hash(
        &round_pda(2),
        &t2.hash(SEASON, 2),
        &env.sgt_mint,
        &player.pubkey(),
        4_000,
        &SALT,
    );
    sendx!(env, &player, [ix_commit(&env, 2, c)]).expect("first seal");
    let p = read_player(&env);
    assert_eq!(
        (
            p.commits,
            p.reveals,
            p.missing_scored,
            p.scored_rounds,
            p.score_sum
        ),
        (1, 0, 0, 0, 0),
        "rounds 0 and 1 are not in the record"
    );
}

/// Writes a finished Round the program itself serialised to tests/fixtures/generated, so the
/// resolver (TypeScript) can prove its byte offsets against it — like `entry_layout_fixture`.
#[test]
fn round_layout_fixture() {
    let mut env = setup();
    let payer = env.payer.insecure_clone();
    let player = env.player.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 6_500, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    sendx!(env, &player, [ix_reveal(&env, 0, 6_500, SALT)]).expect("reveal");

    let round = read_round(&env, 0);
    let account = env.svm.get_account(&round_pda(0)).expect("round account");
    let json = serde_json::json!({
        "note": "Written by programs/observed/tests/observed.rs::round_layout_fixture. The resolver decodes this with its own offsets.",
        "pubkey": round_pda(0).to_string(),
        "owner": observed::id().to_string(),
        "lamports": account.lamports,
        "data_base64": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &account.data),
        "expected": {
            "round_id": round.round_id,
            "version": round.version,
            "kind": round.kind,
            "source_kind": round.source_kind,
            "feed_id": round.feed_id.iter().map(|b| format!("{b:02x}")).collect::<String>(),
            "price_account": round.price_account.to_string(),
            "offset_bps": round.offset_bps,
            "max_conf_bps": round.max_conf_bps,
            "band_bps": round.band_bps,
            "window_secs": round.window_secs,
            "max_age_secs": round.max_age_secs,
            "close_after_secs": round.close_after_secs,
            "earliest_close_unix": round.earliest_close_unix,
            "commit_open": round.commit_open,
            "commit_close": round.commit_close,
            "reference_time": round.reference_time,
            "outcome_time": round.outcome_time,
            "reveal_close": round.reveal_close,
            "resolve_deadline": round.resolve_deadline,
            "status": round.status,
            "outcome": round.outcome,
            "reference_price": round.reference.price,
            "reference_publish_time": round.reference.publish_time,
            "reference_posted_slot": round.reference.posted_slot,
            "evidence_price": round.evidence.price,
            "outcome_margin_bps": round.outcome_margin_bps,
            "commit_count": round.commit_count,
            "reveal_count": round.reveal_count,
            "size": account.data.len(),
        }
    });
    let dir = format!(
        "{}/../../tests/fixtures/generated",
        env!("CARGO_MANIFEST_DIR")
    );
    std::fs::create_dir_all(&dir).expect("fixture dir");
    std::fs::write(
        format!("{dir}/round-layout.json"),
        format!("{}\n", serde_json::to_string_pretty(&json).expect("json")),
    )
    .expect("write fixture");
}

/// Account sizes others depend on: the resolver filters Entry by `dataSize: 184`, and Round's
/// size sets the season's rent. A change here must be a decision, not an accident.
#[test]
fn account_sizes_are_pinned() {
    use anchor_lang::Space;
    assert_eq!(
        8 + observed::Entry::INIT_SPACE,
        184,
        "Entry (resolver dataSize filter)"
    );
    assert_eq!(
        8 + observed::Round::INIT_SPACE,
        498,
        "Round (terms v3: reference time, band, closing dates, two readings, reserve)"
    );
    assert_eq!(observed::Reading::INIT_SPACE, 84, "one reading");
}

type TermsEdit = Box<dyn Fn(&mut observed::RoundTerms)>;

/// create_round refuses terms the program does not understand, even with a valid proof.
#[test]
fn create_round_refuses_unknown_or_unsafe_terms() {
    // validate() runs before the Merkle check, so each case fails on its own rule
    let cases: Vec<(TermsEdit, &str)> = vec![
        (Box::new(|t| t.version = 2), "BadTermsVersion"),
        (Box::new(|t| t.source_kind = 0), "UnsupportedSource"),
        (Box::new(|t| t.kind = 7), "UnknownKind"),
        (
            Box::new(|t| {
                t.kind = observed::KIND_MOVE;
                t.offset_bps = 0
            }),
            "BadOffset",
        ),
        (
            Box::new(|t| {
                t.kind = observed::KIND_MOVE;
                t.offset_bps = -100
            }),
            "BadOffset",
        ),
        (Box::new(|t| t.band_bps = 0), "BadBand"),
        (
            Box::new(|t| t.band_bps = t.offset_bps.unsigned_abs() as u16),
            "BadBand",
        ),
        (Box::new(|t| t.window_secs = 0), "BadWindowParams"),
        (Box::new(|t| t.max_age_secs = 3_601), "BadWindowParams"),
        (
            Box::new(|t| t.outcome_time = t.commit_close + 60),
            "BadWindows",
        ),
    ];
    for (edit, needle) in cases {
        let mut env = setup();
        let payer = env.payer.insecure_clone();
        let payer_pk = payer.pubkey();
        let mut terms = terms_of(env.day0, 1, env.feed_id);
        edit(&mut terms);
        let th = terms.hash(SEASON, 1);
        let (_, proof) = calendar(&th, 1);
        let res = sendx!(env, &payer, [ix_create_round(&payer_pk, 1, terms, proof)]);
        expect_err(res, needle);
    }
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
    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");

    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let stale = price_update(
        env.feed_id,
        15_200_000_000,
        100_000,
        -8,
        OUTCOME_TIME + 5 - MAX_AGE_SECS as i64 - 1,
        OUTCOME_TIME - 100,
        VerificationLevel::Full,
    );
    let k = put_price_update(&mut env, stale);
    expect_err(
        sendx!(env, &payer, [ix_resolve(&env, 0, k)]),
        "StaleReading",
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
    set_time(&mut env.svm, REFERENCE_TIME + 5);
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

    set_time(&mut env.svm, CLOSABLE_TIME);
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
    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    set_time(&mut env.svm, CLOSABLE_TIME);
    // the missing penalty must not be escapable by closing the entry first
    expect_err(
        sendx!(env, &player, [ix_close_entry(&env, 0)]),
        "EntryNotClosable",
    );
    sendx!(env, &payer, [ix_score(&env, 0)]).expect("score missing");
    sendx!(env, &player, [ix_close_entry(&env, 0)]).expect("close after scoring");
}

/// Entries come back rolling — but not while anyone is still looking. Both dates are in the
/// round terms and therefore in the calendar hash (owner decision 21.09.2026).
#[test]
fn entries_close_rolling_but_never_before_the_floor() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    sendx!(env, &player, [ix_reveal(&env, 0, 4_000, SALT)]).expect("reveal");
    sendx!(env, &payer, [ix_score(&env, 0)]).expect("score");

    // the rolling delay alone is not enough while the floor is still ahead
    assert!(
        REVEAL_CLOSE + CLOSE_AFTER_SECS as i64 + 1 < EARLIEST_CLOSE_UNIX,
        "for this round the floor is the binding date"
    );
    set_time(&mut env.svm, REVEAL_CLOSE + CLOSE_AFTER_SECS as i64 + 1);
    expect_err(sendx!(env, &player, [ix_close_entry(&env, 0)]), "TooEarly");

    // from the floor on, anyone may close it — and the deposit goes to the player, not the caller
    set_time(&mut env.svm, CLOSABLE_TIME);
    let stranger = solana_keypair::Keypair::new();
    env.svm
        .airdrop(&stranger.pubkey(), 1_000_000_000)
        .expect("airdrop");
    let before = env.svm.get_balance(&player.pubkey()).expect("balance");
    let ix = ix_close_entry_by(&env, 0, stranger.pubkey(), player.pubkey());
    sendx!(env, &stranger, [ix]).expect("a stranger may close it for the player");
    assert!(
        env.svm.get_balance(&player.pubkey()).expect("balance") > before,
        "the deposit went back to the player"
    );
    assert!(read_entry(&env, 0).is_none(), "entry is gone");

    // and the record does not care: the totals live in Player, which is never closed
    let p = read_player(&env);
    assert_eq!((p.commits, p.reveals, p.scored_rounds), (1, 1, 1));
    assert_eq!(p.score_sum, 3_600, "the score survives the closed entry");
}

/// Closing cannot be redirected: the refund address is the one the entry recorded when sealed.
#[test]
fn closing_cannot_redirect_the_deposit() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("commit");
    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");
    sendx!(env, &player, [ix_reveal(&env, 0, 4_000, SALT)]).expect("reveal");
    sendx!(env, &payer, [ix_score(&env, 0)]).expect("score");
    set_time(&mut env.svm, CLOSABLE_TIME);

    let thief = solana_keypair::Keypair::new();
    env.svm
        .airdrop(&thief.pubkey(), 1_000_000_000)
        .expect("airdrop");
    let ix = ix_close_entry_by(&env, 0, thief.pubkey(), thief.pubkey());
    expect_err(sendx!(env, &thief, [ix]), "WrongRentRefund");
    assert!(read_entry(&env, 0).is_some(), "the entry is still there");
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

/// The real sponsored SOL/USD account of the upgraded stack, captured from mainnet on
/// 19.09.2026 (tests/fixtures/pyth/real-sol-sponsored.json): owner rec2HH…, Full,
/// price 113.53832042, publish_time 1_789_769_926, posted_slot 448_216_116.
#[test]
fn real_sponsored_account_is_accepted() {
    const REAL_PUBLISH: i64 = 1_789_769_926;
    // reference_time three seconds after that publish time; submit two seconds later (age 5 s)
    let mut env = setup_day(REAL_PUBLISH + 3 - REFERENCE_DELAY - 12 * 3600);
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, REAL_PUBLISH + 5);
    let real = put_fixture_account(&mut env, "pyth/real-sol-sponsored");
    assert_eq!(
        real, env.price_account,
        "the fixture is the PDA [0u16, feed_id] under the upgraded push oracle"
    );
    sendx!(env, &payer, [ix_set_reference(&env, 0, real)]).expect("set_reference with real bytes");
    let r = read_round(&env, 0).reference;
    assert_eq!(
        (r.price, r.expo, r.publish_time, r.posted_slot),
        (11_353_832_042, -8, REAL_PUBLISH, 448_216_116)
    );
}

/// Real pre-upgrade bytes (Spike 1, owner rec5E…) are refused by owner, even at the right
/// address. The real partially verified bytes are refused by level.
#[test]
fn real_pre_upgrade_and_partial_updates_are_refused() {
    const REAL_PUBLISH: i64 = 1_789_603_200;
    let mut env = setup_day(REAL_PUBLISH - 3 - REFERENCE_DELAY - 12 * 3600);
    let payer = env.payer.insecure_clone();
    set_time(&mut env.svm, REAL_PUBLISH + 2);
    let key = env.price_account;

    put_fixture_account_at(&mut env, "pyth/real-sol-outcome", key, None);
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, key)]),
        "AccountOwnedByWrongProgram",
    );

    put_fixture_account_at(
        &mut env,
        "pyth/real-sol-partial",
        key,
        Some(pyth_solana_receiver_sdk::ID),
    );
    expect_err(
        sendx!(env, &payer, [ix_set_reference(&env, 0, key)]),
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

    let terms_from = |r: &serde_json::Value| observed::RoundTerms {
        version: r["version"].as_u64().expect("version") as u8,
        kind: r["kind"].as_u64().expect("kind") as u8,
        source_kind: r["sourceKind"].as_u64().expect("sourceKind") as u8,
        feed_id: hex_to_32(r["feedId"].as_str().expect("feedId")),
        price_account: r["priceAccount"]
            .as_str()
            .expect("priceAccount")
            .parse()
            .expect("b58"),
        offset_bps: r["offsetBps"].as_i64().expect("offsetBps") as i32,
        max_conf_bps: r["maxConfBps"].as_u64().expect("maxConfBps") as u16,
        band_bps: r["bandBps"].as_u64().expect("bandBps") as u16,
        window_secs: r["windowSecs"].as_u64().expect("windowSecs") as u16,
        max_age_secs: r["maxAgeSecs"].as_u64().expect("maxAgeSecs") as u16,
        close_after_secs: r["closeAfterSecs"].as_u64().expect("closeAfterSecs") as u32,
        earliest_close_unix: r["earliestCloseUnix"].as_i64().expect("earliestCloseUnix"),
        commit_open: r["commitOpen"].as_i64().expect("commitOpen"),
        commit_close: r["commitClose"].as_i64().expect("commitClose"),
        reference_time: r["referenceTime"].as_i64().expect("referenceTime"),
        outcome_time: r["outcomeTime"].as_i64().expect("outcomeTime"),
    };
    let btc = hex_to_32("e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43");

    for r in rounds {
        let round_id = r["roundId"].as_u64().expect("roundId") as u32;
        let terms = terms_from(r);
        terms
            .validate()
            .expect("create_round would accept these terms");
        // season-1 rules (DECISIONS 18./19.09.2026)
        assert_eq!(terms.kind, observed::KIND_MOVE, "season 1 asks only 'move'");
        assert_eq!(
            (terms.window_secs, terms.max_age_secs),
            (60, 60),
            "W = A = 60 s"
        );
        assert!(
            terms.offset_bps >= 100,
            "threshold ≥ 1.0 % (4 × measurement spread)"
        );
        assert_eq!(
            terms.band_bps, 25,
            "measurement band 25 bps (p90 22.7, rounded up)"
        );
        assert!(
            i32::from(terms.band_bps) * 4 <= terms.offset_bps,
            "threshold is at least four times the band"
        );
        assert_eq!(
            terms.price_account,
            feed_account(&terms.feed_id),
            "sponsored account"
        );
        assert_eq!(
            terms.commit_open.rem_euclid(86_400),
            16 * 3600,
            "window opens 16:00 UTC"
        );
        assert_eq!(
            terms.commit_close - terms.commit_open,
            12 * 3600,
            "closes 04:00 UTC"
        );
        assert_eq!(
            terms.reference_time - terms.commit_close,
            120,
            "reference 04:02 UTC, two minutes after sealing closes"
        );
        assert_eq!(
            terms.close_after_secs,
            30 * 24 * 3600,
            "entries come back 30 days after their reveal window"
        );
        assert_eq!(
            terms.earliest_close_unix, 1_794_182_400,
            "…but never before 9 Nov 2026 00:00 UTC, after judging ends"
        );
        assert_eq!(
            terms.outcome_time - terms.commit_close,
            12 * 3600,
            "outcome 16:00 UTC"
        );
        // 1970-01-01 was a Thursday: (days + 4) % 7 gives 0 = Sunday … 6 = Saturday
        let dow = (terms.outcome_time.div_euclid(86_400) + 4).rem_euclid(7);
        assert!(
            !(terms.feed_id == btc && (dow == 0 || dow == 6)),
            "no BTC round is measured on a weekend (round {round_id})"
        );
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
        assert_eq!(terms.max_conf_bps, 50);
    }

    // a tampered rule must not verify under the published root
    let mut tampered = terms_from(&rounds[0]);
    tampered.offset_bps = 999;
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
    {
        set_time(&mut env.svm, CLOSABLE_TIME);
        sendx!(env, &player, [ix_close_entry(&env, 0)]).expect("close_entry on cancelled round");
    }
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
    set_time(&mut env.svm, REFERENCE_TIME + 5);
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

// ---------------------------------------------------------------- foreign devices (judge path)
// The app will run on Seekers whose state we do not know. These are the program-side facts the
// client has to be built around; the client-side handling is specified in
// docs/judge-path-acceptance.md.

/// Moves the SGT to another wallet the way Solana Mobile does it: same mint, token account now
/// owned by the new wallet (the old account keeps 0, modelled here by re-owning the one account).
fn migrate_sgt(env: &mut Env, new_owner: &anchor_lang::prelude::Pubkey) {
    let mut acc = env
        .svm
        .get_account(&env.sgt_token)
        .expect("sgt token account");
    acc.data[32..64].copy_from_slice(new_owner.as_ref());
    env.svm
        .set_account(env.sgt_token, acc)
        .expect("set_account");
}

/// Sealed with wallet A, SGT migrates to wallet B before the reveal: the answer still belongs to
/// A (Spec §4, "The answer belongs to the wallet that sealed it"). B cannot reveal it, A can,
/// without holding the token any more. The client must therefore reveal with the wallet stored
/// in the seal record, not with whatever account the wallet app offers today.
#[test]
fn migration_between_seal_and_reveal() {
    let mut env = setup();
    let wallet_a = env.player.insecure_clone();
    sendx!(
        env,
        &wallet_a,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("seal with A");

    let wallet_b = solana_keypair::Keypair::new();
    env.svm
        .airdrop(&wallet_b.pubkey(), 1_000_000_000)
        .expect("airdrop");
    migrate_sgt(&mut env, &wallet_b.pubkey());

    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let mut by_b = ix_reveal(&env, 0, 4_000, SALT);
    by_b.accounts[0].pubkey = wallet_b.pubkey();
    expect_err(sendx!(env, &wallet_b, [by_b]), "WrongBeneficiary");

    sendx!(env, &wallet_a, [ix_reveal(&env, 0, 4_000, SALT)]).expect("A reveals without the token");
    assert!(read_entry(&env, 0).expect("entry").revealed);
}

/// After a migration the same device keeps its history: the next seal by the new wallet lands
/// on the same Player account (keyed by mint), and a second seal for a round already sealed by
/// the old wallet is refused.
#[test]
fn migrated_device_keeps_one_history_and_one_entry_per_round() {
    let mut env = setup();
    let wallet_a = env.player.insecure_clone();
    sendx!(
        env,
        &wallet_a,
        [ix_commit(&env, 0, commitment(&env, 0, 4_000, SALT))]
    )
    .expect("seal with A");

    let wallet_b = solana_keypair::Keypair::new();
    env.svm
        .airdrop(&wallet_b.pubkey(), 1_000_000_000)
        .expect("airdrop");
    migrate_sgt(&mut env, &wallet_b.pubkey());

    let mut again = ix_commit(&env, 0, [9u8; 32]);
    again.accounts[0].pubkey = wallet_b.pubkey();
    expect_err(sendx!(env, &wallet_b, [again]), "already in use");

    // next round: B seals, and it is still the same Player record
    let payer = env.payer.insecure_clone();
    let payer_pk = payer.pubkey();
    let terms1 = terms_of(env.day0, 1, env.feed_id);
    let proof1 = env.proofs[1].clone();
    sendx!(env, &payer, [ix_create_round(&payer_pk, 1, terms1, proof1)]).expect("create round 1");
    set_time(&mut env.svm, env.day0 + 86_400 + 60);
    let mut seal_b = ix_commit(&env, 1, [7u8; 32]);
    seal_b.accounts[0].pubkey = wallet_b.pubkey();
    sendx!(env, &wallet_b, [seal_b]).expect("B seals round 1");
    assert_eq!(
        read_player(&env).commits,
        2,
        "one device, one history across wallets"
    );
}

/// A wallet that does not hold the SGT cannot seal, whichever token account it points at:
/// its own account does not exist, and the real SGT account is owned by someone else.
/// The client must detect this BEFORE the wallet prompt and say which wallet holds the token.
#[test]
fn wallet_without_the_sgt_cannot_seal() {
    let mut env = setup();
    let other = solana_keypair::Keypair::new();
    env.svm
        .airdrop(&other.pubkey(), 1_000_000_000)
        .expect("airdrop");
    let mut ix = ix_commit(&env, 0, [1u8; 32]);
    ix.accounts[0].pubkey = other.pubkey();
    expect_err(sendx!(env, &other, [ix]), "ConstraintTokenOwner");
}
