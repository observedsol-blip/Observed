// The check that makes "What others wrote" worth reading: a sentence only counts if its hash was
// the single 64-hex memo in the very transaction that carried this wallet's commit for this call.
// Everything else is dropped silently — including the four ways of faking it below.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { pickSentences, type MemoTransaction, verifiedSentences } from "../src/core/others.ts";
import { sha256Of } from "../src/core/sentence.ts";

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const ALICE = "A1ice1111111111111111111111111111111111111";
const BOB = "B0b22222222222222222222222222222222222222";
const saltA = "aa".repeat(32);
const saltB = "bb".repeat(32);

/** The honest seal: the commit transaction, carrying exactly one hash memo. */
const sealed = (payer: string, saltHex: string, sentence: string): MemoTransaction => ({
  signature: `seal-${payer}`,
  blockTime: 1,
  payer,
  memos: [hex(sha256Of(saltHex, sentence))],
  committed: true,
  revealed: false,
});
const revealed = (payer: string, saltHex: string, memos: string[], pBps = 7_000): MemoTransaction => ({
  signature: `reveal-${payer}`,
  blockTime: 2,
  payer,
  memos,
  committed: false,
  revealed: true,
  saltHex,
  pBps,
});
/** Any other transaction touching the round: `score_entry`, a bare memo — no commit in it. */
const touched = (payer: string, memos: string[], blockTime: number): MemoTransaction => ({
  signature: `touch-${payer}-${blockTime}`,
  blockTime,
  payer,
  memos,
  committed: false,
  revealed: false,
});

test("a sentence whose hash was sealed first is shown", () => {
  const text = "Funding flipped negative overnight.";
  const out = verifiedSentences({
    transactions: [sealed(ALICE, saltA, text), revealed(ALICE, saltA, [text])],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].sentence, text);
  assert.equal(out[0].payer, ALICE);
  assert.equal(out[0].pBps, 7_000);
});

test("a sentence written after the fact is dropped, not flagged", () => {
  const out = verifiedSentences({
    transactions: [
      sealed(ALICE, saltA, "what I actually thought"),
      revealed(ALICE, saltA, ["what I wish I had thought"]),
    ],
  });
  assert.deepEqual(out, [], "no hash, no sentence — and no 'unverified' label either");
});

test("someone else's hash does not verify my sentence", () => {
  const text = "ETH looks tired";
  const out = verifiedSentences({
    transactions: [sealed(BOB, saltB, text), revealed(ALICE, saltA, [text])],
  });
  assert.deepEqual(out, []);
});

test("a reveal without any seal memo is dropped", () => {
  const out = verifiedSentences({ transactions: [revealed(ALICE, saltA, ["no hash was ever posted"])] });
  assert.deepEqual(out, []);
});

test("the player does not read their own sentence back as someone else's", () => {
  const me = new PublicKey(Uint8Array.from(Array(32).fill(3)));
  const text = "mine";
  const out = verifiedSentences({
    transactions: [sealed(me.toBase58(), saltA, text), revealed(me.toBase58(), saltA, [text])],
    self: me,
  });
  assert.deepEqual(out, []);
});

test("a hidden wallet stays hidden", () => {
  const text = "loud opinion";
  const transactions = [sealed(BOB, saltB, text), revealed(BOB, saltB, [text])];
  assert.equal(verifiedSentences({ transactions }).length, 1);
  assert.equal(verifiedSentences({ transactions, hidden: new Set([BOB]) }).length, 0);
});

test("the hash memo itself is never shown as a sentence", () => {
  const text = "a real sentence";
  const hash = hex(sha256Of(saltA, text));
  const out = verifiedSentences({
    transactions: [sealed(ALICE, saltA, text), revealed(ALICE, saltA, [hash, text])],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].sentence, text);
});

test("one sentence per wallet and call, even if someone posts three", () => {
  const first = "first";
  const transactions = [
    sealed(ALICE, saltA, first),
    revealed(ALICE, saltA, [first, "second", "third"]),
  ];
  assert.equal(verifiedSentences({ transactions }).length, 1);
});

test("a sentence longer than the limit is not shown", () => {
  const long = "x".repeat(200);
  const out = verifiedSentences({
    transactions: [sealed(ALICE, saltA, long), revealed(ALICE, saltA, [long])],
  });
  assert.deepEqual(out, []);
});

