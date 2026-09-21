//! The whole season in fast forward: all 64 rounds of the real calendar
//! (tests/fixtures/calendar/season1.json), 20 players, the clock jumped from phase to phase.
//!
//! Why this exists: judging runs until 8 Nov, the season until 27 Nov. A bug in round 40 cannot
//! be fixed after 8 Oct — and a bug in the program cannot be fixed after the mainnet deploy
//! without a new layout. So every round of the real calendar is played once, here, in advance.
mod common;
use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, system_program, InstructionData,
        ToAccountMetas,
    },
    common::*,
    observed::{RoundStatus, RoundTerms},
    pyth_solana_receiver_sdk::price_update::VerificationLevel,
    solana_keypair::Keypair,
    solana_signer::Signer,
    std::collections::BTreeMap,
    std::str::FromStr,
};

const PLAYERS: usize = 20;
/// Rounds played with a scripted deviation from the happy path.
const NO_REFERENCE_ROUND: u32 = 7; // nobody takes the reference → NO_RESOLVE
const NO_OUTCOME_ROUND: u32 = 23; // referenced, but no outcome reading → NO_RESOLVE
const CLOSE_CALL_ROUND: u32 = 31; // outcome one basis point past the threshold
const RENT_PER_BYTE_YEAR_X2: u64 = 6_960; // lamports per byte for rent exemption

struct Player {
    wallet: Keypair,
    mint: Pubkey,
    token: Pubkey,
    /// p_bps this player gives; None means "never seals".
    style: Style,
}

#[derive(Clone, Copy)]
enum Style {
    /// Seals and reveals every round.
    Diligent(u16),
    /// Seals every round, reveals only every other one → missing reveals.
    Forgetful(u16),
    /// Seals only every third round.
    Occasional(u16),
}

fn season_file() -> serde_json::Value {
    let path = format!(
        "{}/../../tests/fixtures/calendar/season1.json",
        env!("CARGO_MANIFEST_DIR")
    );
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}")))
        .expect("season json")
}

fn terms_from(r: &serde_json::Value) -> RoundTerms {
    RoundTerms {
        version: r["version"].as_u64().expect("version") as u8,
        kind: r["kind"].as_u64().expect("kind") as u8,
        source_kind: r["sourceKind"].as_u64().expect("sourceKind") as u8,
        feed_id: hex_to_32(r["feedId"].as_str().expect("feedId")),
        price_account: Pubkey::from_str(r["priceAccount"].as_str().expect("priceAccount"))
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
    }
}

/// A valid SGT for another device: the real mint bytes with its own pubkey swapped in (the
/// TokenGroupMember must point at the mint), plus a token account for `owner`.
fn make_sgt(env: &mut Env, index: usize, owner: &Pubkey) -> (Pubkey, Pubkey) {
    let (orig_mint, t22, mint_lamports, mint_data) = read_fixture("sgt/sgt-mint");
    let (_, _, token_lamports, token_data) = read_fixture("sgt/sgt-token-account");
    let mut mint_data = mint_data;
    let mut token_data = token_data;

    let new_mint = Pubkey::new_from_array([(index as u8) + 100; 32]);
    // the mint's own key appears twice in the extension area; both must follow it
    for offset in [342usize, 378] {
        mint_data[offset..offset + 32].copy_from_slice(new_mint.as_ref());
    }
    assert_ne!(new_mint, orig_mint);
    token_data[0..32].copy_from_slice(new_mint.as_ref()); // token account mint
    token_data[32..64].copy_from_slice(owner.as_ref()); // token account owner

    let token_key = Pubkey::new_from_array([(index as u8) + 160; 32]);
    put(&mut env.svm, new_mint, t22, mint_lamports, mint_data);
    put(&mut env.svm, token_key, t22, token_lamports, token_data);
    (new_mint, token_key)
}

