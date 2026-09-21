// The secret is random and local (owner decision, 21.09.2026). So the only way back after a
// reinstall is the export — and these tests are what make that promise safe to print.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SeasonSecret, looksLikeSeedPhrase } from "../src/core/secret.ts";
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

/** Deterministic "randomness", so a test can say what the secret will be. */
const deps = (store: MemoryStore, seed = 7) => ({
  store,
  now: () => 1_790_000_000,
  randomBytes: async (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * seed + 3) % 256),
});

test("the secret is created once and read back after that", async () => {
  const store = new MemoryStore();
  const s = new SeasonSecret(deps(store));
  const first = await s.get(wallet);
  const second = await s.get(wallet);
  assert.equal(first.fresh, true);
  assert.equal(second.fresh, false);
  assert.equal(bytesToHex(first.secret), bytesToHex(second.secret));
  assert.equal(first.secret.length, 32);
});

test("a different wallet gets its own secret", async () => {
  const store = new MemoryStore();
  const s = new SeasonSecret(deps(store));
  const a = await s.get(wallet);
  const other = Keypair.fromSeed(Uint8Array.from(Array(32).fill(5))).publicKey;
  const b = await s.get(other);
  assert.equal(b.fresh, true, "a new wallet is a new record");
  assert.equal((await s.stored())!.secretHex, bytesToHex(b.secret), "the stored record follows the new wallet");
});

test("the export is 64 hex characters and nothing else", async () => {
  const store = new MemoryStore();
  const s = new SeasonSecret(deps(store));
  await s.get(wallet);
  const exported = await s.exportSecret();
  assert.match(exported!, /^[0-9a-f]{64}$/);
  assert.equal(exported!.includes(wallet.toBase58()), false, "it names nobody");
});

test("the import refuses anything that is not a secret", async () => {
  const store = new MemoryStore();
  const s = new SeasonSecret(deps(store));
  for (const bad of ["", "abc", "zz".repeat(32), "ab".repeat(31), "ab".repeat(33)]) {
    await assert.rejects(() => s.importSecret(bad, wallet), /not a backup code/, `"${bad.slice(0, 8)}"`);
  }
  // but it forgives the things a person does while copying
  const clean = "ab".repeat(32);
  assert.equal(bytesToHex(await s.importSecret(`  ${clean.toUpperCase()} `, wallet)), clean);
});

test("reinstall with the exported secret: the open answer comes back in full", async () => {
  // --- before
  const store = new MemoryStore();
  const secretBefore = (await new SeasonSecret(deps(store)).get(wallet)).secret;
  const exported = await new SeasonSecret(deps(store)).exportSecret();

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
  assert.ok(entry);

  // --- the uninstall takes everything local with it
  const freshStore = new MemoryStore();
  assert.equal(await freshStore.get("seal:11"), null);

  // --- the player pastes the secret back
  const restored = await new SeasonSecret(deps(freshStore, 99)).importSecret(exported!, wallet);
  assert.equal(bytesToHex(restored), bytesToHex(secretBefore));

  const back = recoverAnswer({ secret: restored, round, entry: entry!, wallet, sgtMint });
  assert.ok(back, "the answer is recoverable");
  assert.equal(back!.pBps, 8_000, "including the number nobody wrote down any more");
  assert.equal(back!.salt, bytesToHex(saltFor(restored, round.roundId)));
  assert.equal(back!.sentence, undefined, "the sentence was never on chain");
});

test("without the export, an open answer is lost — and the code says so, it does not guess", async () => {
  const store = new MemoryStore();
  const mine = (await new SeasonSecret(deps(store, 7)).get(wallet)).secret;
  const afterReinstall = (await new SeasonSecret(deps(new MemoryStore(), 23)).get(wallet)).secret;
  assert.notEqual(bytesToHex(mine), bytesToHex(afterReinstall));

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
      salt: saltFor(mine, round.roundId),
    }),
    committedAt: round.commitOpen,
    revealed: false,
    pBps: 0,
    scored: false,
    scoredAsMissing: false,
    scoreBps: 0,
  };
  assert.equal(recoverAnswer({ secret: afterReinstall, round, entry, wallet, sgtMint }), null);

  const { recovered, lost } = recoverAll({
    secret: afterReinstall,
    calendar: cal.rounds,
    entries: [{ round, entry }],
    wallet,
    sgtMint,
  });
  assert.deepEqual(recovered, []);
  assert.deepEqual(lost, [11], "the call is named as lost, not silently dropped");
});

test("a wallet recovery phrase is refused as such, not as a format error", async () => {
  const store = new MemoryStore();
  const s = new SeasonSecret(deps(store));
  const twelve = "ripple almost sunset canvas gather melody pledge orbit shrimp velvet tunnel amber";
  const twentyFour = `${twelve} ${twelve}`;

  for (const phrase of [twelve, twentyFour, twelve.toUpperCase()]) {
    assert.equal(looksLikeSeedPhrase(phrase), true, phrase.slice(0, 20));
    await assert.rejects(
      () => s.importSecret(phrase, wallet),
      (e: unknown) => e instanceof Error && e.name === "SeedPhrasePasted",
      "the app must say what it is, not shrug it off as a format error",
    );
  }
  // and nothing was stored on the way
  assert.equal(await s.stored(), null);
});

test("a backup code is never mistaken for a phrase", () => {
  assert.equal(looksLikeSeedPhrase("ab".repeat(32)), false);
  assert.equal(looksLikeSeedPhrase(""), false);
  assert.equal(looksLikeSeedPhrase("four words are not twelve"), false);
  // eleven or thirteen words is not a phrase either — we only refuse what actually is one
  assert.equal(looksLikeSeedPhrase("one two three four five six seven eight nine ten eleven"), false);
});


/**
 * The weak path must stay unreachable, and "unreachable" is a property of the source, not of one
 * run: expo-crypto's synchronous `getRandomBytes` fills the array from `Math.random()` when
 * `__DEV__` is set and a remote debugger is attached, and a secret born there is kept for the
 * season. So this test reads the app sources and insists that nobody calls it.
 */
test("the secret is never filled from the synchronous random source", () => {
  const src = join(import.meta.dirname, "../src");
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name);
      if (item.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(item.name)) continue;
      const text = readFileSync(path, "utf8");
      // getRandomBytes( but not getRandomBytesAsync(
      if (/getRandomBytes\s*\(/.test(text)) offenders.push(path);
    }
  };
  walk(src);
  assert.deepEqual(offenders, [], "use Crypto.getRandomBytesAsync — see core/secret.ts");
});

test("the season secret comes from the provider, asynchronously", async () => {
  let asked = 0;
  const store = new MemoryStore();
  const s = new SeasonSecret({
    store,
    now: () => 1,
    randomBytes: async (n) => {
      asked += 1;
      return Uint8Array.from({ length: n }, (_, i) => (i * 5 + 9) % 256);
    },
  });
  const wallet = Keypair.generate().publicKey;
  const first = await s.get(wallet);
  assert.equal(first.fresh, true);
  assert.equal(first.secret.length, 32);
  assert.equal(asked, 1);
  // second time it comes out of the store, not out of the provider
  const again = await s.get(wallet);
  assert.equal(again.fresh, false);
  assert.equal(asked, 1);
  assert.equal(bytesToHex(again.secret), bytesToHex(first.secret));
});
