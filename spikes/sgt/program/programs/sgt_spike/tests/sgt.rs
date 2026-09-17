//! Spike 2 tests: the SGT gate against a real mainnet SGT snapshot (tests/fixtures/sgt) and
//! mutated copies. The program uses the real mainnet constants; accounts are placed at their
//! real addresses in LiteSVM, so no per-cluster build is involved.
use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        InstructionData, ToAccountMetas,
    },
    base64::{engine::general_purpose::STANDARD as B64, Engine},
    litesvm::LiteSVM,
    sha2::{Digest, Sha256},
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    spl_token_2022_interface::{
        extension::{BaseStateWithExtensionsMut, StateWithExtensionsMut},
        state::{Account as SplAccount, Mint as SplMint},
    },
    spl_token_group_interface::state::TokenGroupMember,
    std::str::FromStr,
};

const TOKEN_2022: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const TOKEN_CLASSIC: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

struct Fixture {
    pubkey: Pubkey,
    owner: Pubkey,
    lamports: u64,
    data: Vec<u8>,
}

fn fixture(name: &str) -> Fixture {
    let path = format!(
        "{}/../../../../../tests/fixtures/sgt/{name}.json",
        env!("CARGO_MANIFEST_DIR")
    );
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let v: serde_json::Value = serde_json::from_str(&raw).expect("fixture json");
    Fixture {
        pubkey: Pubkey::from_str(v["pubkey"].as_str().expect("pubkey")).expect("pubkey b58"),
        owner: Pubkey::from_str(v["owner"].as_str().expect("owner")).expect("owner b58"),
        lamports: v["lamports"].as_u64().expect("lamports"),
        data: B64
            .decode(v["data_base64"].as_str().expect("data"))
            .expect("base64"),
    }
}

fn seed_keypair(label: &str) -> Keypair {
    let seed: [u8; 32] = Sha256::digest(label.as_bytes()).into();
    Keypair::new_from_array(seed)
}

struct Env {
    svm: LiteSVM,
    player: Keypair,
    mint: Fixture,
    token: Fixture,
}

fn put(svm: &mut LiteSVM, key: Pubkey, owner: Pubkey, lamports: u64, data: Vec<u8>) {
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

fn setup() -> Env {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/sgt_spike.so"
    ));
    svm.add_program(sgt_spike::id(), bytes)
        .expect("add_program");
    let group = fixture("sgt-group");
    let mint = fixture("sgt-mint");
    let token = fixture("sgt-token-account");
    put(
        &mut svm,
        group.pubkey,
        group.owner,
        group.lamports,
        group.data.clone(),
    );
    put(
        &mut svm,
        mint.pubkey,
        mint.owner,
        mint.lamports,
        mint.data.clone(),
    );
    put(
        &mut svm,
        token.pubkey,
        token.owner,
        token.lamports,
        token.data.clone(),
    );
    let player = seed_keypair("observed/test/sgt-owner");
    svm.airdrop(&player.pubkey(), 1_000_000_000)
        .expect("airdrop");
    Env {
        svm,
        player,
        mint,
        token,
    }
}

