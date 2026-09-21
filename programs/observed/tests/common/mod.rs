//! Shared test harness: LiteSVM with the real mainnet SGT fixtures, a controllable clock,
//! synthetic-but-typed Pyth updates, and a real 64-leaf calendar.
#![allow(dead_code)]
use {
    anchor_lang::solana_program::{instruction::Instruction, system_program},
    anchor_lang::{
        prelude::Pubkey, AnchorSerialize, Discriminator, InstructionData, ToAccountMetas,
    },
    base64::{engine::general_purpose::STANDARD as B64, Engine},
    litesvm::LiteSVM,
    observed::{RoundTerms, CALENDAR_LEAVES, LEAF_TAG, NODE_TAG},
    pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel},
    pythnet_sdk::messages::PriceFeedMessage,
    sha2::{Digest, Sha256},
    solana_account::Account,
    solana_clock::Clock,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    std::str::FromStr,
};

pub const TOKEN_2022: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
/// Pre-upgrade receiver. Accounts it owns must be refused by the `pro-compatible` build.
pub const PYTH_RECEIVER_OLD: &str = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
/// Upgraded push oracle: sponsored feed accounts are PDAs [shard_le_u16, feed_id] under it.
pub const PYTH_PUSH_ORACLE: &str = "pyt2F414BA6dPttK6RddPZUdHfapoBN24GL5wbrPCou";
pub const GAME_ID: u64 = 1;
/// W and A of rule O1 (DECISIONS 19.09.2026).
pub const WINDOW_SECS: u16 = 60;
pub const MAX_AGE_SECS: u16 = 60;
/// posted_slot written into every synthetic update, so tests can check it is recorded.
pub const POSTED_SLOT: u64 = 4_242;
/// 2026-09-17 00:00:00 UTC — commit window of round 0 opens here.
pub const DAY0: i64 = 1_789_603_200;
pub const COMMIT_CLOSE: i64 = DAY0 + 12 * 3600;
/// Reference two minutes after sealing closes (04:02 when sealing closes 04:00).
pub const REFERENCE_DELAY: i64 = 120;
pub const REFERENCE_TIME: i64 = COMMIT_CLOSE + REFERENCE_DELAY;
pub const OUTCOME_TIME: i64 = DAY0 + 24 * 3600;
pub const REVEAL_CLOSE: i64 = OUTCOME_TIME + 72 * 3600;
pub const RESOLVE_DEADLINE: i64 = OUTCOME_TIME + 24 * 3600;
pub const MAX_CONF_BPS: u16 = 50;
pub const OFFSET_BPS: i32 = 100; // +1 %
/// Measurement band: p90 of the measured spread per timestamp was 22.7 bps (SOL, W = A = 60 s),
/// rounded up to 25 (docs/spikes/baserate.md, HANDOFF 18.09.2026).
pub const BAND_BPS: u16 = 25;
/// Rolling close: 30 days after the reveal window, but never before the floor.
pub const CLOSE_AFTER_SECS: u32 = 30 * 24 * 3600;
/// Test floor, far enough out that the harness has to respect it (like 09.11. in season 1).
pub const EARLIEST_CLOSE_UNIX: i64 = DAY0 + 60 * 86_400;
/// When round 0's entry may be closed: the floor wins over the rolling delay here, exactly as
/// it does for the first rounds of season 1.
pub const CLOSABLE_TIME: i64 = EARLIEST_CLOSE_UNIX;
pub const SEASON: u16 = 1;

pub struct Env {
    pub svm: LiteSVM,
    pub payer: Keypair,
    pub player: Keypair,
    pub authority: Keypair,
    pub config: Pubkey,
    pub sgt_mint: Pubkey,
    pub sgt_token: Pubkey,
    pub feed_id: [u8; 32],
    /// The sponsored account named in the terms; synthetic updates are written here.
    pub price_account: Pubkey,
    pub kind: u8,
    pub offset_bps: i32,
    pub terms: RoundTerms,
    pub proof: Vec<[u8; 32]>,
    pub day0: i64,
    pub root: [u8; 32],
    pub proofs: Vec<Vec<[u8; 32]>>,
}

/// Reveal window length, mirrored from the program (used by the season test).
pub const REVEAL_WINDOW: i64 = 72 * 3600;

pub fn read_fixture(name: &str) -> (Pubkey, Pubkey, u64, Vec<u8>) {
    fixture(name)
}

