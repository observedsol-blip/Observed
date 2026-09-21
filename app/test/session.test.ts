// The controller, against a fake chain and a fake wallet: one evening, end to end, without a
// phone — the same sequence the local validator run does with real bytes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { Session } from "../src/core/session.ts";
import { MemoryStore } from "../src/core/store.ts";
import { type Calendar, bytesToHex, hexToBytes } from "../src/chain/calendar.ts";
import type { Entry, Round } from "../src/chain/layout.ts";
import { entryPda, roundPda } from "../src/chain/pda.ts";
import { RoundStatus } from "../src/chain/ids.ts";
import { checkSentence, sentenceMatches, sha256Of } from "../src/core/sentence.ts";

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
    randomBytes: (n) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 1) % 256),
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
