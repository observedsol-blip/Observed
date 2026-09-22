// What the screens will draw — checked against the approved copy, not against a screenshot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PublicKey } from "@solana/web3.js";
import { copy } from "../src/copy.ts";
import { resultView, sideRecord, streakOf, todayView } from "../src/core/day.ts";
import { type Calendar, hexToBytes } from "../src/chain/calendar.ts";
import type { Entry, Round } from "../src/chain/layout.ts";
import type { SealRecord } from "../src/core/records.ts";
import { ENTRY_RENT_LAMPORTS, PLAYER_RENT_LAMPORTS, lastDepositBack, solText } from "../src/core/funding.ts";
import { RoundStatus } from "../src/chain/ids.ts";

const cal: Calendar = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../tests/fixtures/calendar/season1.json"), "utf8"),
);
const round = cal.rounds[11];
const key = new PublicKey(Uint8Array.from(Array(32).fill(1)));

const chainRound = (over: Partial<Round> = {}): Round => ({
  pubkey: key,
  roundId: 11,
  termsHash: hexToBytes(round.termsHash),
  kind: 0,
  feedId: hexToBytes(round.feedId),
  priceAccount: key,
  offsetBps: 0,
  bandBps: 25,
  windowSecs: 60,
  maxAgeSecs: 60,
  closeAfterSecs: round.closeAfterSecs,
  earliestCloseUnix: round.earliestCloseUnix,
  commitOpen: round.commitOpen,
  commitClose: round.commitClose,
  referenceTime: round.referenceTime,
  outcomeTime: round.outcomeTime,
  revealClose: round.outcomeTime + 72 * 3600,
  resolveDeadline: round.outcomeTime + 86_400,
  status: RoundStatus.Resolved,
  outcome: 1,
  reference: {} as never,
  evidence: {} as never,
  outcomeMarginBps: 130,
  commitCount: 71,
  revealCount: 63,
  histogram: Array.from({ length: 21 }, (_, i) => (i === 13 ? 63 : 0)), // everyone said 65 %
  ...over,
});
const entry = (over: Partial<Entry> = {}): Entry => ({
  pubkey: key,
  round: key,
  sgtMint: key,
  beneficiary: key,
  rentRefundTo: key,
  commitment: new Uint8Array(32),
  committedAt: round.commitOpen,
  revealed: true,
  pBps: 8_000,
  scored: false,
  scoredAsMissing: false,
  scoreBps: 0,
  ...over,
});

test("the confidence words are symmetrical and match the approved copy", () => {
  assert.equal(copy.confidence(5_000), "Could go either way");
  assert.equal(copy.confidence(6_000), "Leaning Up");
  assert.equal(copy.confidence(4_000), "Leaning Down");
  assert.equal(copy.confidence(8_000), "Fairly sure: Up");
  assert.equal(copy.confidence(2_000), "Fairly sure: Down");
  assert.equal(copy.confidence(9_500), "Very sure: Up");
  assert.equal(copy.confidence(500), "Very sure: Down");
});

test("the sealed answer comes back with the exact number, not the band word", () => {
  assert.equal(copy.sealedAnswer(8_000), "You sealed: Up, 80% sure.");
  assert.equal(copy.sealedAnswer(2_000), "You sealed: Down, 80% sure.");
  assert.equal(copy.sealedAnswer(5_000), "You sealed: 50/50.");
});

test("the sentence heading follows the side", () => {
  assert.equal(copy.sentence.headingFor(8_000), "What tipped you toward Up?");
  assert.equal(copy.sentence.headingFor(3_000), "What tipped you toward Down?");
  assert.equal(copy.sentence.headingFor(5_000), "What makes this hard to call?");
});

test("Today: open, with the question and the confidence word", () => {
  const view = todayView({
    now: round.commitOpen + 300,
    calendar: cal.rounds,
    record: null,
    draftPBps: 8_000,
    openReveals: 1,
    hasGenesisToken: true,
    balanceLamports: ENTRY_RENT_LAMPORTS + 500_000,
  });
  assert.equal(view.phase, "open");
  if (view.phase !== "open") return;
  assert.equal(view.roundId, 11);
  assert.equal(view.confidence, "Fairly sure: Up");
  assert.equal(view.blocked, undefined);
  assert.equal(view.openReveals, 1);
});