fn fixture(name: &str) -> (Pubkey, Pubkey, u64, Vec<u8>) {
    let path = format!(
        "{}/../../tests/fixtures/{name}.json",
        env!("CARGO_MANIFEST_DIR")
    );
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let v: serde_json::Value = serde_json::from_str(&raw).expect("json");
    (
        Pubkey::from_str(v["pubkey"].as_str().expect("pubkey")).expect("b58"),
        Pubkey::from_str(v["owner"].as_str().expect("owner")).expect("b58"),
        v["lamports"].as_u64().expect("lamports"),
        B64.decode(v["data_base64"].as_str().expect("data"))
            .expect("b64"),
    )
}

pub fn put(svm: &mut LiteSVM, key: Pubkey, owner: Pubkey, lamports: u64, data: Vec<u8>) {
    svm.set_account(
        key,
        Account {
            lamports,
            data,
            owner,
            executable: false,
            rent_epoch: 0,
        },
    )
    .expect("set_account");
}

pub fn set_time(svm: &mut LiteSVM, unix_timestamp: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = unix_timestamp;
    svm.set_sysvar(&clock);
}

// ---------- calendar ----------
pub fn leaf(terms_hash: &[u8; 32]) -> [u8; 32] {
    Sha256::digest([&[LEAF_TAG][..], terms_hash].concat()).into()
}
fn node(l: &[u8; 32], r: &[u8; 32]) -> [u8; 32] {
    Sha256::digest([&[NODE_TAG][..], l, r].concat()).into()
}

/// The sponsored feed account of `feed_id` in the upgraded stack (shard 0).
pub fn feed_account(feed_id: &[u8; 32]) -> Pubkey {
    let push = Pubkey::from_str(PYTH_PUSH_ORACLE).expect("push oracle id");
    Pubkey::find_program_address(&[&0u16.to_le_bytes(), feed_id], &push).0
}

/// Terms of round `round_id` in a season that starts at `day0` (one round per day),
/// kind ABOVE with +1 % — the geometry most tests use.
pub fn terms_of(day0: i64, round_id: u32, feed_id: [u8; 32]) -> RoundTerms {
    terms_rule(day0, round_id, feed_id, observed::KIND_ABOVE, OFFSET_BPS)
}

pub fn terms_rule(
    day0: i64,
    round_id: u32,
    feed_id: [u8; 32],
    kind: u8,
    offset_bps: i32,
) -> RoundTerms {
    let open = day0 + round_id as i64 * 86_400;
    RoundTerms {
        version: observed::TERMS_VERSION,
        kind,
        source_kind: observed::SOURCE_PRICE_ACCOUNT,
        feed_id,
        price_account: feed_account(&feed_id),
        offset_bps,
        max_conf_bps: MAX_CONF_BPS,
        band_bps: BAND_BPS,
        window_secs: WINDOW_SECS,
        max_age_secs: MAX_AGE_SECS,
        close_after_secs: CLOSE_AFTER_SECS,
        earliest_close_unix: EARLIEST_CLOSE_UNIX,
        commit_open: open,
        commit_close: open + 12 * 3600,
        reference_time: open + 12 * 3600 + REFERENCE_DELAY,
        outcome_time: open + 24 * 3600,
    }
}

/// A full season: 64 leaves, one per round, with a proof for each.
pub fn season_tree(day0: i64, feed_id: [u8; 32]) -> ([u8; 32], Vec<Vec<[u8; 32]>>) {
    season_tree_rule(day0, feed_id, observed::KIND_ABOVE, OFFSET_BPS)
}

pub fn season_tree_rule(
    day0: i64,
    feed_id: [u8; 32],
    kind: u8,
    offset_bps: i32,
) -> ([u8; 32], Vec<Vec<[u8; 32]>>) {
    let leaves: Vec<[u8; 32]> = (0..CALENDAR_LEAVES)
        .map(|i| leaf(&terms_rule(day0, i, feed_id, kind, offset_bps).hash(SEASON, i)))
        .collect();
    let mut levels = vec![leaves];
    while levels[levels.len() - 1].len() > 1 {
        let prev = levels[levels.len() - 1].clone();
        let next: Vec<[u8; 32]> = prev.chunks(2).map(|p| node(&p[0], &p[1])).collect();
        levels.push(next);
    }
    let root = levels[levels.len() - 1][0];
    let proofs = (0..CALENDAR_LEAVES as usize)
        .map(|index| {
            let mut idx = index;
            let mut proof = Vec::new();
            for level in levels.iter().take(levels.len() - 1) {
                proof.push(level[idx ^ 1]);
                idx /= 2;
            }
            proof
        })
        .collect();
    (root, proofs)
}

