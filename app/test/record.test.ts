// The Record, from chain state — the screen that was drawing a fixture until 22.09.2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PublicKey } from "@solana/web3.js";
import { crowdBaseline, dayLabel, recordView, shortAnswer, statusOf } from "../src/core/record.ts";
import { type Calendar, hexToBytes } from "../src/chain/calendar.ts";
import type { Entry, Player, Round } from "../src/chain/layout.ts";
import type { SealRecord } from "../src/core/records.ts";
import { Outcome, RoundStatus } from "../src/chain/ids.ts";
import { copy } from "../src/copy.ts";

const cal: Calendar = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../tests/fixtures/calendar/season1.json"), "utf8"),
);
const key = (n: number) => new PublicKey(Uint8Array.from(Array(32).fill(n)));
const NOW = cal.rounds[11].outcomeTime + 3_600;

const round = (over: Partial<Round> & { roundId: number }): Round => {
  const c = cal.rounds[over.roundId];
  return {
    pubkey: key(over.roundId + 1),
    termsHash: hexToBytes(c.termsHash),
    kind: 0,
    feedId: hexToBytes(c.feedId),
    priceAccount: key(9),
    offsetBps: 0,
    bandBps: 25,
    windowSecs: 60,
    maxAgeSecs: 60,
    closeAfterSecs: 86_400,
    earliestCloseUnix: 0,
    commitOpen: c.commitOpen,
    commitClose: c.commitClose,
    referenceTime: c.referenceTime,
    outcomeTime: c.outcomeTime,
    revealClose: c.outcomeTime + 72 * 3_600,
    resolveDeadline: c.outcomeTime + 86_400,
    status: RoundStatus.Resolved,
    outcome: Outcome.Yes,
    reference: reading(),
    evidence: reading(),
    thresholdMantissa: 0,
    thresholdLowMantissa: 0,
    outcomeMarginBps: 130,
    commitCount: 71,
    revealCount: 63,
    histogram: Array.from({ length: 21 }, (_, i) => (i === 13 ? 63 : 0)),
    ...over,
  } as Round;
};
const reading = () => ({
  price: 15_000_000_000,
  conf: 4_000_000,
  expo: -8,
  publishTime: 0,
  postedSlot: 0,
  submittedSlot: 0,
  submittedAt: 0,
  submitter: key(3),
});
const entry = (over: Partial<Entry> = {}): Entry =>
  ({
    pubkey: key(4),
    round: key(12),
    sgtMint: key(5),
    beneficiary: key(6),
    rentRefundTo: key(6),
    commitment: new Uint8Array(32),
    committedAt: 0,
    revealed: true,
    pBps: 8_000,
    scored: true,
    scoredAsMissing: false,
    scoreBps: 400,
    ...over,
  }) as Entry;
const player = (over: Partial<Player> = {}): Player =>
  ({
    sgtMint: key(5),
    commits: 9,
    reveals: 8,
    missingScored: 1,
    scoreSum: 28_125, // 9 calls: the example season of 03, 0.3125 → 0.313
    scoredRounds: 9,
    ...over,
  }) as Player;
const record = (roundId: number, pBps: number): SealRecord => ({
  roundId,
  pBps,
  salt: "00".repeat(32),
  commitment: "00".repeat(32),
  share: false,
  status: "confirmed",
  savedAt: 0,
});

