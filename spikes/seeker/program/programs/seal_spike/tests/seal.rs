//! Spike 3 program tests: reveal(R-1) + commit(R) in one transaction, wrong salt, test vector
//! for the app's commitment implementation.
use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/seal_spike.so"
    ));
    svm.add_program(seal_spike::id(), bytes)
        .expect("add_program");
    let player = Keypair::new_from_array([7u8; 32]);
    svm.airdrop(&player.pubkey(), 1_000_000_000)
        .expect("airdrop");
    (svm, player)
}

fn entry(round_id: u32, player: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"entry", &round_id.to_le_bytes(), player.as_ref()],
        &seal_spike::id(),
    )
    .0
}

fn commit_ix(player: &Pubkey, round_id: u32, commitment: [u8; 32]) -> Instruction {
    Instruction::new_with_bytes(
        seal_spike::id(),
        &seal_spike::instruction::Commit {
            round_id,
            commitment,
        }
        .data(),
        seal_spike::accounts::Commit {
            player: *player,
            entry: entry(round_id, player),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn reveal_ix(player: &Pubkey, round_id: u32, p_bps: u16, salt: [u8; 32]) -> Instruction {
    Instruction::new_with_bytes(
        seal_spike::id(),
        &seal_spike::instruction::Reveal {
            round_id,
            p_bps,
            salt,
        }
        .data(),
        seal_spike::accounts::Reveal {
            beneficiary: *player,
            entry: entry(round_id, player),
        }
        .to_account_metas(None),
    )
}

fn send(svm: &mut LiteSVM, signer: &Keypair, ixs: &[Instruction]) -> Result<u64, String> {
    svm.expire_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&signer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).expect("sign");
    svm.send_transaction(tx)
        .map(|m| m.compute_units_consumed)
        .map_err(|f| format!("{:?}\n{}", f.err, f.meta.logs.join("\n")))
}

#[test]
fn reveal_previous_and_commit_next_in_one_tx() {
    let (mut svm, player) = setup();
    let pk = player.pubkey();
    let salt1 = [1u8; 32];
    let c1 = seal_spike::commitment_for(1, &pk, 4_000, &salt1);
    send(&mut svm, &player, &[commit_ix(&pk, 1, c1)]).expect("commit round 1");
    let c2 = seal_spike::commitment_for(2, &pk, 6_500, &[2u8; 32]);
    let cu = send(
        &mut svm,
        &player,
        &[reveal_ix(&pk, 1, 4_000, salt1), commit_ix(&pk, 2, c2)],
    )
    .expect("reveal 1 + commit 2");
    println!("reveal+commit in one tx: {cu} CU");
}

#[test]
fn wrong_salt_is_rejected() {
    let (mut svm, player) = setup();
    let pk = player.pubkey();
    let c = seal_spike::commitment_for(3, &pk, 5_000, &[3u8; 32]);
    send(&mut svm, &player, &[commit_ix(&pk, 3, c)]).expect("commit");
    let err =
        send(&mut svm, &player, &[reveal_ix(&pk, 3, 5_000, [9u8; 32])]).expect_err("must fail");
    assert!(err.contains("CommitmentMismatch"), "{err}");
}

/// Printed vector is copied into the app's self-test (spikes/seeker/app/src/commitment.ts).
#[test]
fn commitment_test_vector() {
    let beneficiary = Keypair::new_from_array([7u8; 32]).pubkey();
    let c = seal_spike::commitment_for(42, &beneficiary, 4_000, &[0xAB; 32]);
    let hex: String = c.iter().map(|b| format!("{b:02x}")).collect();
    println!("VECTOR beneficiary={beneficiary} round=42 p_bps=4000 salt=ab*32 commitment={hex}");
}