/// Single-leaf tree helper (used where a deliberately different root is needed).
pub fn calendar(terms_hash: &[u8; 32], index: u32) -> ([u8; 32], Vec<[u8; 32]>) {
    let empty = leaf(&[0u8; 32]);
    let mut level: Vec<[u8; 32]> = (0..CALENDAR_LEAVES)
        .map(|i| if i == index { leaf(terms_hash) } else { empty })
        .collect();
    let mut proof = Vec::new();
    let mut idx = index as usize;
    while level.len() > 1 {
        proof.push(level[idx ^ 1]);
        level = level.chunks(2).map(|p| node(&p[0], &p[1])).collect();
        idx /= 2;
    }
    (level[0], proof)
}

// ---------- pyth ----------
pub fn price_update(
    feed_id: [u8; 32],
    price: i64,
    conf: u64,
    exponent: i32,
    publish_time: i64,
    prev_publish_time: i64,
    level: VerificationLevel,
) -> Vec<u8> {
    let acc = PriceUpdateV2 {
        write_authority: Pubkey::new_unique(),
        verification_level: level,
        price_message: PriceFeedMessage {
            feed_id,
            price,
            conf,
            exponent,
            publish_time,
            prev_publish_time,
            ema_price: price,
            ema_conf: conf,
        },
        posted_slot: POSTED_SLOT,
    };
    let mut data = PriceUpdateV2::DISCRIMINATOR.to_vec();
    acc.serialize(&mut data).expect("serialize");
    data
}

/// Write `data` into the round's named account, owned by the upgraded receiver — like the
/// sponsor overwriting the one account again and again.
pub fn put_price_update(env: &mut Env, data: Vec<u8>) -> Pubkey {
    let key = env.price_account;
    put_price_update_at(env, key, data)
}

pub fn put_price_update_at(env: &mut Env, key: Pubkey, data: Vec<u8>) -> Pubkey {
    put(
        &mut env.svm,
        key,
        pyth_solana_receiver_sdk::ID,
        10_000_000,
        data,
    );
    key
}

/// The happy-path reference update: published exactly at the reference time, price 150.00.
pub fn reference_update(env: &mut Env) -> Pubkey {
    let data = price_update(
        env.feed_id,
        15_000_000_000,
        100_000,
        -8,
        REFERENCE_TIME,
        REFERENCE_TIME - 1,
        VerificationLevel::Full,
    );
    put_price_update(env, data)
}
/// A reading at an arbitrary time — for tests that play more than one round.
pub fn update_at(env: &mut Env, price: i64, at: i64) -> Pubkey {
    let data = price_update(
        env.feed_id,
        price,
        100_000,
        -8,
        at,
        at - 1,
        VerificationLevel::Full,
    );
    put_price_update(env, data)
}

/// Outcome update: `price` in the same 1e-8 scale, exactly at the outcome time.
pub fn outcome_update(env: &mut Env, price: i64) -> Pubkey {
    let data = price_update(
        env.feed_id,
        price,
        100_000,
        -8,
        OUTCOME_TIME,
        OUTCOME_TIME - 1,
        VerificationLevel::Full,
    );
    put_price_update(env, data)
}

// ---------- pdas ----------
pub fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"config", &GAME_ID.to_le_bytes()], &observed::id()).0
}
pub fn round_pda(round_id: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[b"round", config_pda().as_ref(), &round_id.to_le_bytes()],
        &observed::id(),
    )
    .0
}
pub fn entry_pda(round: Pubkey, mint: Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"entry", round.as_ref(), mint.as_ref()], &observed::id()).0
}
pub fn player_pda(mint: Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"player", config_pda().as_ref(), mint.as_ref()],
        &observed::id(),
    )
    .0
}

// ---------- transactions ----------

/// Builds the instructions first, then sends: keeps `&env` and `&mut env` apart.
#[macro_export]
macro_rules! sendx {
    ($env:expr, $signer:expr, [$($ix:expr),+ $(,)?]) => {{
        let ixs = [$($ix),+];
        $crate::common::send(&mut $env, $signer, &ixs)
    }};
}