fn ix_commit_for(p: &Player, round_id: u32, commitment: [u8; 32]) -> Instruction {
    let round = round_pda(round_id);
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::Commit { commitment }.data(),
        observed::accounts::Commit {
            player_wallet: p.wallet.pubkey(),
            sgt_mint: p.mint,
            sgt_token_account: p.token,
            config: config_pda(),
            round,
            entry: entry_pda(round, p.mint),
            player: player_pda(p.mint),
            token_program: Pubkey::from_str(TOKEN_2022).expect("t22"),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn ix_reveal_for(p: &Player, round_id: u32, p_bps: u16, salt: [u8; 32]) -> Instruction {
    let round = round_pda(round_id);
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::Reveal { p_bps, salt }.data(),
        observed::accounts::Reveal {
            beneficiary: p.wallet.pubkey(),
            config: config_pda(),
            round,
            entry: entry_pda(round, p.mint),
            player: player_pda(p.mint),
        }
        .to_account_metas(None),
    )
}

fn ix_score_for(p: &Player, round_id: u32) -> Instruction {
    let round = round_pda(round_id);
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::ScoreEntry {}.data(),
        observed::accounts::ScoreEntry {
            config: config_pda(),
            round,
            entry: entry_pda(round, p.mint),
            player: player_pda(p.mint),
        }
        .to_account_metas(None),
    )
}

/// Closing is permissionless: the resolver pays the fee, the deposit goes to the player.
fn ix_close_for(p: &Player, round_id: u32, payer: Pubkey) -> Instruction {
    let round = round_pda(round_id);
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::CloseEntry {}.data(),
        observed::accounts::CloseEntry {
            payer,
            rent_refund_to: p.wallet.pubkey(),
            config: config_pda(),
            round,
            entry: entry_pda(round, p.mint),
        }
        .to_account_metas(None),
    )
}

fn reading_at(env: &mut Env, feed_id: [u8; 32], account: Pubkey, price: i64, t: i64) -> Pubkey {
    let data = price_update(
        feed_id,
        price,
        price as u64 / 10_000, // ~1 bp confidence
        -8,
        t,
        t - 1,
        VerificationLevel::Full,
    );
    put_price_update_at(env, account, data)
}

