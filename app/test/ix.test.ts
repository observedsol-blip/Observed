// The daily transaction has to fit before the wallet is opened. An approval spent on a
// transaction that is too large is an approval spent for nothing — and the habit does not
// survive many of those.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TooLarge, buildDaily, commitIx, memoIx, revealIx, sizeOf } from "../src/chain/ix.ts";
import { IX, PROGRAM_ID, TX_SIZE_LIMIT } from "../src/chain/ids.ts";
import { entryPda, playerPda, roundPda } from "../src/chain/pda.ts";

const wallet = Keypair.fromSeed(Uint8Array.from(Array(32).fill(1))).publicKey;
const sgtMint = new PublicKey(Uint8Array.from(Array(32).fill(0x11)));
const sgtTokenAccount = new PublicKey(Uint8Array.from(Array(32).fill(0x12)));
const salt = Uint8Array.from(Array(32).fill(7));
const commitment = Uint8Array.from(Array(32).fill(9));
const plan = (reveals: number[], memos?: Uint8Array[]) => ({
  wallet,
  sgtMint,
  sgtTokenAccount,
  reveals: reveals.map((roundId) => ({ roundId, pBps: 6_500, salt })),
  seal: { roundId: 12, commitment },
  memos,
});

test("the instructions carry the accounts the program expects", () => {
  const commit = commitIx({ wallet, sgtMint, sgtTokenAccount, roundId: 12, commitment });
  assert.equal(commit.programId.toBase58(), PROGRAM_ID.toBase58());
  assert.equal(commit.keys.length, 9, "commit takes nine accounts");
  assert.deepEqual(Uint8Array.from(commit.data.subarray(0, 8)), IX.commit);
  assert.equal(commit.keys[0].pubkey.toBase58(), wallet.toBase58(), "the wallet signs");
  assert.ok(commit.keys[0].isSigner);
  const round = roundPda(12);
  assert.equal(commit.keys[5].pubkey.toBase58(), entryPda(round, sgtMint).toBase58());
  assert.equal(commit.keys[6].pubkey.toBase58(), playerPda(sgtMint).toBase58());

  const reveal = revealIx({ wallet, sgtMint, roundId: 11, pBps: 6_500, salt });
  assert.equal(reveal.keys.length, 5, "reveal takes five accounts");
  assert.deepEqual(Uint8Array.from(reveal.data.subarray(0, 8)), IX.reveal);
  assert.equal(reveal.data.length, 8 + 2 + 32);
});

test("a memo needs no account at all", () => {
  const m = memoIx("hello");
  assert.equal(m.keys.length, 0);
  assert.equal(m.data.toString("utf8"), "hello");
});

test("three reveals, a seal and two memos fit in one transaction", () => {
  const built = buildDaily(plan([9, 10, 11], [Uint8Array.from(Array(32).fill(3)), new TextEncoder().encode("x".repeat(140))]));
  assert.ok(built.size <= TX_SIZE_LIMIT, `size ${built.size}`);
  assert.equal(built.instructions.length, 3 + 1 + 2 + 1, "plus the compute budget instruction");
  console.log(`three reveals + seal + two memos: ${built.size} bytes, ${built.computeUnits} CU`);
});

test("the size is checked before the wallet is opened, not after", () => {
  // six reveals is beyond what the 72 h window can produce, but the guard must still hold
  assert.throws(
    () => buildDaily(plan([6, 7, 8, 9, 10, 11], [new TextEncoder().encode("x".repeat(140))])),
    (e: unknown) => e instanceof TooLarge && e.size > TX_SIZE_LIMIT,
  );
});

test("dropping the memos is the cheapest way out of a transaction that is too large", () => {
  const long = [new TextEncoder().encode("x".repeat(140)), new TextEncoder().encode("x".repeat(140))];
  const withMemos = sizeOf(buildDaily(plan([9, 10, 11], long)).instructions, wallet);
  const without = sizeOf(buildDaily(plan([9, 10, 11])).instructions, wallet);
  assert.ok(withMemos - without > 200, "two memos cost more than 200 bytes");
});

test("nothing to do is an error, not an empty transaction", () => {
  assert.throws(() => buildDaily({ wallet, sgtMint, sgtTokenAccount, reveals: [] }), /nothing to do/);
});

test("a probability the program refuses never reaches the wallet", () => {
  assert.throws(() => revealIx({ wallet, sgtMint, roundId: 11, pBps: 5_250, salt }), /p_bps/);
});