fn commit(
    env: &mut Env,
    signer: &Keypair,
    mint: Pubkey,
    token: Pubkey,
    token_program: Pubkey,
    round_id: u32,
) -> Result<u64, String> {
    let (entry, _) = Pubkey::find_program_address(
        &[b"entry", &round_id.to_le_bytes(), mint.as_ref()],
        &sgt_spike::id(),
    );
    let ix = Instruction::new_with_bytes(
        sgt_spike::id(),
        &sgt_spike::instruction::CommitProbe { round_id }.data(),
        sgt_spike::accounts::CommitProbe {
            player: signer.pubkey(),
            sgt_mint: mint,
            sgt_token_account: token,
            entry,
            token_program,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    // fresh blockhash per call, so an identical retry is a new transaction, not a duplicate
    env.svm.expire_blockhash();
    let msg =
        Message::new_with_blockhash(&[ix], Some(&signer.pubkey()), &env.svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).expect("sign");
    match env.svm.send_transaction(tx) {
        Ok(meta) => Ok(meta.compute_units_consumed),
        Err(failed) => Err(format!("{:?}\n{}", failed.err, failed.meta.logs.join("\n"))),
    }
}

fn t22() -> Pubkey {
    Pubkey::from_str(TOKEN_2022).expect("id")
}

fn expect_err(res: Result<u64, String>, needle: &str) {
    match res {
        Ok(cu) => panic!("expected failure containing {needle:?}, got success ({cu} CU)"),
        Err(logs) => assert!(
            logs.contains(needle),
            "expected {needle:?} in logs:\n{logs}"
        ),
    }
}

/// Mutate the mint fixture in place.
fn with_mint(env: &mut Env, f: impl FnOnce(&mut StateWithExtensionsMut<SplMint>)) {
    let mut data = env.mint.data.clone();
    {
        let mut state = StateWithExtensionsMut::<SplMint>::unpack(&mut data).expect("unpack mint");
        f(&mut state);
        state.pack_base();
    }
    put(
        &mut env.svm,
        env.mint.pubkey,
        env.mint.owner,
        env.mint.lamports,
        data,
    );
}

fn with_token(env: &mut Env, f: impl FnOnce(&mut StateWithExtensionsMut<SplAccount>)) {
    let mut data = env.token.data.clone();
    {
        let mut state =
            StateWithExtensionsMut::<SplAccount>::unpack(&mut data).expect("unpack token");
        f(&mut state);
        state.pack_base();
    }
    put(
        &mut env.svm,
        env.token.pubkey,
        env.token.owner,
        env.token.lamports,
        data,
    );
}

#[test]
fn fixture_is_a_frozen_real_sgt() {
    let env = setup();
    let mut data = env.token.data.clone();
    let token = StateWithExtensionsMut::<SplAccount>::unpack(&mut data).expect("unpack");
    assert_eq!(
        token.base.state,
        spl_token_2022_interface::state::AccountState::Frozen
    );
    assert_eq!(token.base.amount, 1);
}

#[test]
fn real_sgt_is_accepted_and_entry_is_created() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    let cu = commit(&mut env, &player, mint, token, t22(), 42).expect("real SGT must pass");
    println!("commit_probe with real SGT: {cu} CU");
}

#[test]
fn second_entry_with_same_mint_fails() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    commit(&mut env, &player, mint, token, t22(), 7).expect("first");
    expect_err(
        commit(&mut env, &player, mint, token, t22(), 7),
        "already in use",
    );
}

#[test]
fn migrated_sgt_cannot_vote_twice_in_same_round() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    commit(&mut env, &player, mint, token, t22(), 9).expect("first wallet");
    // Migration: same mint, token now owned by another wallet (old account would hold 0).
    let new_wallet = Keypair::new();
    env.svm
        .airdrop(&new_wallet.pubkey(), 1_000_000_000)
        .expect("airdrop");
    with_token(&mut env, |s| {
        s.base.owner = new_wallet.pubkey().to_bytes().into()
    });
    expect_err(
        commit(&mut env, &new_wallet, mint, token, t22(), 9),
        "already in use",
    );
    // Next round the migrated owner may commit normally.
    commit(&mut env, &new_wallet, mint, token, t22(), 10).expect("next round");
}

#[test]
fn wrong_group_fails() {
    let mut env = setup();
    with_mint(&mut env, |s| {
        let m = s.get_extension_mut::<TokenGroupMember>().expect("member");
        m.group = Pubkey::new_unique().to_bytes().into();
    });
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    expect_err(
        commit(&mut env, &player, mint, token, t22(), 1),
        "WrongGroup",
    );
}

