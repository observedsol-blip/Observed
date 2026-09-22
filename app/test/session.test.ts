// The controller, against a fake chain and a fake wallet: one evening, end to end, without a
// phone — the same sequence the local validator run does with real bytes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { Session } from "../src/core/session.ts";
import { copy } from "../src/copy.ts";
import { memoryLogText } from "../src/core/memory.ts";
import { MemoryStore } from "../src/core/store.ts";
import { type Calendar, bytesToHex, hexToBytes } from "../src/chain/calendar.ts";
import type { Entry, Round } from "../src/chain/layout.ts";
import { entryPda, roundPda } from "../src/chain/pda.ts";
import { MEMO_ID, RoundStatus } from "../src/chain/ids.ts";
import { checkSentence, sealMemo, sentenceMatches, sha256Of } from "../src/core/sentence.ts";

const cal: Calendar = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../tests/fixtures/calendar/season1.json"), "utf8"),
);
const today = cal.rounds[11];
const yesterday = cal.rounds[10];
const walletKey = Keypair.fromSeed(Uint8Array.from(Array(32).fill(4))).publicKey;
const sgtMint = new PublicKey(Uint8Array.from(Array(32).fill(0x11)));
const sgtToken = new PublicKey(Uint8Array.from(Array(32).fill(0x12)));
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../../tests/fixtures/sgt/${name}.json`), "utf8"));
const b64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

/** A chain that answers from memory. */
class FakeChain {
  rounds = new Map<number, Round>();
  entries = new Map<number, Entry>();
  balanceLamports = 50_000_000;
  sent: TransactionInstruction[][] = [];

  config = async () => ({
    version: 3,
    gameId: 1,
    calendarAuthority: walletKey,
    pauseAuthority: walletKey,
    paused: false,
    nextRoundId: 64,
    season: 1,
    calendarRoot: hexToBytes(cal.merkleRoot),
    firstRoundId: 0,
    maxRoundId: 63,
  });
  round = async (id: number) => this.rounds.get(id) ?? null;
  roundsOf = async (ids: number[]) => new Map([...this.rounds].filter(([id]) => ids.includes(id)));
  entry = async (id: number) => this.entries.get(id) ?? null;
  entriesOf = async (ids: number[]) => new Map([...this.entries].filter(([id]) => ids.includes(id)));
  player = async () => null;
  balance = async () => this.balanceLamports;
  blockhash = async () => "11111111111111111111111111111111";
  sendRaw = async () => "sig";
  confirm = async () => true;
  tokenAccountsOf = async () => {
    // the real token account bytes, with our test wallet as the owner (bytes 32..64), exactly
    // as the Rust tests patch them
    const data = b64(fixture("sgt-token-account").data_base64);
    data.set(walletKey.toBytes(), 32);
    return [{ pubkey: sgtToken, data }];
  };
  accountData = async () => b64(fixture("sgt-mint").data_base64);
}

function chainFor(fake: FakeChain) {
  // the shape the Session expects, mapped onto the fake
  return {
    config: fake.config,
    round: fake.round,
    rounds: fake.roundsOf,
    entry: fake.entry,
    entries: fake.entriesOf,
    player: fake.player,
    balance: fake.balance,
    blockhash: fake.blockhash,
    sendRaw: fake.sendRaw,
    confirm: fake.confirm,
    tokenAccountsOf: fake.tokenAccountsOf,
    accountData: fake.accountData,
  } as never;
}

const makeRound = (r: (typeof cal.rounds)[number], over: Partial<Round> = {}): Round => ({
  pubkey: roundPda(r.roundId),
  roundId: r.roundId,
  termsHash: hexToBytes(r.termsHash),
  kind: r.kind,
  feedId: hexToBytes(r.feedId),
  priceAccount: walletKey,
  offsetBps: r.offsetBps,
  bandBps: r.bandBps,
  windowSecs: 60,
  maxAgeSecs: 60,
  closeAfterSecs: r.closeAfterSecs,
  earliestCloseUnix: r.earliestCloseUnix,
  commitOpen: r.commitOpen,
  commitClose: r.commitClose,
  referenceTime: r.referenceTime,
  outcomeTime: r.outcomeTime,
  revealClose: r.outcomeTime + 72 * 3600,
  resolveDeadline: r.outcomeTime + 86_400,
  status: RoundStatus.Resolved,
  outcome: 1,
  reference: {} as never,
  evidence: {} as never,
  outcomeMarginBps: 130,
  commitCount: 12,
  revealCount: 9,
  histogram: Array.from({ length: 21 }, (_, i) => (i === 13 ? 9 : 0)),
  ...over,
});

function makeSession(fake: FakeChain, now: number) {
  const store = new MemoryStore();
  const signed: { instructions: TransactionInstruction[] }[] = [];
  const wallet = {
    connect: async () => ({ pubkey: walletKey, label: "Fake Vault" }),
    signAndSend: async (instructions: TransactionInstruction[]) => {
      signed.push({ instructions });
      return `sig${signed.length}`;
    },
    disconnect: async () => {},
  };
  const session = new Session({
    chain: chainFor(fake),
    wallet,
    store,
    calendar: cal.rounds,
    now: () => now,
    randomBytes: async (n) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 1) % 256),
  });
  return { session, store, signed, wallet };
}

test("connect finds the Genesis Token and prepares the secret", async () => {
  const fake = new FakeChain();
  const { session } = makeSession(fake, today.commitOpen + 300);
  assert.deepEqual(await session.connect(), { ok: true });
});

test("no Genesis Token is an honest state, not a crash", async () => {
  const fake = new FakeChain();
  fake.tokenAccountsOf = async () => [];
  const { session } = makeSession(fake, today.commitOpen + 300);
  assert.deepEqual(await session.connect(), { ok: false, reason: "no-sgt" });
  const day = await session.day();
  assert.equal(day.blocked, "no-sgt");
});

test("the evening: one transaction reveals yesterday and seals today", async () => {
  const now = today.commitOpen + 300;
  const fake = new FakeChain();
  fake.rounds.set(yesterday.roundId, makeRound(yesterday));
  const { session, signed } = makeSession(fake, now);
  await session.connect();

  // yesterday was sealed and is waiting to be revealed
  const record = await session.saveAnswer(yesterday, 6_500);
  fake.entries.set(yesterday.roundId, {
    pubkey: entryPda(roundPda(yesterday.roundId), sgtMint),
    round: roundPda(yesterday.roundId),
    sgtMint,
    beneficiary: walletKey,
    rentRefundTo: walletKey,
    commitment: hexToBytes(record.commitment),
    committedAt: yesterday.commitOpen,
    revealed: false,
    pBps: 0,
    scored: false,
    scoredAsMissing: false,
    scoreBps: 0,
  });
  // today's answer, written down before any approval
  await session.saveAnswer(today, 8_000, "ETH looks tired");

  const result = await session.evening();
  assert.deepEqual(result.revealed, [yesterday.roundId]);
  assert.equal(result.sealed, today.roundId);
  assert.equal(signed.length, 1, "ONE approval for the whole evening");
  // compute budget + reveal + commit
  assert.equal(signed[0].instructions.length, 3);
});

test("the day view carries the question, the confidence word and the open reveals", async () => {
  const now = today.commitOpen + 300;
  const fake = new FakeChain();
  fake.rounds.set(yesterday.roundId, makeRound(yesterday));
  const { session } = makeSession(fake, now);
  await session.connect();
  await session.saveAnswer(today, 8_000);

  const day = await session.day();
  assert.equal(day.today.phase, "open");
  if (day.today.phase !== "open") return;
  assert.equal(day.today.roundId, today.roundId);
  assert.equal(day.today.confidence, "Fairly sure: Up");
  assert.equal(day.today.question, today.question);
});

test("a calendar the chain does not know is refused before anything is written", async () => {
  const fake = new FakeChain();
  const { session } = makeSession(fake, today.commitOpen + 300);
  await session.connect();
  const tampered = { ...today, offsetBps: 100 };
  await assert.rejects(() => session.saveAnswer(tampered, 6_500), /not in the calendar/);
});

test("the shared sentence is checkable later, and only then", async () => {
  const salt = "ab".repeat(32);
  const sealed = sha256Of(salt, "ETH looks tired");
  assert.equal(sentenceMatches(salt, "ETH looks tired", sealed), true);
  assert.equal(sentenceMatches(salt, "ETH looks fine", sealed), false, "a later edit does not match");
  assert.equal(checkSentence("x".repeat(140)).ok, true);
  assert.equal(checkSentence("x".repeat(141)).ok, false);
  // the hash says nothing about the sentence until the salt is public
  assert.equal(bytesToHex(sealed).includes("tired"), false);
});

/* ------------------------------------------------------------------------------------------
 * Reminders (E3): the permission dialog is reached by exactly one path — a tap.
 * ---------------------------------------------------------------------------------------- */

/** A notifier that counts every question it is asked. */
function countingNotifier(granted = false) {
  const calls = { granted: 0, request: 0, scheduled: 0, cancelled: 0 };
  let allowed = granted;
  return {
    calls,
    notifier: {
      granted: async () => {
        calls.granted += 1;
        return allowed;
      },
      request: async () => {
        calls.request += 1;
        allowed = true;
        return true;
      },
      schedule: async () => {
        calls.scheduled += 1;
      },
      cancelAll: async () => {
        calls.cancelled += 1;
      },
    },
  };
}

/** Puts the entry this phone just sealed on the fake chain, so reconcile can confirm it. */
async function sealToday(session: Session, fake: FakeChain) {
  const record = await session.saveAnswer(today, 8_000);
  fake.entries.set(today.roundId, {
    pubkey: entryPda(roundPda(today.roundId), sgtMint),
    round: roundPda(today.roundId),
    sgtMint,
    beneficiary: walletKey,
    rentRefundTo: walletKey,
    commitment: hexToBytes(record.commitment),
    committedAt: today.commitOpen,
    revealed: false,
    pBps: 0,
    scored: false,
    scoredAsMissing: false,
    scoreBps: 0,
  });
  await session.evening();
}

test("a cold start never asks for the notification permission", async () => {
  const fake = new FakeChain();
  const { session } = makeSession(fake, today.commitOpen + 300);
  await session.connect();
  const { calls, notifier } = countingNotifier();

  // exactly what the app does on every start
  assert.equal(await session.refreshReminders(notifier), 0);
  assert.equal(calls.request, 0, "no permission dialog on start");
  assert.equal(calls.granted, 0, "and not even a look — looking is one line away from asking");
  assert.equal(calls.scheduled, 0);
});

test("the offer comes after the first sealed call, and only once", async () => {
  const fake = new FakeChain();
  const { session } = makeSession(fake, today.commitOpen + 300);
  await session.connect();

  assert.equal(await session.shouldOfferReminders(), false, "nothing sealed yet: no offer");

  await sealToday(session, fake);
  assert.equal(await session.shouldOfferReminders(), true, "after the first seal");

  await session.declineReminders();
  assert.equal(await session.shouldOfferReminders(), false, "a no is remembered");
});

test("the tap is the only thing that asks, and it schedules what it promised", async () => {
  const fake = new FakeChain();
  const { session } = makeSession(fake, today.commitOpen + 300);
  await session.connect();
  await sealToday(session, fake);

  const { calls, notifier } = countingNotifier();
  const result = await session.turnRemindersOn(notifier);
  assert.equal(calls.request, 1, "asked exactly once");
  assert.equal(result.granted, true);
  assert.ok(result.scheduled > 0, "and something was actually scheduled");
  assert.equal(calls.scheduled, result.scheduled);
  assert.equal(calls.cancelled, 1, "the old schedule is cleared first");

  // and the offer is gone afterwards
  assert.equal(await session.shouldOfferReminders(), false);

  // a later cold start rebuilds without asking again
  const second = countingNotifier(true);
  const scheduled = await session.refreshReminders(second.notifier);
  assert.ok(scheduled > 0);
  assert.equal(second.calls.request, 0, "never again");
});

test("a shared sentence seals as hex text, and the reader finds it again", async () => {
  // The bug this pins down (22.09.2026): the seal memo went out as the raw 32 hash bytes. The
  // SPL Memo program requires valid UTF-8, so the whole daily transaction failed on chain —
  // after the approval — and every reader looks for 64 hex characters anyway.
  const fake = new FakeChain();
  const { session, signed, store } = makeSession(fake, today.commitOpen + 300);
  await session.connect();
  await session.saveAnswer(today, 8_000, "Funding flipped negative overnight.", true);
  await session.evening();

  const memoIx = signed[0].instructions.filter((i) => i.programId.toBase58() === MEMO_ID.toBase58());
  assert.equal(memoIx.length, 1, "one memo: the hash of the sentence");
  const text = new TextDecoder().decode(memoIx[0].data);
  assert.match(text, /^[0-9a-f]{64}$/, "64 hex characters, as text — never raw bytes");
  assert.ok(
    [...memoIx[0].data].every((b) => b >= 0x20 && b < 0x7f),
    "printable ASCII: the Memo program refuses anything that is not valid UTF-8",
  );

  // and it is the hash the reader will recompute from the revealed salt
  const stored = JSON.parse((await store.get(`seal:${today.roundId}`)) ?? "{}");
  assert.equal(text, sealMemo(stored.salt, "Funding flipped negative overnight."));
});

/* ------------------------------------------------------------------------------------------
 * A1 — the first screen without opening the wallet (owner, 22.09.2026).
 * ---------------------------------------------------------------------------------------- */

/** The same fake wallet, plus the address of the last session and a count of every opening. */
function makeRestorable(fake: FakeChain, now: number, storedWallet: PublicKey | null) {
  const store = new MemoryStore();
  const opened = { connect: 0, sign: 0 };
  const wallet = {
    connect: async () => {
      opened.connect += 1;
      return { pubkey: walletKey, label: "Fake Vault" };
    },
    signAndSend: async () => {
      opened.sign += 1;
      return "sig";
    },
    disconnect: async () => {},
    storedAddress: async () => storedWallet,
  };
  const session = new Session({
    chain: chainFor(fake),
    wallet,
    store,
    calendar: cal.rounds,
    now: () => now,
    randomBytes: async (n) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 1) % 256),
  });
  return { session, store, wallet, opened };
}

/** What a phone that has played before carries: the secret for exactly this wallet. */
const keepSecret = async (store: MemoryStore, wallet: PublicKey, now: number) =>
  store.set(
    "secret",
    JSON.stringify({ secretHex: "ab".repeat(32), wallet: wallet.toBase58(), createdAt: now }),
  );

test("a cold start draws the day without opening the wallet", async () => {
  // The point of the change: the wallet is needed to SIGN, not to READ. Everything the evening
  // screen shows can be had from the stored address, the keystore and a public RPC.
  const fake = new FakeChain();
  const now = yesterday.outcomeTime + 3_600;
  fake.rounds.set(yesterday.roundId, makeRound(yesterday));
  const { session, store, opened } = makeRestorable(fake, now, walletKey);
  await keepSecret(store, walletKey, now);

  const day = await session.day();

  assert.equal(opened.connect, 0, "not one association with the wallet");
  assert.equal(day.blocked, null, "the day is playable, not 'no-wallet'");
  assert.equal(day.wallet?.toBase58(), walletKey.toBase58());
  assert.ok(day.sgtMint, "the Genesis Token was found by reading, not by asking the wallet");
});

test("without a stored address the screen still asks for the wallet", async () => {
  // A phone that has never played has nothing to restore, and inventing a state would be worse
  // than the honest empty screen.
  const fake = new FakeChain();
  const now = yesterday.outcomeTime + 3_600;
  const { session, opened } = makeRestorable(fake, now, null);

  const day = await session.day();

  assert.equal(day.blocked, "no-wallet");
  assert.equal(opened.connect, 0, "and it still does not open the wallet by itself");
});

test("a secret that belongs to another wallet is not picked up", async () => {
  // Two wallets on one phone: the stored answers belong to whoever sealed them. Restoring the
  // wrong pair would show one player another player's evening.
  const fake = new FakeChain();
  const now = yesterday.outcomeTime + 3_600;
  const stranger = new PublicKey(Uint8Array.from(Array(32).fill(0x33)));
  const { session, store } = makeRestorable(fake, now, walletKey);
  await keepSecret(store, stranger, now);

  assert.equal((await session.day()).blocked, "no-wallet");
});

test("sealing still needs the wallet after a restored start", async () => {
  // The whole promise of the change is that NOTHING else moved: reading is free, signing is not.
  const fake = new FakeChain();
  const now = today.commitOpen + 60;
  const { session, store, opened } = makeRestorable(fake, now, walletKey);
  await keepSecret(store, walletKey, now);

  await session.day();
  assert.equal(opened.sign, 0);
  await session.saveAnswer(today, 7_000);
  await session.evening();
  assert.equal(opened.sign, 1, "one signature, and it is the only time the wallet was used");
  assert.equal(opened.connect, 0, "MWA associates inside signAndSend, not before");
});


/** A revealed entry for this wallet, as the chain would hand it over. */
const revealedEntry = (pBps: number) =>
  ({
    round: roundPda(yesterday.roundId),
    sgtMint,
    beneficiary: walletKey,
    commitment: new Uint8Array(32),
    committedAt: yesterday.commitOpen,
    revealed: true,
    pBps,
    scored: false,
    scoredAsMissing: false,
    scoreBps: 0,
  }) as never;

/* ------------------------------------------------------------------------------------------
 * A4 — the memory question: this phone's note, next to the sealed answer.
 * ---------------------------------------------------------------------------------------- */

test("what you remembered is kept on this phone and comes back with the result", async () => {
  const fake = new FakeChain();
  const now = yesterday.outcomeTime + 3_600;
  fake.rounds.set(yesterday.roundId, makeRound(yesterday));
  const { session, store } = makeRestorable(fake, now, walletKey);
  await keepSecret(store, walletKey, now);
  fake.entries.set(yesterday.roundId, revealedEntry(8_000));

  const before = await session.day();
  assert.equal(before.result?.remembered, null, "unanswered until it is answered");
  assert.equal(before.result?.ownConfidence, 80, "the seal on the input's own 50-100 scale");

  assert.equal(before.result?.memoryAsked, false, "not asked yet");
  assert.equal(
    before.result?.sealedSide,
    "You sealed: Up.",
    "the side may be shown, the number may not",
  );

  await session.remember(yesterday.roundId, 65);
  const after = await session.day();
  assert.equal(after.result?.remembered, 65);
  assert.equal(after.result?.memoryAsked, true);
});

test("the question is put once per entry, and a skip counts as put", async () => {
  // Waving it away is an answer about the question, not about the memory: it must not come
  // back tomorrow, and it must still be distinguishable from an entry nobody was ever asked
  // about (owner, 22.09.2026).
  const fake = new FakeChain();
  const now = yesterday.outcomeTime + 3_600;
  fake.rounds.set(yesterday.roundId, makeRound(yesterday));
  const { session, store } = makeRestorable(fake, now, walletKey);
  await keepSecret(store, walletKey, now);
  fake.entries.set(yesterday.roundId, revealedEntry(8_000));

  await session.remember(yesterday.roundId, null); // skipped
  const after = await session.day();
  assert.equal(after.result?.memoryAsked, true, "asked, and not again");
  assert.equal(after.result?.remembered, null, "but nothing was remembered");

  // a second answer cannot overwrite the first
  await session.remember(yesterday.roundId, 90);
  assert.equal((await session.day()).result?.remembered, null);
});

test("what is written down carries the entry's own address and the moment", async () => {
  // Round id alone would collide between two wallets on one phone, and without a timestamp
  // the answers cannot be evaluated later at all.
  const fake = new FakeChain();
  const now = yesterday.outcomeTime + 3_600;
  fake.rounds.set(yesterday.roundId, makeRound(yesterday));
  const { session, store } = makeRestorable(fake, now, walletKey);
  await keepSecret(store, walletKey, now);
  fake.entries.set(yesterday.roundId, revealedEntry(8_000));

  await session.day();
  await session.remember(yesterday.roundId, 65);

  const kept = JSON.parse((await store.get("remembered")) as string) as Record<
    string,
    { confidence: number; atSeconds: number; roundId: number; sealedAt: number | null }
  >;
  const keys = Object.keys(kept);
  assert.equal(keys.length, 1, "one note, for one entry");
  // The key is an address, not a round number: the same call sealed from another wallet is
  // another entry and gets its own note.
  assert.equal(keys[0].length >= 32, true);
  assert.notEqual(keys[0], String(yesterday.roundId));
  // The note carries what the memory log needs: which call, and how long after the seal the
  // question was answered. Here nothing was sealed on this phone, so `sealedAt` is null.
  assert.deepEqual(kept[keys[0]], {
    confidence: 65,
    atSeconds: now,
    roundId: yesterday.roundId,
    sealedAt: null,
  });
});

test("the sentence reads on the same scale on both sides", () => {
  // "You sealed 80%. You remembered 65%." — two numbers, one unit. A seal of 20 % Down is
  // 80 % sure of Down, and comparing 20 with 65 would be comparing two different questions.
  assert.equal(
    copy.memory.sealedAndRemembered(80, 65),
    "You sealed 80%. You remembered 65%.",
  );
});


/* ------------------------------------------------------------------------------------------
 * The memory log — readable on the phone, and carrying nothing that is not about a call.
 * ---------------------------------------------------------------------------------------- */

test("the memory log names calls and never the wallet or a sentence", async () => {
  const fake = new FakeChain();
  const now = yesterday.outcomeTime + 3_600;
  fake.rounds.set(yesterday.roundId, makeRound(yesterday));
  fake.entries.set(yesterday.roundId, revealedEntry(8_000));
  const { session, store } = makeRestorable(fake, now, walletKey);
  await keepSecret(store, walletKey, now);

  await session.day();
  await session.remember(yesterday.roundId, 65);

  const rows = await session.memoryLog();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].roundId, yesterday.roundId);
  assert.equal(rows[0].remembered, 65);
  assert.equal(rows[0].sealedConfidence, 80, "the call is open, so the seal may be shown");

  const text = memoryLogText(rows);
  assert.match(text, /Memory log/);
  assert.match(text, /remembered 65/);
  assert.equal(text.includes(walletKey.toBase58()), false, "no wallet address");
  assert.equal(text.includes(sgtMint.toBase58()), false, "no mint either");
});

test("an unopened call shows no sealed number in the log", async () => {
  // Same rule as the screen: before the reveal the number is this phone's note about a
  // question that has not been asked yet.
  const fake = new FakeChain();
  const now = today.commitOpen + 60;
  const { session, store } = makeRestorable(fake, now, walletKey);
  await keepSecret(store, walletKey, now);

  await session.day();
  await session.remember(today.roundId, 70);
  const rows = await session.memoryLog();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sealedConfidence, null);
  assert.match(memoryLogText(rows), /sealed —/);
});

test("a skipped question reads as skipped, not as a missing answer", () => {
  const text = memoryLogText([
    { roundId: 3, date: "27 SEP", sealedConfidence: 90, remembered: null, hoursAfterSeal: 14.5 },
  ]);
  assert.equal(text, "Memory log\n27 SEP · call 3 · sealed 90 · skipped · +14.5h");
});
