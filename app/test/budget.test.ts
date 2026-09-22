// What the daily transaction asks for, against what it was measured to need.
//
// Both numbers here come from a validator, not from a guess (`spikes/e2e/matrix.mjs`, 22.09.2026).
// The test exists because the budget failed in the field-shaped way twice: once because a memo
// was budgeted at a thousand units and costs fifteen thousand, and once because deriving the
// Entry PDA can cost 14 000 units more on an unlucky address than on a lucky one — and both
// failures land AFTER the wallet approval, which is the one moment the app cannot afford them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { buildDaily } from "../src/chain/ix.ts";
import { CU_COMMIT, CU_REVEAL, cuForMemo } from "../src/chain/ids.ts";

/** Measured: a commit with the Entry PDA on the first try and the Player PDA three steps in. */
const COMMIT_MEASURED = 26_650;
/** The same commit with no search at all: 26 650 minus the three steps the Player PDA cost. */
const COMMIT_WITHOUT_SEARCH = 22_060;
/** Measured: a reveal, which uses the stored bump and therefore does not search. */
const REVEAL_MEASURED = 16_182;
/** Measured: about 1 530 CU per rejected bump candidate. */
const PER_BUMP_STEP = 1_530;
/**
 * How deep a search the budget has to survive, per PDA.
 *
 * A commit derives TWO addresses — Entry and Player — and pays for both on every call. Each step
 * has probability ½, so over a season of 64 calls on twenty devices P(some Entry PDA needs ≥ 25
 * steps) is about 0.004 % and P(some Player PDA needs ≥ 25) is far smaller still. Budgeting for
 * 25 on each side is therefore generous, and generosity is free here.
 */
const STEPS_TO_SURVIVE = 25;
/** The ComputeBudget instruction itself costs this much, so it is not available to the program. */
const BUDGET_IX_COST = 150;

const key = () => Keypair.generate().publicKey;
const plan = (over = {}) => ({
  wallet: key(),
  sgtMint: key(),
  sgtTokenAccount: key(),
  reveals: [],
  ...over,
});
const limitOf = (built: ReturnType<typeof buildDaily>) =>
  Buffer.from(built.instructions[0].data).readUInt32LE(1);

test("a commit survives an unlucky Entry address AND an unlucky Player address", () => {
  // The first version of this test only counted one search. A commit pays for two, and the
  // Player one is paid on every call for the life of the device — so a device with a deep
  // Player bump would have failed every single evening (owner's question, 22.09.2026).
  const built = buildDaily(plan({ seal: { roundId: 0, commitment: new Uint8Array(32) } }));
  const usable = limitOf(built) - BUDGET_IX_COST;
  const worstCase = COMMIT_WITHOUT_SEARCH + 2 * STEPS_TO_SURVIVE * PER_BUMP_STEP;
  assert.ok(
    usable >= worstCase,
    `budget leaves ${usable} CU, two searches of ${STEPS_TO_SURVIVE} steps need ${worstCase}`,
  );
  // and the measured, ordinary case is nowhere near the edge
  assert.ok(usable >= COMMIT_MEASURED * 3);
});

test("the arithmetic behind the budget is the measured one", () => {
  // 26 650 measured, of which three Player steps: the searchless base has to add up.
  assert.equal(COMMIT_MEASURED - 3 * PER_BUMP_STEP, COMMIT_WITHOUT_SEARCH);
});

test("the reveal has room too", () => {
  const built = buildDaily(plan({ reveals: [{ roundId: 0, pBps: 8_000, salt: new Uint8Array(32) }] }));
  const usable = limitOf(built) - BUDGET_IX_COST;
  assert.ok(usable >= REVEAL_MEASURED * 1.25, `budget leaves ${usable} CU for a measured ${REVEAL_MEASURED}`);
});

test("a shared sentence is budgeted as the memo program really costs", () => {
  // A 64-character hash memo: measured at 14 918 CU for 42 bytes, so the linear fit has to be
  // above that, not the 1 000 this once assumed.
  const memo = new TextEncoder().encode("ab".repeat(32));
  const built = buildDaily(plan({
    seal: { roundId: 0, commitment: new Uint8Array(32) },
    memos: [memo],
  }));
  assert.ok(cuForMemo(memo.length) >= 14_918, "a memo is never cheap");
  const usable = limitOf(built) - BUDGET_IX_COST;
  assert.ok(usable >= COMMIT_MEASURED + cuForMemo(memo.length), `budget leaves ${usable} CU`);
});

test("the evening — three reveals, a seal and two memos — still fits the compute cap", () => {
  const built = buildDaily(plan({
    reveals: [0, 1, 2].map((roundId) => ({ roundId, pBps: 8_000, salt: new Uint8Array(32) })),
    seal: { roundId: 3, commitment: new Uint8Array(32) },
    memos: [new TextEncoder().encode("ab".repeat(32)), new TextEncoder().encode("x".repeat(140))],
  }));
  // Solana's ceiling for one transaction. Being under it is what makes the budget honest rather
  // than merely large.
  assert.ok(limitOf(built) <= 1_400_000, `the daily transaction asks for ${limitOf(built)} CU`);
  assert.equal(built.computeUnits, 3 * CU_REVEAL + CU_COMMIT + cuForMemo(64) + cuForMemo(140));
});
