// The check that makes "What others wrote" worth reading: a sentence only counts if the hash of
// it was on chain BEFORE the outcome. Everything else is dropped silently.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { type MemoTransaction, verifiedSentences } from "../src/core/others.ts";
import { sha256Of } from "../src/core/sentence.ts";

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const ALICE = "A1ice1111111111111111111111111111111111111";
const BOB = "B0b22222222222222222222222222222222222222";
const saltA = "aa".repeat(32);
const saltB = "bb".repeat(32);

const sealed = (payer: string, saltHex: string, sentence: string): MemoTransaction => ({
  signature: `seal-${payer}`,
  blockTime: 1,
  payer,
  memos: [hex(sha256Of(saltHex, sentence))],
  revealed: false,
});
const revealed = (payer: string, saltHex: string, memos: string[], pBps = 7_000): MemoTransaction => ({
  signature: `reveal-${payer}`,
  blockTime: 2,
  payer,
  memos,
  revealed: true,
  saltHex,
  pBps,
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