test("Today: too little SOL is caught here, not by the wallet", () => {
  const view = todayView({
    now: round.commitOpen + 300,
    calendar: cal.rounds,
    record: null,
    draftPBps: 8_000,
    openReveals: 0,
    hasGenesisToken: true,
    balanceLamports: 1_000,
  });
  assert.equal(view.phase, "open");
  if (view.phase !== "open") return;
  assert.equal(view.blocked?.kind, "no-sol");
  assert.match(view.blocked!.kind === "no-sol" ? view.blocked!.title : "", /about 0\.003 SOL/);
  assert.equal(
    view.blocked!.kind === "no-sol" ? view.blocked!.body : "",
    "Your answer is saved on this phone. Add SOL and seal before 04:00 UTC.",
  );
});

test("Today: no Genesis Token beats the SOL check — one honest state at a time", () => {
  const view = todayView({
    now: round.commitOpen + 300,
    calendar: cal.rounds,
    record: null,
    draftPBps: null,
    openReveals: 0,
    hasGenesisToken: false,
    balanceLamports: 0,
  });
  assert.equal(view.phase === "open" && view.blocked?.kind, "no-sgt");
});

test("Today: between the windows, and once sealed", () => {
  const between = todayView({
    now: round.commitClose + 60,
    calendar: cal.rounds,
    record: null,
    draftPBps: null,
    openReveals: 2,
    hasGenesisToken: true,
    balanceLamports: 10_000_000,
  });
  assert.equal(between.phase, "closed");
  assert.equal(copy.openReveals(2), "2 calls still open to reveal");

  const sealedRecord: SealRecord = {
    roundId: 11,
    pBps: 8_000,
    salt: "00".repeat(32),
    commitment: "11".repeat(32),
    share: false,
    status: "confirmed",
    savedAt: round.commitOpen + 300,
  };
  const sealed = todayView({
    now: round.commitOpen + 600,
    calendar: cal.rounds,
    record: sealedRecord,
    draftPBps: null,
    openReveals: 0,
    hasGenesisToken: true,
    balanceLamports: 10_000_000,
  });
  assert.equal(sealed.phase, "sealed");
});

test("Result: called, missed, too close, no side — and the priority when two apply", () => {
  const called = resultView({ round: chainRound(), calendar: round, entry: entry(), record: null, streak: 3 });
  assert.equal(called.verdict, "You called the side.");
  assert.equal(called.sealedAnswer, "You sealed: Up, 80% sure.");
  assert.equal(called.streak, "3 evenings in a row.");
  assert.equal(called.crowd.mean, 6_500);
  assert.equal(called.verdictDetail, null);

  const missed = resultView({
    round: chainRound({ outcome: 2, outcomeMarginBps: -130 }),
    calendar: round,
    entry: entry(),
    record: null,
    streak: 1,
  });
  assert.equal(missed.verdict, "It went the other way.");
  assert.equal(missed.streak, "First evening.");

  const close = resultView({
    round: chainRound({ outcomeMarginBps: 10 }),
    calendar: round,
    entry: entry(),
    record: null,
    streak: 2,
  });
  assert.equal(close.verdict, "Too close to call.");
  assert.match(close.verdictDetail ?? "", /^SOL moved 0\.10% — inside the measurement band/);
  assert.equal(close.verdictSubline, null);

  const noSide = resultView({
    round: chainRound(),
    calendar: round,
    entry: entry({ pBps: 5_000 }),
    record: null,
    streak: 1,
  });
  assert.equal(noSide.verdict, "You didn't pick a side.");

  // both apply: "Too close to call." wins, the other becomes the subline (owner, 21.09.)
  const both = resultView({
    round: chainRound({ outcomeMarginBps: 5 }),
    calendar: round,
    entry: entry({ pBps: 5_000 }),
    record: null,
    streak: 1,
  });
  assert.equal(both.verdict, "Too close to call.");
  assert.equal(both.verdictSubline, "You didn't pick a side.");
});

test("Result: the sentence from yesterday is shown when there is one", () => {
  const withNote = resultView({
    round: chainRound(),
    calendar: round,
    entry: entry(),
    record: { roundId: 11, pBps: 8_000, salt: "", commitment: "", share: false, status: "confirmed", savedAt: 0, sentence: "ETH looks tired" },
    streak: 1,
  });
  assert.equal(withNote.sentence, "ETH looks tired");
});

test("the side record counts calls, not close ones and not the 50/50s", () => {
  const items = [
    { entry: entry({ pBps: 8_000 }), round: chainRound() }, // called
    { entry: entry({ pBps: 2_000 }), round: chainRound() }, // said Down, went Up: missed
    { entry: entry({ pBps: 8_000 }), round: chainRound({ outcomeMarginBps: 5 }) }, // too close
    { entry: entry({ pBps: 5_000 }), round: chainRound() }, // no side
    { entry: entry({ revealed: false }), round: chainRound() }, // never revealed
  ];
  assert.deepEqual(sideRecord(items), { hits: 1, calls: 2 });
  assert.equal(copy.record.sideRecord(1, 2), "1 of 2 calls");
});