/* ---------------------------------------------------------------------------------------------
 * The four ways of claiming foresight after the fact. All of them worked before 21.09.2026.
 * ------------------------------------------------------------------------------------------- */

test("the proven attack: the hash posted AFTER the outcome verifies nothing", () => {
  const afterTheFact = "I knew it would go up.";
  const out = verifiedSentences({
    transactions: [
      { ...sealed(ALICE, saltA, "anything"), memos: [] }, // sealed honestly, no sentence
      touched(ALICE, [hex(sha256Of(saltA, afterTheFact))], 1_000), // 16:00 has passed
      revealed(ALICE, saltA, [afterTheFact]),
    ],
  });
  assert.deepEqual(out, [], "a hash outside the commit transaction is not a seal");
});

test("two hashes in the commit transaction verify neither of them", () => {
  const up = "It goes up.";
  const down = "It goes down.";
  const out = verifiedSentences({
    transactions: [
      { ...sealed(ALICE, saltA, up), memos: [hex(sha256Of(saltA, up)), hex(sha256Of(saltA, down))] },
      revealed(ALICE, saltA, [down]),
    ],
  });
  assert.deepEqual(out, [], "sealing both sides is sealing nothing");
});

test("a hash in a separate transaction before the window closed verifies nothing", () => {
  const text = "Funding flipped negative overnight.";
  const out = verifiedSentences({
    transactions: [
      touched(ALICE, [hex(sha256Of(saltA, text))], 0), // early, but not the commit
      { ...sealed(ALICE, saltA, text), memos: [] },
      revealed(ALICE, saltA, [text]),
    ],
  });
  assert.deepEqual(out, [], "only the commit transaction carries a seal memo");
});

test("two commit transactions from one wallet make both worthless", () => {
  const up = "It goes up.";
  const down = "It goes down.";
  const out = verifiedSentences({
    transactions: [
      sealed(ALICE, saltA, up),
      { ...sealed(ALICE, saltA, down), signature: "seal-again" },
      revealed(ALICE, saltA, [down]),
    ],
  });
  assert.deepEqual(out, [], "ambiguity is not resolved in the player's favour");
});


/* ------------------------------------------------------------------------------------------
 * A2 — at most two sentences, two sides if there are two, the same two for everybody.
 * ---------------------------------------------------------------------------------------- */

const other = (payer: string, sentence: string, pBps: number) => ({
  payer,
  sentence,
  pBps,
  signature: `sig-${payer}`,
});

test("two sentences, and they take different sides when both sides wrote", () => {
  const all = [
    other("aaa", "up one", 8_000),
    other("bbb", "up two", 7_000),
    other("ccc", "down one", 2_000),
  ];
  const picked = pickSentences(all, 0);
  assert.equal(picked.length, 2);
  const sides = picked.map((o) => (o.pBps > 5_000 ? "up" : "down"));
  assert.deepEqual([...new Set(sides)].sort(), ["down", "up"], "one of each");
});

test("when everyone took the same side it takes the next one, not an invented one", () => {
  // Better a true pair than a manufactured disagreement.
  const all = [other("aaa", "up one", 8_000), other("bbb", "up two", 9_000)];
  const picked = pickSentences(all, 3);
  assert.equal(picked.length, 2);
  assert.ok(picked.every((o) => o.pBps > 5_000));
});

test("the same call always shows the same two, in the same order", () => {
  // Everybody who reveals this call sees the same pair; a screen that reshuffles on refresh
  // would be a different screen every time.
  const all = [
    other("ddd", "d", 8_000),
    other("aaa", "a", 2_000),
    other("ccc", "c", 7_000),
    other("bbb", "b", 3_000),
  ];
  const once = pickSentences(all, 17).map((o) => o.sentence);
  const again = pickSentences([...all].reverse(), 17).map((o) => o.sentence);
  assert.deepEqual(once, again, "the ledger's order must not decide it");
});

test("different calls start at different sentences", () => {
  const all = [
    other("aaa", "a", 8_000),
    other("bbb", "b", 2_000),
    other("ccc", "c", 8_000),
    other("ddd", "d", 2_000),
  ];
  const first = pickSentences(all, 0)[0].sentence;
  const second = pickSentences(all, 1)[0].sentence;
  assert.notEqual(first, second, "the round id rotates the start");
});

test("one sentence stays one, none stays none", () => {
  assert.equal(pickSentences([other("aaa", "only one", 8_000)], 5).length, 1);
  assert.equal(pickSentences([], 5).length, 0);
});
