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
const NO_REFERENCE_ROUND: u32 = 5; // nobody takes the reference → NO_RESOLVE
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
    /// Seals every day, but its reveal does not go through for two days (no SOL, a crash, a
    /// cancelled approval) and is caught up on the third — the only way a device really carries
    /// three open rounds at once, and the case the 72 h window exists for (E10, 21.09.2026).
    Late(u16),
}

impl Style {
    fn p_bps(&self) -> u16 {
        match self {
            Style::Diligent(v) | Style::Forgetful(v) | Style::Occasional(v) | Style::Late(v) => *v,
        }
    }
    /// Does this device seal on this day?
    fn seals(&self, day: usize) -> bool {
        match self {
            Style::Occasional(_) => day.is_multiple_of(3),
            _ => true,
        }
    }
    /// Does it open the app on this day at all? (No app, no seal and no reveal.)
    fn opens(&self, day: usize) -> bool {
        match self {
            Style::Occasional(_) => day.is_multiple_of(3),
            _ => true,
        }
    }
    /// Does the reveal part of today's transaction go through?
    fn reveals_today(&self, day: usize) -> bool {
        match self {
            Style::Late(_) => day.is_multiple_of(3),
            _ => true,
        }
    }
    /// Of the rounds still open, which does it reveal today?
    fn reveals(&self, round_index: usize) -> bool {
        match self {
            Style::Forgetful(_) => round_index.is_multiple_of(2),
            _ => true,
        }
    }
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
            2 => Style::Late(6_000),
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
    // commits, reveals, missing, score_sum, seals that fell into a cancelled round
    let mut expected: BTreeMap<usize, (u32, u32, u32, u64, u32)> = BTreeMap::new();
    let mut cancelled = 0usize;
    let mut resolved = 0usize;
    let mut close_calls = 0usize;
    let mut cu_total: u64 = 0;
    let mut biggest_daily_batch = 0usize;

    let terms_at = |i: usize| terms_from(&rounds[i]);
    let proof_at = |i: usize| -> Vec<[u8; 32]> {
        rounds[i]["proof"]
            .as_array()
            .expect("proof")
            .iter()
            .map(|p| hex_to_32(p.as_str().expect("hex")))
            .collect()
    };
    // Both readings of a round are fixed up front, so reference and outcome agree.
    let reference_price = |i: usize| 15_000_000_000i64 + (i as i64 % 7) * 10_000_000;
    let outcome_price = |i: usize| {
        let reference = reference_price(i);
        let t = terms_at(i);
        if i as u32 == CLOSE_CALL_ROUND {
            // one unit past the bar: decided, but inside the measurement band
            reference + reference * (t.offset_bps as i64 + 1) / 10_000 + 1
        } else if i.is_multiple_of(2) {
            reference + reference * (t.offset_bps as i64 + 120) / 10_000 // clear Yes
        } else if t.kind == observed::KIND_MOVE {
            reference + reference / 10_000 // moved far too little: clear No
        } else {
            reference - reference * 120 / 10_000 // clearly lower: clear No
        }
    };

    let mut is_resolved = vec![false; rounds.len()];
    let mut is_cancelled = vec![false; rounds.len()];
    let mut sealed = vec![vec![false; PLAYERS]; rounds.len()];
    let mut pending: Vec<Vec<usize>> = vec![Vec::new(); PLAYERS]; // sealed, not revealed yet