test("a season that has not started reads as zero, not as an invented empty state", () => {
  const view = recordView({
    now: NOW,
    calendar: cal.rounds,
    rounds: new Map(),
    entries: new Map(),
    records: [],
    player: null,
  });
  assert.deepEqual(view.sideRecord, { hits: 0, calls: 0 });
  assert.equal(view.seasonScore, null, "no scored call, no season score — not 0.000");
  assert.deepEqual(view.counts, { commits: 0, reveals: 0, missing: 0 });
  assert.equal(view.calls.length, 0);
  assert.equal(view.baselines.crowd, null, "no crowd to compare against yet");
  assert.equal(view.calibration.unlocked, false);
  assert.match(view.calibration.locked, /Unlocks after 20 revealed calls · you're at 0/);
});

test("the season score is the program's own number, and missing counts fully", () => {
  const view = recordView({
    now: NOW,
    calendar: cal.rounds,
    rounds: new Map([[11, round({ roundId: 11 })]]),
    entries: new Map([[11, entry()]]),
    records: [record(11, 8_000)],
    player: player(),
  });
  // 28 125 bps over 9 scored calls = 0.3125 → 0.313, the number in 03's example season
  assert.equal(view.seasonScore?.value, "0.313");
  assert.equal(view.seasonScore?.scored, 9);
  assert.deepEqual(view.counts, { commits: 9, reveals: 8, missing: 1 });
  assert.equal(view.baselines.always50, "0.250");
});

test("the side record counts sides, and the list says what happened", () => {
  const rounds = new Map([
    [11, round({ roundId: 11 })], // called: Yes, sealed Up 80
    [12, round({ roundId: 12, outcome: Outcome.No })], // missed
    [13, round({ roundId: 13, outcomeMarginBps: 10 })], // too close (band 25)
  ]);
  const entries = new Map([
    [11, entry()],
    [12, entry({ pBps: 8_000 })],
    [13, entry({ pBps: 8_000 })],
  ]);
  const view = recordView({
    now: NOW,
    calendar: cal.rounds,
    rounds,
    entries,
    records: [record(11, 8_000), record(12, 8_000), record(13, 8_000)],
    player: player(),
  });
  assert.deepEqual(view.sideRecord, { hits: 1, calls: 2 }, "the close one counts for neither side");
  const statuses = view.calls.map((c) => c.status);
  assert.deepEqual(statuses, ["too close", "missed", "called"], "newest call first");
  assert.equal(view.calls[2].sealed, "Up, 80%");
  assert.equal(view.calls[2].outcome, "Yes");
  assert.equal(view.calls[2].brier, "0.040");
});

test("an unrevealed call is open until the window shuts, and missing only after", () => {
  const r = round({ roundId: 11 });
  const unrevealed = entry({ revealed: false, scored: false, scoreBps: 0 });
  assert.equal(statusOf({ now: r.outcomeTime + 60, round: r, entry: unrevealed }), "open");
  assert.equal(statusOf({ now: r.revealClose + 1, round: r, entry: unrevealed }), "missing");
  assert.equal(
    statusOf({ now: NOW, round: round({ roundId: 11, status: RoundStatus.Cancelled }), entry: unrevealed }),
    "no resolve",
  );
  assert.equal(statusOf({ now: NOW, round: undefined, entry: undefined }), "open");
});

test("the crowd baseline is computed, never guessed", () => {
  // The crowd's mean sits in bucket 13 → 65 %, the outcome was Yes: (1 − 0.65)² = 0.1225 exactly,
  // and three decimals make that 0.122 — the same rounding every number on this screen uses.
  const items = [{ entry: entry(), round: round({ roundId: 11 }) }];
  assert.equal(crowdBaseline(items), "0.122");
  // a call nobody revealed has no crowd, so it contributes nothing
  const empty = [{ entry: entry(), round: round({ roundId: 11, histogram: new Array(21).fill(0) }) }];
  assert.equal(crowdBaseline(empty), null);
});

test("the small pieces say what the document says", () => {
  assert.equal(shortAnswer(8_000), "Up, 80%");
  assert.equal(shortAnswer(2_000), "Down, 80%");
  assert.equal(shortAnswer(5_000), "50/50");
  assert.equal(dayLabel(Date.UTC(2026, 9, 6) / 1000), "6 OCT");
  assert.equal(copy.record.unlockAt, 20, "the threshold the owner set on 21.09.");
});