#[test]
fn whole_season_in_fast_forward() {
    let season = season_file();
    let rounds = season["rounds"].as_array().expect("rounds").clone();
    assert_eq!(rounds.len(), 64);
    let root = hex_to_32(season["merkleRoot"].as_str().expect("root"));
    let season_no = season["season"].as_u64().expect("season") as u16;

    let first = terms_from(&rounds[0]);
    let mut env = setup_bare(first.commit_open - 3_600, root, season_no);

    // 20 devices, three habits
    let mut players: Vec<Player> = Vec::new();
    for i in 0..PLAYERS {
        let wallet = Keypair::new_from_array([(i as u8) + 200; 32]);
        env.svm
            .airdrop(&wallet.pubkey(), 20_000_000_000)
            .expect("airdrop");
        let (mint, token) = make_sgt(&mut env, i, &wallet.pubkey());
        let style = match i % 4 {
            0 => Style::Forgetful(5_500 + (i as u16 % 3) * 500),
            1 => Style::Occasional(7_000),
            _ => Style::Diligent(3_000 + (i as u16 % 5) * 1_000),
        };
        players.push(Player {
            wallet,
            mint,
            token,
            style,
        });
    }

    let payer = env.payer.insecure_clone();
    let payer_pk = payer.pubkey();
    let salt = [9u8; 32];
    let mut expected: BTreeMap<usize, (u32, u32, u32, u64)> = BTreeMap::new(); // commits, reveals, missing, score_sum
    let mut cancelled = 0usize;
    let mut resolved = 0usize;
    let mut close_calls = 0usize;
    let mut cu_total: u64 = 0;
    let mut reference_price = 0i64;

    for (index, round_json) in rounds.iter().enumerate() {
        let round_id = round_json["roundId"].as_u64().expect("roundId") as u32;
        let terms = terms_from(round_json);
        let proof: Vec<[u8; 32]> = round_json["proof"]
            .as_array()
            .expect("proof")
            .iter()
            .map(|p| hex_to_32(p.as_str().expect("hex")))
            .collect();

        // --- the round is created in advance, as the owner does for the whole season
        set_time(&mut env.svm, terms.commit_open - 60);
        cu_total += sendx!(
            env,
            &payer,
            [ix_create_round(&payer_pk, round_id, terms, proof)]
        )
        .unwrap_or_else(|e| panic!("create_round {round_id}: {e}"));

        // --- sealing
        set_time(&mut env.svm, terms.commit_open + 300);
        for (i, p) in players.iter().enumerate() {
            let seals = match p.style {
                Style::Diligent(_) => true,
                Style::Forgetful(_) => true,
                Style::Occasional(_) => index % 3 == 0,
            };
            if !seals {
                continue;
            }
            let p_bps = match p.style {
                Style::Diligent(v) | Style::Forgetful(v) | Style::Occasional(v) => v,
            };
            let commitment = observed::commitment_hash(
                &round_pda(round_id),
                &terms.hash(season_no, round_id),
                &p.mint,
                &p.wallet.pubkey(),
                p_bps,
                &salt,
            );
            cu_total += sendx!(env, &p.wallet, [ix_commit_for(p, round_id, commitment)])
                .unwrap_or_else(|e| panic!("commit r{round_id} p{i}: {e}"));
            expected.entry(i).or_default().0 += 1;
        }

        // --- reference (rule O1: inside [reference_time, +W])
        let price = 15_000_000_000 + (index as i64 % 7) * 10_000_000;
        if round_id != NO_REFERENCE_ROUND {
            set_time(&mut env.svm, terms.reference_time + 2);
            let upd = reading_at(
                &mut env,
                terms.feed_id,
                terms.price_account,
                price,
                terms.reference_time,
            );
            cu_total += sendx!(env, &payer, [ix_set_reference(&env, round_id, upd)])
                .unwrap_or_else(|e| panic!("set_reference {round_id}: {e}"));
            reference_price = price;
        }

        // --- outcome
        let outcome_price = if round_id == CLOSE_CALL_ROUND {
            // one basis point past the upper threshold → margin 1, inside the band
            reference_price + reference_price * (terms.offset_bps as i64 + 1) / 10_000
        } else if index % 2 == 0 {
            reference_price + reference_price * (terms.offset_bps as i64 + 120) / 10_000
        // clear Yes
        } else {
            reference_price + reference_price / 10_000 // clear No (0.01 % move)
        };
        let mut is_resolved = false;
        if round_id != NO_REFERENCE_ROUND && round_id != NO_OUTCOME_ROUND {
            set_time(&mut env.svm, terms.outcome_time + 2);
            let upd = reading_at(
                &mut env,
                terms.feed_id,
                terms.price_account,
                outcome_price,
                terms.outcome_time,
            );
            cu_total += sendx!(env, &payer, [ix_resolve(&env, round_id, upd)])
                .unwrap_or_else(|e| panic!("resolve {round_id}: {e}"));
            is_resolved = true;
            resolved += 1;
        }

        // --- reveal, inside the reveal window
        set_time(&mut env.svm, terms.outcome_time + 600);
        for (i, p) in players.iter().enumerate() {
            let sealed = match p.style {
                Style::Occasional(_) => index % 3 == 0,
                _ => true,
            };
            let reveals = match p.style {
                Style::Diligent(_) | Style::Occasional(_) => true,
                Style::Forgetful(_) => index % 2 == 0,
            };
            if !sealed || !reveals {
                continue;
            }
            let p_bps = match p.style {
                Style::Diligent(v) | Style::Forgetful(v) | Style::Occasional(v) => v,
            };
            cu_total += sendx!(env, &p.wallet, [ix_reveal_for(p, round_id, p_bps, salt)])
                .unwrap_or_else(|e| panic!("reveal r{round_id} p{i}: {e}"));
            expected.entry(i).or_default().1 += 1;
        }

        // --- what the resolver does after the reveal window: cancel or score everything
        set_time(&mut env.svm, terms.outcome_time + REVEAL_WINDOW + 60);
        let round = read_round(&env, round_id);
        if !is_resolved {
            cu_total += sendx!(env, &payer, [ix_cancel(round_id)])
                .unwrap_or_else(|e| panic!("cancel {round_id}: {e}"));
            assert_eq!(
                read_round(&env, round_id).status,
                RoundStatus::Cancelled as u8
            );
            cancelled += 1;
            continue;
        }
        assert_eq!(
            round.status,
            RoundStatus::Resolved as u8,
            "round {round_id}"
        );
        if round.outcome_margin_bps.abs() <= i32::from(round.band_bps) {
            close_calls += 1;
        }

        let yes = round.outcome == observed::Outcome::Yes as u8;
        for (i, p) in players.iter().enumerate() {
            let sealed = match p.style {
                Style::Occasional(_) => index % 3 == 0,
                _ => true,
            };
            if !sealed {
                continue;
            }
            cu_total += sendx!(env, &payer, [ix_score_for(p, round_id)])
                .unwrap_or_else(|e| panic!("score r{round_id} p{i}: {e}"));
            let entry = read_entry_for(&env, round_id, p.mint).expect("entry");
            let e = expected.entry(i).or_default();
            if entry.scored_as_missing {
                e.2 += 1;
            }
            e.3 += u64::from(entry.score_bps);
            let p_bps = match p.style {
                Style::Diligent(v) | Style::Forgetful(v) | Style::Occasional(v) => v,
            };
            let want = if entry.revealed {
                observed::brier_score_bps(p_bps, yes).expect("score")
            } else {
                observed::MISSING_SCORE_BPS
            };
            assert_eq!(entry.score_bps, want, "score r{round_id} p{i}");
        }
    }

    // ---- what the record says at the end of the season
    assert_eq!(
        resolved + cancelled,
        64,
        "every round reached a final state"
    );
    assert_eq!(cancelled, 2, "the two scripted NO_RESOLVE rounds");
    assert!(close_calls >= 1, "the scripted close round is marked close");

    let mut total_entries = 0u32;
    let mut revealed_only_checked = 0usize;
    for (i, p) in players.iter().enumerate() {
        let want = expected.get(&i).copied().unwrap_or_default();
        let player = read_player_for(&env, p.mint);

        // What the Record needs must come out of `Player` alone — that account is never closed,
        // so the record survives a reinstall, a new device and (later) a closed Entry.
        // Season value including penalties:
        let season_value = player.score_sum as f64 / player.scored_rounds.max(1) as f64;
        // Diagnosis from revealed rounds only: every missing entry scores exactly 10 000, so it
        // can be taken back out without knowing any single Entry.
        let missing_cost =
            u64::from(player.missing_scored) * u64::from(observed::MISSING_SCORE_BPS);
        let revealed_rounds = player.scored_rounds - player.missing_scored;
        if revealed_rounds > 0 {
            let revealed_only = (player.score_sum - missing_cost) as f64 / revealed_rounds as f64;
            assert!(
                revealed_only <= season_value + f64::EPSILON,
                "p{i}: the diagnosis can never be worse than the season value"
            );
            // cross-check against the scores the test summed itself for revealed rounds only
            let expected_revealed: u64 = want.3 - u64::from(want.2) * 10_000;
            assert_eq!(
                player.score_sum - missing_cost,
                expected_revealed,
                "p{i}: revealed-only sum is derivable from Player alone"
            );
            revealed_only_checked += 1;
        }
        assert_eq!(player.commits, want.0, "commits p{i}");
        assert_eq!(player.reveals, want.1, "reveals p{i}");
        assert_eq!(player.missing_scored, want.2, "missing p{i}");
        assert_eq!(player.score_sum, want.3, "score_sum p{i}");
        assert_eq!(
            player.scored_rounds,
            want.0 - cancelled_seals(&p.style, PLAYERS),
            "scored rounds p{i} (commits minus the cancelled rounds)"
        );
        total_entries += player.commits;
    }

    // ---- the rolling close: deposits come back, the record does not move
    let first = terms_from(&rounds[0]);
    let floor = first.earliest_close_unix;
    let rolling = |t: &RoundTerms| {
        (t.outcome_time + REVEAL_WINDOW + i64::from(t.close_after_secs)).max(t.earliest_close_unix)
    };
    // one second before the floor nothing may close, although the 30 days are long past
    set_time(&mut env.svm, floor - 1);
    let sample = &players[2]; // a diligent player, sealed in every round
    expect_err(
        sendx!(env, &payer, [ix_close_for(sample, 0, payer_pk)]),
        "TooEarly",
    );

    // from the round's own date on, the resolver closes them for the player
    let mut refunded = 0u64;
    let mut closed = 0usize;
    for (index, round_json) in rounds.iter().enumerate() {
        let round_id = round_json["roundId"].as_u64().expect("roundId") as u32;
        let terms = terms_from(round_json);
        set_time(&mut env.svm, rolling(&terms));
        for p in players.iter() {
            if read_entry_for(&env, round_id, p.mint).is_none() {
                continue;
            }
            let before = env.svm.get_balance(&p.wallet.pubkey()).expect("balance");
            sendx!(env, &payer, [ix_close_for(p, round_id, payer_pk)])
                .unwrap_or_else(|e| panic!("close r{round_id}: {e}"));
            refunded += env.svm.get_balance(&p.wallet.pubkey()).expect("balance") - before;
            closed += 1;
        }
        if index == 0 {
            assert!(
                read_entry_for(&env, round_id, sample.mint).is_none(),
                "round 0 is empty once its date has passed"
            );
        }
    }
    assert_eq!(closed, total_entries as usize, "every entry came back");

    // the record is untouched by all that closing
    for (i, p) in players.iter().enumerate() {
        let want = expected.get(&i).copied().unwrap_or_default();
        let player = read_player_for(&env, p.mint);
        assert_eq!(
            (player.commits, player.reveals, player.score_sum),
            (want.0, want.1, want.3),
            "p{i}: the record survives closed entries"
        );
    }

    // ---- rent that stays bound (Round and Player are never closable)
    let round_rent = (498 + 128) * RENT_PER_BYTE_YEAR_X2 * 64;
    let player_rent = (8 + 65 + 128) * RENT_PER_BYTE_YEAR_X2 * PLAYERS as u64;
    let entry_rent = (184 + 128) * RENT_PER_BYTE_YEAR_X2 * u64::from(total_entries);
    println!(
        "season: {resolved} resolved, {cancelled} NO_RESOLVE, {close_calls} close; \
         {total_entries} entries, {PLAYERS} players; CU total {cu_total}; \
         rent bound: rounds {:.3} SOL + players {:.4} SOL; \
         {closed} entries closed rolling, {:.3} SOL back to the players (expected {:.3})",
        round_rent as f64 / 1e9,
        player_rent as f64 / 1e9,
        refunded as f64 / 1e9,
        entry_rent as f64 / 1e9,
    );
}

/// Seals that fall into a cancelled round are never scored.
fn cancelled_seals(style: &Style, _players: usize) -> u32 {
    // rounds 7 and 23 are cancelled; occasional players only sealed in rounds where index % 3 == 0
    let cancelled_indices = [NO_REFERENCE_ROUND as usize, NO_OUTCOME_ROUND as usize];
    match style {
        Style::Occasional(_) => cancelled_indices.iter().filter(|i| *i % 3 == 0).count() as u32,
        _ => cancelled_indices.len() as u32,
    }
}