test("the streak counts revealed evenings in a row, and a close call does not break it", () => {
  const records: SealRecord[] = [9, 10, 11].map((roundId) => ({
    roundId,
    pBps: 6_000,
    salt: "",
    commitment: "",
    share: false,
    status: "confirmed",
    savedAt: 0,
  }));
  assert.equal(streakOf(records, new Set([9, 10, 11])), 3);
  assert.equal(streakOf(records, new Set([10, 11])), 2, "the gap ends the streak");
  assert.equal(streakOf(records, new Set([9, 10])), 0, "and the newest one counts first");
});

test("the record locks its diagnosis until twenty revealed calls", () => {
  assert.equal(copy.record.unlockAt, 20);
  assert.equal(copy.record.locked(8), "Unlocks after 20 revealed calls · you're at 8");
  // The explaining line is gone with the Brier it explained (owner, 22.09.2026): nothing
  // replaces it, so there is nothing left here to check.
  assert.equal("explain" in copy.record, false);
});

test("an evening that only reveals does not ask for rent that was already paid", () => {
  // The entry for today exists, so the deposit is on chain; the player only reveals and pays a
  // fee. Telling them to top up 0.003 SOL would be wrong twice: the money is not needed, and the
  // message blocks the one action of the day (audit 21.09.2026, finding 8).
  const thin = 400_000; // enough for fees, nowhere near the rent
  const withoutEntry = todayView({
    now: round.commitOpen + 300,
    calendar: cal.rounds,
    record: null,
    draftPBps: 8_000,
    openReveals: 1,
    hasGenesisToken: true,
    balanceLamports: thin,
  });
  assert.equal(withoutEntry.phase === "open" && withoutEntry.blocked?.kind, "no-sol");

  const withEntry = todayView({
    now: round.commitOpen + 300,
    calendar: cal.rounds,
    record: null,
    draftPBps: 8_000,
    openReveals: 1,
    hasGenesisToken: true,
    balanceLamports: thin,
    entryExists: true,
  });
  assert.equal(withEntry.phase, "open");
  assert.equal(withEntry.phase === "open" && withEntry.blocked, undefined, "nothing to top up");
});

/* ------------------------------------------------------------------------------------------
 * A5 — what the deposit is, said before the wallet sheet opens (owner, 22.09.2026).
 * ---------------------------------------------------------------------------------------- */

test("the deposit line carries the amount the account size produces", () => {
  // 184 bytes + 128 overhead, 6960 lamports per byte: 2 171 520 → 0.0022 SOL. If the Entry ever
  // grows, this line has to move with it, and it does, because nothing here is typed by hand.
  assert.equal(solText(ENTRY_RENT_LAMPORTS), "0.0022");
  assert.equal(solText(PLAYER_RENT_LAMPORTS), "0.0013");
  assert.equal(
    copy.deposit.line(solText(ENTRY_RENT_LAMPORTS), "30 DEC"),
    "No stakes. A 0.0022 SOL deposit comes back to this wallet by 30 DEC.",
  );
  assert.equal(
    copy.deposit.firstCall(solText(PLAYER_RENT_LAMPORTS)),
    "Your first call also opens your record: 0.0013 SOL, once, not returned.",
  );
});

test("the date comes from the calendar, not from a string", () => {
  // The last entry of the season closes 30 days after its reveal window; the floor of 9 Nov
  // only binds the early ones. Reading it off the calendar means the line cannot go stale.
  const last = lastDepositBack(cal.rounds, 72 * 3600);
  assert.equal(new Date(last * 1000).toISOString().slice(0, 10), "2026-12-30");
});

test("only the very first call is told about the account that stays", () => {
  const open = todayView({
    now: cal.rounds[0].commitOpen + 60,
    calendar: cal.rounds,
    record: null,
    draftPBps: null,
    openReveals: 0,
    hasGenesisToken: true,
    balanceLamports: 50_000_000,
    hasPlayerAccount: false,
  });
  assert.equal(open.phase, "open");
  if (open.phase !== "open") return;
  assert.match(open.deposit, /No stakes\. A 0\.0022 SOL deposit/);
  assert.match(open.firstCall ?? "", /0\.0013 SOL, once, not returned/);

  const later = todayView({
    now: cal.rounds[0].commitOpen + 60,
    calendar: cal.rounds,
    record: null,
    draftPBps: null,
    openReveals: 0,
    hasGenesisToken: true,
    balanceLamports: 50_000_000,
    hasPlayerAccount: true,
  });
  assert.equal(later.phase === "open" ? later.firstCall : "x", null, "said once, not every evening");
});
