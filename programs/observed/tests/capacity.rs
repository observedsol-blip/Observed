//! Measurement, not a rule: how much of a day fits into ONE transaction, and what it costs.
//!
//! Background: with a longer reveal window (E10) a player may have two or three open rounds, and
//! the plan is to attach two SPL memos (E8) to the daily transaction. Both raise the same
//! question — does "one approval a day" still hold? Legacy transactions are capped at 1232 bytes,
//! a transaction at 1.4 M compute units.
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;
use solana_message::Message;
use solana_signer::Signer;
use std::str::FromStr;

mod common;
use common::*;

const MEMO_PROGRAM: &str = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
/// The sentence a player may attach when sealing, capped in the app (E8/E13).
const SENTENCE_BYTES: usize = 140;
const TX_LIMIT: usize = 1232;

fn memo_ix(bytes: usize) -> Instruction {
    Instruction::new_with_bytes(
        Pubkey::from_str(MEMO_PROGRAM).expect("memo id"),
        &vec![b'x'; bytes],
        vec![],
    )
}

/// Serialised size of a signed legacy transaction, exactly as it goes over the wire:
/// one length byte for the signature vector, 64 bytes per signature, then the message.
fn wire_size(payer: &Pubkey, ixs: &[Instruction]) -> usize {
    let msg = Message::new_with_blockhash(ixs, Some(payer), &Default::default());
    1 + 64 * msg.header.num_required_signatures as usize + msg.serialize().len()
}

#[test]
fn one_transaction_carries_a_whole_day() {
    let env = setup();
    let payer = env.player.pubkey();
    let salt = [7u8; 32];

    // The daily transaction as planned: reveal everything that is open, seal today, two memos
    // (the sealed sentence as a hash, the revealed sentence in clear).
    for reveals in 0..=6usize {
        let mut ixs: Vec<Instruction> = (0..reveals)
            .map(|i| ix_reveal(&env, i as u32 + 1, 6_500, salt))
            .collect();
        ixs.push(ix_commit(&env, 0, commitment(&env, 0, 6_500, salt)));
        let with_memos = {
            let mut v = ixs.clone();
            v.push(memo_ix(32)); // H(salt ‖ sentence) at seal time
            v.push(memo_ix(SENTENCE_BYTES)); // the sentence in clear at reveal time
            v
        };
        println!(
            "reveals {reveals}: commit only {:4} B | + 2 memos {:4} B  (limit {TX_LIMIT})",
            wire_size(&payer, &ixs),
            wire_size(&payer, &with_memos),
        );
    }

    // The case the longer reveal window actually produces: three open rounds plus today.
    let mut three = vec![
        ix_reveal(&env, 1, 6_500, salt),
        ix_reveal(&env, 2, 6_500, salt),
        ix_reveal(&env, 3, 6_500, salt),
        ix_commit(&env, 0, commitment(&env, 0, 6_500, salt)),
        memo_ix(32),
        memo_ix(SENTENCE_BYTES),
    ];
    let size = wire_size(&payer, &three);
    assert!(
        size <= TX_LIMIT,
        "three reveals + commit + two memos must fit in one transaction, got {size} B"
    );
    three.pop();
    three.pop();
    println!("three reveals + commit: {} B, with memos {size} B", wire_size(&payer, &three));
}

#[test]
fn what_commit_and_reveal_cost() {
    let mut env = setup();
    let player = env.player.insecure_clone();
    let payer = env.payer.insecure_clone();
    let salt = [9u8; 32];

    let commit_cu = sendx!(env, &player, [ix_commit(&env, 0, commitment(&env, 0, 6_500, salt))])
        .expect("commit");

    set_time(&mut env.svm, REFERENCE_TIME + 5);
    let upd = reference_update(&mut env);
    sendx!(env, &payer, [ix_set_reference(&env, 0, upd)]).expect("set_reference");
    set_time(&mut env.svm, OUTCOME_TIME + 5);
    let out = outcome_update(&mut env, 15_200_000_000);
    sendx!(env, &payer, [ix_resolve(&env, 0, out)]).expect("resolve");

    let reveal_cu = sendx!(env, &player, [ix_reveal(&env, 0, 6_500, salt)]).expect("reveal");
    println!("commit {commit_cu} CU, reveal {reveal_cu} CU");
    // Room for the daily transaction: even four of each stay far below the per-transaction cap.
    assert!(commit_cu + 4 * reveal_cu < 1_400_000 / 4);
}
