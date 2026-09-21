//! Test vectors across the language border, for the app.
//!
//! The app has to compute three things exactly like the program, or nobody can ever reveal:
//! the commitment, the PDAs, and the per-round salt. Rust writes the vectors here, the app's
//! tests read the same file. If anyone changes a hash input on either side, the other side
//! goes red — that is the whole point of this file.
use anchor_lang::prelude::Pubkey;
use solana_sha256_hasher::hashv;

mod common;
use common::*;

/// Domain for the per-round salt. The program never sees a salt before the reveal, so this is
/// the app's rule — but it is pinned here so both sides of a future rewrite agree.
/// salt(round) = sha256("observed/salt/v1" || secret || round_id_le)
const SALT_DOMAIN: &[u8] = b"observed/salt/v1";

fn salt_for(secret: &[u8; 32], round_id: u32) -> [u8; 32] {
    hashv(&[SALT_DOMAIN, secret, &round_id.to_le_bytes()]).to_bytes()
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[test]
fn write_vectors_for_the_app() {
    let season = SEASON;
    let secret = [0x5au8; 32];
    let mint = Pubkey::new_from_array([0x11u8; 32]);
    let beneficiary = Pubkey::new_from_array([0x22u8; 32]);

    // the real terms of the season, so the app is checked against what will actually run
    let season_file: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(format!(
            "{}/../../tests/fixtures/calendar/season1.json",
            env!("CARGO_MANIFEST_DIR")
        ))
        .expect("season file"),
    )
    .expect("season json");
    let rounds = season_file["rounds"].as_array().expect("rounds");

    let mut commitments = Vec::new();
    for (round_id, p_bps) in [(0u32, 0u16), (11, 8_000), (41, 5_000), (63, 10_000)] {
        let r = &rounds[round_id as usize];
        let terms_hash = hex_to_32(r["termsHash"].as_str().expect("termsHash"));
        let round = round_pda(round_id);
        let salt = salt_for(&secret, round_id);
        commitments.push(serde_json::json!({
            "round_id": round_id,
            "round_pda": round.to_string(),
            "terms_hash": hex(&terms_hash),
            "sgt_mint": mint.to_string(),
            "beneficiary": beneficiary.to_string(),
            "p_bps": p_bps,
            "salt": hex(&salt),
            "commitment": hex(&observed::commitment_hash(
                &round, &terms_hash, &mint, &beneficiary, p_bps, &salt,
            )),
            // what the app shows next to it, so the UI cannot drift either
            "brier_bps_if_yes": observed::brier_score_bps(p_bps, true).expect("brier"),
            "brier_bps_if_no": observed::brier_score_bps(p_bps, false).expect("brier"),
        }));
    }

    let json = serde_json::json!({
        "note": "Written by programs/observed/tests/vectors.rs. The app decodes and recomputes these.",
        "program_id": observed::id().to_string(),
        "commit_domain": String::from_utf8_lossy(observed::COMMIT_DOMAIN),
        "salt_domain": String::from_utf8_lossy(SALT_DOMAIN),
        "season": season,
        "game_id": GAME_ID,
        "secret_hex": hex(&secret),
        "pdas": {
            "config": config_pda().to_string(),
            "round_0": round_pda(0).to_string(),
            "round_11": round_pda(11).to_string(),
            "entry_round_11": entry_pda(round_pda(11), mint).to_string(),
            "player": player_pda(mint).to_string(),
        },
        "salts": (0..4u32)
            .map(|r| serde_json::json!({ "round_id": r, "salt": hex(&salt_for(&secret, r)) }))
            .collect::<Vec<_>>(),
        "commitments": commitments,
    });

    let dir = format!(
        "{}/../../tests/fixtures/generated",
        env!("CARGO_MANIFEST_DIR")
    );
    std::fs::create_dir_all(&dir).expect("dir");
    std::fs::write(
        format!("{dir}/app-vectors.json"),
        format!("{}\n", serde_json::to_string_pretty(&json).expect("json")),
    )
    .expect("write");
}

/// The salt rule itself: same secret and round always give the same salt, different rounds
/// never do. If this ever changes, every open answer in the wild becomes unrevealable.
#[test]
fn the_salt_is_deterministic_and_round_specific() {
    let secret = [0x5au8; 32];
    assert_eq!(salt_for(&secret, 7), salt_for(&secret, 7));
    assert_ne!(salt_for(&secret, 7), salt_for(&secret, 8));
    let other = [0x5bu8; 32];
    assert_ne!(salt_for(&secret, 7), salt_for(&other, 7));
}

/// The other two account types the app decodes. `Round` and `Entry` already have fixtures
/// (round-layout.json, entry-layout.json); these two complete the set.
#[test]
fn write_account_fixtures_for_the_app() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    sendx!(
        env,
        &player,
        [ix_commit(&env, 0, commitment(&env, 0, 7_500, [3u8; 32]))]
    )
    .expect("commit");

    let config_account = env.svm.get_account(&config_pda()).expect("config");
    let config = read_config(&env);
    let player_account = env
        .svm
        .get_account(&player_pda(env.sgt_mint))
        .expect("player account");
    let player_state = read_player_for(&env, env.sgt_mint);

    let json = serde_json::json!({
        "note": "Written by programs/observed/tests/vectors.rs. The app decodes these with its own offsets.",
        "config": {
            "pubkey": config_pda().to_string(),
            "data_base64": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &config_account.data),
            "expected": {
                "version": config.version,
                "game_id": config.game_id,
                "calendar_authority": config.calendar_authority.to_string(),
                "pause_authority": config.pause_authority.to_string(),
                "paused": config.paused,
                "next_round_id": config.next_round_id,
                "season": config.season,
                "calendar_root": hex(&config.calendar_root),
                "first_round_id": config.first_round_id,
                "max_round_id": config.max_round_id,
                "size": config_account.data.len(),
            }
        },
        "player": {
            "pubkey": player_pda(env.sgt_mint).to_string(),
            "data_base64": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &player_account.data),
            "expected": {
                "sgt_mint": player_state.sgt_mint.to_string(),
                "commits": player_state.commits,
                "reveals": player_state.reveals,
                "missing_scored": player_state.missing_scored,
                "score_sum": player_state.score_sum,
                "scored_rounds": player_state.scored_rounds,
                "size": player_account.data.len(),
            }
        },
    });
    let dir = format!(
        "{}/../../tests/fixtures/generated",
        env!("CARGO_MANIFEST_DIR")
    );
    std::fs::write(
        format!("{dir}/account-fixtures.json"),
        format!("{}\n", serde_json::to_string_pretty(&json).expect("json")),
    )
    .expect("write");
}