pub fn send(env: &mut Env, signer: &Keypair, ixs: &[Instruction]) -> Result<u64, String> {
    env.svm.expire_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&signer.pubkey()), &env.svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).expect("sign");
    env.svm
        .send_transaction(tx)
        .map(|m| m.compute_units_consumed)
        .map_err(|f| format!("{:?}\n{}", f.err, f.meta.logs.join("\n")))
}

pub fn expect_err(res: Result<u64, String>, needle: &str) {
    match res {
        Ok(cu) => panic!("expected failure containing {needle:?}, got success ({cu} CU)"),
        Err(logs) => assert!(
            logs.contains(needle),
            "expected {needle:?} in logs:\n{logs}"
        ),
    }
}

pub fn ix_initialize(payer: &Pubkey, authority: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::Initialize {
            game_id: GAME_ID,
            calendar_authority: *authority,
            pause_authority: *authority,
        }
        .data(),
        observed::accounts::Initialize {
            payer: *payer,
            config: config_pda(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

pub fn ix_publish_calendar(authority: &Pubkey, root: [u8; 32], leaf_count: u32) -> Instruction {
    ix_publish_calendar_for(authority, root, leaf_count, SEASON)
}

pub fn ix_publish_calendar_for(
    authority: &Pubkey,
    root: [u8; 32],
    leaf_count: u32,
    season: u16,
) -> Instruction {
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::PublishCalendar {
            season,
            calendar_root: root,
            leaf_count,
        }
        .data(),
        observed::accounts::PublishCalendar {
            calendar_authority: *authority,
            config: config_pda(),
        }
        .to_account_metas(None),
    )
}

pub fn ix_create_round(
    payer: &Pubkey,
    round_id: u32,
    terms: RoundTerms,
    proof: Vec<[u8; 32]>,
) -> Instruction {
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::CreateRound {
            round_id,
            terms,
            merkle_proof: proof,
        }
        .data(),
        observed::accounts::CreateRound {
            payer: *payer,
            config: config_pda(),
            round: round_pda(round_id),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

pub fn ix_commit(env: &Env, round_id: u32, commitment: [u8; 32]) -> Instruction {
    let round = round_pda(round_id);
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::Commit { commitment }.data(),
        observed::accounts::Commit {
            player_wallet: env.player.pubkey(),
            sgt_mint: env.sgt_mint,
            sgt_token_account: env.sgt_token,
            config: config_pda(),
            round,
            entry: entry_pda(round, env.sgt_mint),
            player: player_pda(env.sgt_mint),
            token_program: Pubkey::from_str(TOKEN_2022).expect("t22"),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

pub fn ix_reveal(env: &Env, round_id: u32, p_bps: u16, salt: [u8; 32]) -> Instruction {
    let round = round_pda(round_id);
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::Reveal { p_bps, salt }.data(),
        observed::accounts::Reveal {
            beneficiary: env.player.pubkey(),
            config: config_pda(),
            round,
            entry: entry_pda(round, env.sgt_mint),
            player: player_pda(env.sgt_mint),
        }
        .to_account_metas(None),
    )
}

pub fn ix_set_reference(env: &Env, round_id: u32, price_update: Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::SetReference {}.data(),
        observed::accounts::SetReference {
            referencer: env.payer.pubkey(),
            config: config_pda(),
            round: round_pda(round_id),
            price_update,
        }
        .to_account_metas(None),
    )
}

pub fn ix_resolve(env: &Env, round_id: u32, price_update: Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::Resolve {}.data(),
        observed::accounts::Resolve {
            resolver: env.payer.pubkey(),
            config: config_pda(),
            round: round_pda(round_id),
            price_update,
        }
        .to_account_metas(None),
    )
}

pub fn ix_score(env: &Env, round_id: u32) -> Instruction {
    let round = round_pda(round_id);
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::ScoreEntry {}.data(),
        observed::accounts::ScoreEntry {
            config: config_pda(),
            round,
            entry: entry_pda(round, env.sgt_mint),
            player: player_pda(env.sgt_mint),
        }
        .to_account_metas(None),
    )
}

pub fn ix_cancel(round_id: u32) -> Instruction {
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::CancelRound {}.data(),
        observed::accounts::CancelRound {
            config: config_pda(),
            round: round_pda(round_id),
        }
        .to_account_metas(None),
    )
}

/// Closing is permissionless; `payer` may be anyone, the rent always goes to the entry's wallet.
pub fn ix_close_entry_by(
    env: &Env,
    round_id: u32,
    payer: Pubkey,
    refund_to: Pubkey,
) -> Instruction {
    let round = round_pda(round_id);
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::CloseEntry {}.data(),
        observed::accounts::CloseEntry {
            payer,
            rent_refund_to: refund_to,
            config: config_pda(),
            round,
            entry: entry_pda(round, env.sgt_mint),
        }
        .to_account_metas(None),
    )
}

