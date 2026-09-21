// The case this whole mechanism exists for: the app was reinstalled while an answer was still
// open. expo-secure-store is wiped on uninstall, so the phone has nothing — and has to get the
// answer back from the wallet plus the chain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "@noble/hashes/sha256";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SeasonSecret, canSurviveReinstall, secretMessage } from "../src/core/secret.ts";
import { recoverAll, recoverAnswer } from "../src/core/recovery.ts";
import { MemoryStore } from "../src/core/store.ts";
import { Sealing } from "../src/core/sealing.ts";
import { type Calendar, bytesToHex, hexToBytes } from "../src/chain/calendar.ts";
import { entryPda, roundPda } from "../src/chain/pda.ts";
import type { Entry } from "../src/chain/layout.ts";
import { saltFor } from "../src/chain/commitment.ts";

const cal: Calendar = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../tests/fixtures/calendar/season1.json"), "utf8"),
);
const round = cal.rounds[11];
const wallet = Keypair.fromSeed(Uint8Array.from(Array(32).fill(4))).publicKey;
const sgtMint = new PublicKey(Uint8Array.from(Array(32).fill(0x11)));

/** A wallet that signs deterministically, like a real one signing the same message twice. */
const signer = (seed: number) => async (message: string) =>
  sha256(new TextEncoder().encode(`wallet${seed}:${message}`));

const deps = (store: MemoryStore, sign: ((m: string) => Promise<Uint8Array>) | null) => ({
  store,
  now: () => 1_790_000_000,
  randomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) % 256),
  signMessage: sign,
});

test("the message the wallet signs is domain-specific and names the wallet", () => {
  assert.equal(secretMessage(wallet), `observed-v1-secret:${wallet.toBase58()}`);
});

test("the secret comes from the signature and is stable across calls", async () => {
  const store = new MemoryStore();
  const s = new SeasonSecret(deps(store, signer(1)));
  const first = await s.get(wallet);
  const second = await s.get(wallet);
  assert.equal(first.origin, "signature");
  assert.equal(first.fresh, true);
  assert.equal(second.fresh, false, "the second call reads it back, it does not sign again");
  assert.equal(bytesToHex(first.secret), bytesToHex(second.secret));
  assert.ok(canSurviveReinstall(first.origin));
});

test("a wallet that cannot sign messages still lets the player seal today", async () => {
  const store = new MemoryStore();
  const s = new SeasonSecret(deps(store, null));
  const { secret, origin } = await s.get(wallet);
  assert.equal(origin, "random");
  assert.equal(secret.length, 32);
  assert.equal(canSurviveReinstall(origin), false, "and the app must say that a reinstall loses it");
});

test("a wallet that refuses the signature once falls back instead of blocking", async () => {
  const store = new MemoryStore();
  const s = new SeasonSecret(deps(store, async () => { throw new Error("declined"); }));
  const { origin } = await s.get(wallet);
  assert.equal(origin, "random");
});

test("reinstalled app, open call: the answer comes back from the wallet plus the chain", async () => {
  // --- before the uninstall
  const store = new MemoryStore();
  const secretBefore = (await new SeasonSecret(deps(store, signer(1))).get(wallet)).secret;
  let entry: Entry | null = null;
  const sealing = new Sealing({
    store,
    now: () => round.commitOpen + 300,
    sgtMint,
    wallet,
    secret: secretBefore,
    readEntry: async () => entry,
    send: async (record) => {
      entry = {
        pubkey: entryPda(roundPda(round.roundId), sgtMint),
        round: roundPda(round.roundId),
        sgtMint,
        beneficiary: wallet,
        rentRefundTo: wallet,
        commitment: hexToBytes(record.commitment),
        committedAt: round.commitOpen + 300,
        revealed: false,
        pBps: 0,
        scored: false,
        scoredAsMissing: false,
        scoreBps: 0,
      };
      return "sig";
    },
    confirm: async () => true,
  });
  await sealing.saveAnswer({ round, pBps: 8_000, sentence: "ETH looks tired" });
  await sealing.seal(round);
  assert.ok(entry, "sealed");

  // --- the uninstall: everything local is gone, the chain is not
  const freshStore = new MemoryStore();
  assert.equal(await freshStore.get("seal:11"), null, "nothing survived the uninstall");

  const recoveredSecret = await new SeasonSecret(deps(freshStore, signer(1))).recover(wallet);
  assert.ok(recoveredSecret);
  assert.equal(bytesToHex(recoveredSecret!), bytesToHex(secretBefore), "same wallet, same secret");

  const back = recoverAnswer({ secret: recoveredSecret!, round, entry: entry!, wallet, sgtMint });
  assert.ok(back, "the answer is recoverable");
  assert.equal(back!.pBps, 8_000, "including the number nobody wrote down any more");
  assert.equal(back!.salt, bytesToHex(saltFor(recoveredSecret!, round.roundId)));
  assert.equal(back!.status, "confirmed");
  // the sentence is NOT recoverable — it never went on chain unless it was shared
  assert.equal(back!.sentence, undefined);
});

test("another wallet cannot open the entry, and the app does not pretend it can", async () => {
  const store = new MemoryStore();
  const mine = (await new SeasonSecret(deps(store, signer(1))).get(wallet)).secret;
  const theirs = (await new SeasonSecret(deps(new MemoryStore(), signer(2))).get(wallet)).secret;
  const salt = saltFor(mine, round.roundId);
  const { commitmentHash } = await import("../src/chain/commitment.ts");
  const entry: Entry = {
    pubkey: entryPda(roundPda(round.roundId), sgtMint),
    round: roundPda(round.roundId),
    sgtMint,
    beneficiary: wallet,
    rentRefundTo: wallet,
    commitment: commitmentHash({
      round: roundPda(round.roundId),
      termsHash: hexToBytes(round.termsHash),
      sgtMint,
      beneficiary: wallet,
      pBps: 3_000,
      salt,
    }),
    committedAt: round.commitOpen,
    revealed: false,
    pBps: 0,
    scored: false,
    scoredAsMissing: false,
    scoreBps: 0,
  };
  assert.equal(recoverAnswer({ secret: theirs, round, entry, wallet, sgtMint }), null);
  assert.equal(recoverAnswer({ secret: mine, round, entry, wallet, sgtMint })?.pBps, 3_000);

  const { recovered, lost } = recoverAll({
    secret: theirs,
    calendar: cal.rounds,
    entries: [{ round, entry }],
    wallet,
    sgtMint,
  });
  assert.deepEqual(recovered, []);
  assert.deepEqual(lost, [11], "a call that cannot be opened is named, not silently dropped");
});

test("a new wallet on the same phone gets its own secret", async () => {
  const store = new MemoryStore();
  const s = new SeasonSecret(deps(store, signer(1)));
  const a = await s.get(wallet);
  const other = Keypair.fromSeed(Uint8Array.from(Array(32).fill(5))).publicKey;
  const b = await s.get(other);
  assert.notEqual(bytesToHex(a.secret), bytesToHex(b.secret));
  assert.equal(b.fresh, true);
});