#[test]
fn member_mint_mismatch_fails() {
    let mut env = setup();
    with_mint(&mut env, |s| {
        let m = s.get_extension_mut::<TokenGroupMember>().expect("member");
        m.mint = Pubkey::new_unique().to_bytes().into();
    });
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    expect_err(
        commit(&mut env, &player, mint, token, t22(), 1),
        "MemberMintMismatch",
    );
}

#[test]
fn wrong_mint_authority_fails() {
    let mut env = setup();
    with_mint(&mut env, |s| {
        s.base.mint_authority = Some(Pubkey::new_unique().to_bytes().into()).into()
    });
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    expect_err(
        commit(&mut env, &player, mint, token, t22(), 1),
        "WrongMintAuthority",
    );
}

#[test]
fn supply_not_one_fails() {
    let mut env = setup();
    with_mint(&mut env, |s| s.base.supply = 2);
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    expect_err(
        commit(&mut env, &player, mint, token, t22(), 1),
        "WrongSupply",
    );
}

#[test]
fn decimals_not_zero_fails() {
    let mut env = setup();
    with_mint(&mut env, |s| s.base.decimals = 1);
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    expect_err(
        commit(&mut env, &player, mint, token, t22(), 1),
        "WrongDecimals",
    );
}

#[test]
fn amount_zero_after_migration_fails() {
    let mut env = setup();
    with_token(&mut env, |s| s.base.amount = 0);
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    expect_err(
        commit(&mut env, &player, mint, token, t22(), 1),
        "WrongAmount",
    );
}

#[test]
fn foreign_owner_fails() {
    let mut env = setup();
    let stranger = Keypair::new();
    env.svm
        .airdrop(&stranger.pubkey(), 1_000_000_000)
        .expect("airdrop");
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    expect_err(
        commit(&mut env, &stranger, mint, token, t22(), 1),
        "ConstraintTokenOwner",
    );
}

#[test]
fn token_account_of_other_mint_fails() {
    let mut env = setup();
    with_token(&mut env, |s| {
        s.base.mint = Pubkey::new_unique().to_bytes().into()
    });
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    expect_err(
        commit(&mut env, &player, mint, token, t22(), 1),
        "ConstraintTokenMint",
    );
}

#[test]
fn mint_without_group_member_extension_fails() {
    let mut env = setup();
    // Same base mint (authority GT2z…, supply 1, decimals 0), but no extensions at all.
    let mut data = vec![0u8; 82];
    data.copy_from_slice(&env.mint.data[..82]);
    let key = Pubkey::new_unique();
    put(&mut env.svm, key, t22(), env.mint.lamports, data);
    let mut token = env.token.data.clone();
    token[..32].copy_from_slice(key.as_ref());
    let token_key = Pubkey::new_unique();
    put(&mut env.svm, token_key, t22(), env.token.lamports, token);
    let player = env.player.insecure_clone();
    expect_err(
        commit(&mut env, &player, key, token_key, t22(), 1),
        "NotAGroupMember",
    );
}

#[test]
fn accounts_owned_by_classic_token_program_fail() {
    let mut env = setup();
    let classic = Pubkey::from_str(TOKEN_CLASSIC).expect("id");
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    put(
        &mut env.svm,
        mint,
        classic,
        env.mint.lamports,
        env.mint.data.clone(),
    );
    put(
        &mut env.svm,
        token,
        classic,
        env.token.lamports,
        env.token.data.clone(),
    );
    let player = env.player.insecure_clone();
    let res = commit(&mut env, &player, mint, token, t22(), 1);
    assert!(res.is_err(), "classic-program-owned accounts must fail");
    println!(
        "classic owner rejection:\n{}",
        res.err().unwrap_or_default()
    );
}

#[test]
fn wrong_token_program_account_fails() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let (mint, token) = (env.mint.pubkey, env.token.pubkey);
    let classic = Pubkey::from_str(TOKEN_CLASSIC).expect("id");
    expect_err(
        commit(&mut env, &player, mint, token, classic, 1),
        "InvalidProgramId",
    );
}