pub fn ix_close_entry(env: &Env, round_id: u32) -> Instruction {
    let round = round_pda(round_id);
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::CloseEntry {}.data(),
        observed::accounts::CloseEntry {
            payer: env.player.pubkey(),
            rent_refund_to: env.player.pubkey(),
            config: config_pda(),
            round,
            entry: entry_pda(round, env.sgt_mint),
        }
        .to_account_metas(None),
    )
}

pub fn ix_pause(env: &Env, flag: bool) -> Instruction {
    Instruction::new_with_bytes(
        observed::id(),
        &observed::instruction::Pause { flag }.data(),
        observed::accounts::Pause {
            pause_authority: env.authority.pubkey(),
            config: config_pda(),
        }
        .to_account_metas(None),
    )
}

// ---------- setup ----------
/// LiteSVM with the program, the real SGT fixtures (owner patched to our test player),
/// config + calendar + round 0 created, clock inside the commit window.
pub fn setup() -> Env {
    setup_day(DAY0)
}

/// Same, but the round's windows are built around `day0` (commit open at day0, outcome +24 h).
pub fn setup_day(day0: i64) -> Env {
    setup_with(day0, observed::KIND_ABOVE, OFFSET_BPS)
}

/// Config and calendar only, with a root that comes from outside (the real season file).
/// No rounds, no SGT for the harness player — the caller builds its own devices.
pub fn setup_bare(now: i64, root: [u8; 32], season: u16) -> Env {
    let mut env = setup_with(now, observed::KIND_MOVE, 200);
    // setup_with published its own calendar and created round 0; start over on a fresh svm
    let mut fresh = LiteSVM::new();
    let so = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/observed.so"
    ));
    fresh.add_program(observed::id(), so).expect("add_program");
    for k in [&env.payer, &env.authority] {
        fresh
            .airdrop(&k.pubkey(), 100_000_000_000)
            .expect("airdrop");
    }
    env.svm = fresh;
    env.root = root;
    set_time(&mut env.svm, now);
    let payer = env.payer.insecure_clone();
    let authority = env.authority.insecure_clone();
    let payer_pk = payer.pubkey();
    let auth_pk = authority.pubkey();
    sendx!(env, &payer, [ix_initialize(&payer_pk, &auth_pk)]).expect("initialize");
    sendx!(
        env,
        &authority,
        [ix_publish_calendar_for(
            &auth_pk,
            root,
            CALENDAR_LEAVES,
            season
        )]
    )
    .expect("publish_calendar");
    env
}