    // A day at a time, clock strictly forward — the same order the real season runs in:
    // 16:00 yesterday's outcome, 16:05 the players' one approval, 04:02 the reference,
    // and three days later the scoring of what nobody revealed.
    // Four extra days at the end drain the tail.
    for day in 0..rounds.len() + 4 {
        let open = first.commit_open + day as i64 * 86_400;

        // --- the owner creates the round before its window opens
        if day < rounds.len() {
            set_time(&mut env.svm, open - 60);
            cu_total += sendx!(
                env,
                &payer,
                [ix_create_round(&payer_pk, day as u32, terms_at(day), proof_at(day))]
            )
            .unwrap_or_else(|e| panic!("create_round {day}: {e}"));
        }

        // --- 16:00: yesterday's round gets its outcome reading
        if day >= 1 && day - 1 < rounds.len() {
            let y = day - 1;
            let yt = terms_at(y);
            if y as u32 != NO_REFERENCE_ROUND && y as u32 != NO_OUTCOME_ROUND {
                set_time(&mut env.svm, yt.outcome_time + 2);
                let upd = reading_at(
                    &mut env,
                    yt.feed_id,
                    yt.price_account,
                    outcome_price(y),
                    yt.outcome_time,
                );
                cu_total += sendx!(env, &payer, [ix_resolve(&env, y as u32, upd)])
                    .unwrap_or_else(|e| panic!("resolve {y}: {e}"));
                is_resolved[y] = true;
                resolved += 1;
                let round = read_round(&env, y as u32);
                if round.outcome_margin_bps.abs() <= i32::from(round.band_bps) {
                    close_calls += 1;
                }
            }
        }

        // --- 16:05: one approval per device — reveal what is open, seal today
        set_time(&mut env.svm, open + 300);
        for (i, p) in players.iter().enumerate() {
            if !p.style.opens(day) {
                continue;
            }
            let mut ixs: Vec<Instruction> = Vec::new();
            let mut revealing: Vec<usize> = Vec::new();
            // every round still inside its 72 h window, oldest first
            let mut still_pending: Vec<usize> = Vec::new();
            for &r in pending[i].iter() {
                let rt = terms_at(r);
                let open_for_reveal = is_resolved[r]
                    && open + 300 >= rt.outcome_time
                    && open + 300 < rt.outcome_time + REVEAL_WINDOW;
                if is_cancelled[r] {
                    continue; // a cancelled round is never revealed and never scored
                }
                if open_for_reveal && p.style.reveals_today(day) && p.style.reveals(r) {
                    ixs.push(ix_reveal_for(p, r as u32, p.style.p_bps(), salt));
                    revealing.push(r);
                } else if open + 300 < rt.outcome_time + REVEAL_WINDOW {
                    still_pending.push(r); // window still open, comes back tomorrow
                }
                // anything else: the window closed, it will be scored as missing
            }
            pending[i] = still_pending;

            let seals_today = day < rounds.len() && p.style.seals(day);
            if seals_today {
                let t = terms_at(day);
                let commitment = observed::commitment_hash(
                    &round_pda(day as u32),
                    &t.hash(season_no, day as u32),
                    &p.mint,
                    &p.wallet.pubkey(),
                    p.style.p_bps(),
                    &salt,
                );
                ixs.push(ix_commit_for(p, day as u32, commitment));
            }
            if ixs.is_empty() {
                continue;
            }
            biggest_daily_batch = biggest_daily_batch.max(revealing.len());
            // ONE transaction, ONE approval: everything this device does today
            cu_total += send(&mut env, &p.wallet, &ixs)
                .unwrap_or_else(|e| panic!("daily tx day {day} p{i}: {e}"));
            let e = expected.entry(i).or_default();
            e.1 += revealing.len() as u32;
            if seals_today {
                e.0 += 1;
                sealed[day][i] = true;
                pending[i].push(day);
            }
        }

        // --- 04:02 the next morning: the reference for today's round
        if day < rounds.len() && day as u32 != NO_REFERENCE_ROUND {
            let t = terms_at(day);
            set_time(&mut env.svm, t.reference_time + 2);
            let upd = reading_at(
                &mut env,
                t.feed_id,
                t.price_account,
                reference_price(day),
                t.reference_time,
            );
            cu_total += sendx!(env, &payer, [ix_set_reference(&env, day as u32, upd)])
                .unwrap_or_else(|e| panic!("set_reference {day}: {e}"));
        }

        // --- the resolver's housekeeping, later the same day
        if day >= 1 && day - 1 < rounds.len() {
            let y = day - 1;
            if !is_resolved[y] {
                set_time(&mut env.svm, open + 13 * 3600);
                cu_total += sendx!(env, &payer, [ix_cancel(y as u32)])
                    .unwrap_or_else(|e| panic!("cancel {y}: {e}"));
                assert_eq!(read_round(&env, y as u32).status, RoundStatus::Cancelled as u8);
                is_cancelled[y] = true;
                cancelled += 1;
                for (i, seal) in sealed[y].iter().enumerate() {
                    if *seal {
                        expected.entry(i).or_default().4 += 1;
                    }
                }
            }
        }
        // --- scoring: only once the 72 h window of that round is over
        if day >= 4 {
            let r = day - 4;
            if r < rounds.len() && is_resolved[r] {
                let rt = terms_at(r);
                set_time(&mut env.svm, rt.outcome_time + REVEAL_WINDOW + 60);
                let round = read_round(&env, r as u32);
                let yes = round.outcome == observed::Outcome::Yes as u8;
                for (i, p) in players.iter().enumerate() {
                    if !sealed[r][i] {
                        continue;
                    }
                    cu_total += sendx!(env, &payer, [ix_score_for(p, r as u32)])
                        .unwrap_or_else(|e| panic!("score r{r} p{i}: {e}"));
                    let entry = read_entry_for(&env, r as u32, p.mint).expect("entry");
                    let e = expected.entry(i).or_default();
                    if entry.scored_as_missing {
                        e.2 += 1;
                    }
                    e.3 += u64::from(entry.score_bps);
                    let want = if entry.revealed {
                        observed::brier_score_bps(p.style.p_bps(), yes).expect("score")
                    } else {
                        observed::MISSING_SCORE_BPS
                    };
                    assert_eq!(entry.score_bps, want, "score r{r} p{i}");
                }
            }
        }
    }

    // ---- what the record says at the end of the season
    assert_eq!(
        resolved + cancelled,
        64,
        "every round reached a final state"
    );
    assert_eq!(cancelled, 2, "the two scripted NO_RESOLVE rounds");
    assert_eq!(close_calls, 1, "exactly the scripted close round is inside the band");
    assert_eq!(
        biggest_daily_batch, 3,
        "the 72 h window really produced three reveals in one approval"
    );

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
            want.0 - want.4,
            "scored rounds p{i} (commits minus the seals in cancelled rounds)"
        );
        total_entries += player.commits;
    }
    assert_eq!(
        revealed_only_checked, PLAYERS,
        "the revealed-only diagnosis is derivable for every device from Player alone"
    );

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
         {closed} entries closed rolling, {:.3} SOL back to the players (expected {:.3}); \
         biggest daily batch: {biggest_daily_batch} reveals + one seal in one approval",
        round_rent as f64 / 1e9,
        player_rent as f64 / 1e9,
        refunded as f64 / 1e9,
        entry_rent as f64 / 1e9,
    );
}