/// A season whose every round has question kind `kind` and offset `offset_bps`.
pub fn setup_with(day0: i64, kind: u8, offset_bps: i32) -> Env {
    let mut svm = LiteSVM::new();
    let so = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/observed.so"
    ));
    svm.add_program(observed::id(), so).expect("add_program");

    let (group_key, t22, group_lamports, group_data) = fixture("sgt/sgt-group");
    let (mint_key, _, mint_lamports, mint_data) = fixture("sgt/sgt-mint");
    let (token_key, _, token_lamports, mut token_data) = fixture("sgt/sgt-token-account");
    let player = Keypair::new_from_array([3u8; 32]);
    token_data[32..64].copy_from_slice(player.pubkey().as_ref()); // token owner = our test player
    put(&mut svm, group_key, t22, group_lamports, group_data);
    put(&mut svm, mint_key, t22, mint_lamports, mint_data);
    put(&mut svm, token_key, t22, token_lamports, token_data);

    // seed [1;32] → AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9 = DEPLOY_AUTHORITY (non-mainnet build)
    let payer = Keypair::new_from_array([1u8; 32]);
    let authority = Keypair::new_from_array([2u8; 32]);
    for k in [&payer, &authority, &player] {
        svm.airdrop(&k.pubkey(), 10_000_000_000).expect("airdrop");
    }

    let feed_id: [u8; 32] =
        hex_to_32("ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d");
    let terms = terms_rule(day0, 0, feed_id, kind, offset_bps);
    let (root, proofs) = season_tree_rule(day0, feed_id, kind, offset_bps);
    let proof = proofs[0].clone();

    let mut env = Env {
        svm,
        payer,
        player,
        authority,
        config: config_pda(),
        sgt_mint: mint_key,
        sgt_token: token_key,
        feed_id,
        price_account: feed_account(&feed_id),
        kind,
        offset_bps,
        terms,
        proof: proof.clone(),
        day0,
        root,
        proofs,
    };
    set_time(&mut env.svm, day0 + 60);
    let payer_pk = env.payer.pubkey();
    let auth_pk = env.authority.pubkey();
    let payer = env.payer.insecure_clone();
    let authority = env.authority.insecure_clone();
    sendx!(env, &payer, [ix_initialize(&payer_pk, &auth_pk)]).expect("initialize");
    sendx!(
        env,
        &authority,
        [ix_publish_calendar(&auth_pk, root, CALENDAR_LEAVES)]
    )
    .expect("publish_calendar");
    sendx!(
        env,
        &payer,
        [ix_create_round(&payer_pk, 0, env.terms, proof)]
    )
    .expect("create_round");
    env
}

pub fn hex_to_32(s: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    for (i, b) in out.iter_mut().enumerate() {
        *b = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).expect("hex");
    }
    out
}

pub fn commitment(env: &Env, round_id: u32, p_bps: u16, salt: [u8; 32]) -> [u8; 32] {
    observed::commitment_hash(
        &round_pda(round_id),
        &env.terms.hash(SEASON, round_id),
        &env.sgt_mint,
        &env.player.pubkey(),
        p_bps,
        &salt,
    )
}

pub fn read_config(env: &Env) -> observed::Config {
    let acc = env.svm.get_account(&config_pda()).expect("config account");
    anchor_lang::AccountDeserialize::try_deserialize(&mut acc.data.as_slice()).expect("config")
}
pub fn read_round(env: &Env, round_id: u32) -> observed::Round {
    let acc = env
        .svm
        .get_account(&round_pda(round_id))
        .expect("round account");
    anchor_lang::AccountDeserialize::try_deserialize(&mut acc.data.as_slice()).expect("round")
}
pub fn read_entry(env: &Env, round_id: u32) -> Option<observed::Entry> {
    let acc = env
        .svm
        .get_account(&entry_pda(round_pda(round_id), env.sgt_mint))?;
    if acc.data.is_empty() {
        return None;
    }
    anchor_lang::AccountDeserialize::try_deserialize(&mut acc.data.as_slice()).ok()
}
pub fn read_entry_for(env: &Env, round_id: u32, mint: Pubkey) -> Option<observed::Entry> {
    let acc = env.svm.get_account(&entry_pda(round_pda(round_id), mint))?;
    if acc.data.is_empty() {
        return None;
    }
    anchor_lang::AccountDeserialize::try_deserialize(&mut acc.data.as_slice()).ok()
}

pub fn read_player_for(env: &Env, mint: Pubkey) -> observed::Player {
    let acc = env
        .svm
        .get_account(&player_pda(mint))
        .expect("player account");
    anchor_lang::AccountDeserialize::try_deserialize(&mut acc.data.as_slice()).expect("player")
}

pub fn read_player(env: &Env) -> observed::Player {
    let acc = env
        .svm
        .get_account(&player_pda(env.sgt_mint))
        .expect("player account");
    anchor_lang::AccountDeserialize::try_deserialize(&mut acc.data.as_slice()).expect("player")
}

/// Put a fixture account on chain unchanged (used for the real mainnet Pyth update).
pub fn put_fixture_account(env: &mut Env, name: &str) -> Pubkey {
    let (key, owner, lamports, data) = fixture(name);
    put(&mut env.svm, key, owner, lamports, data);
    key
}

/// Put a fixture's bytes at another address, optionally with another owner.
pub fn put_fixture_account_at(env: &mut Env, name: &str, key: Pubkey, owner: Option<Pubkey>) {
    let (_, fixture_owner, lamports, data) = fixture(name);
    put(
        &mut env.svm,
        key,
        owner.unwrap_or(fixture_owner),
        lamports,
        data,
    );
}
