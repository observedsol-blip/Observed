// The app ships the calendar, but it does not trust it: every terms hash is recomputed and
// every round is proven against the root that is on chain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Calendar,
  bytesToHex,
  hexToBytes,
  openForReveal,
  openForSealing,
  roundIsInTheCalendar,
  termsHash,
  verifyLeaf,
} from "../src/chain/calendar.ts";

const cal: Calendar = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../tests/fixtures/calendar/season1.json"), "utf8"),
);
const root = hexToBytes(cal.merkleRoot);

test("the app recomputes every terms hash of the season", () => {
  assert.equal(cal.rounds.length, 64);
  for (const r of cal.rounds) {
    assert.equal(bytesToHex(termsHash(r)), r.termsHash, `terms hash of round ${r.roundId}`);
  }
});

test("every round proves against the published root", () => {
  for (const r of cal.rounds) {
    assert.ok(roundIsInTheCalendar(r, root), `round ${r.roundId} does not prove`);
  }
});

test("a tampered calendar does not prove — this is what the check is for", () => {
  const tampered = { ...cal.rounds[11], offsetBps: 100 };
  assert.equal(roundIsInTheCalendar(tampered, root), false, "a changed threshold must not pass");
  const wrongProof = { ...cal.rounds[11], proof: cal.rounds[12].proof };
  assert.equal(roundIsInTheCalendar(wrongProof, root), false, "a foreign proof must not pass");
  assert.equal(verifyLeaf(termsHash(cal.rounds[11]), 12, cal.rounds[11].proof.map(hexToBytes), root), false);
});

test("the season is the mix the owner decided: direction every day, movement on five", () => {
  const events = cal.rounds.filter((r) => r.kind === 1);
  assert.equal(cal.rounds.filter((r) => r.kind === 0).length, 59);
  assert.deepEqual(
    events.map((r) => r.measuredDay.split(" ")[1]),
    ["2026-10-02", "2026-10-14", "2026-10-29", "2026-11-06", "2026-11-10"],
  );
  for (const e of events) assert.ok(e.context, `event round ${e.roundId} needs its context line`);
  for (const r of cal.rounds.filter((x) => x.kind === 0)) {
    assert.equal(r.offsetBps, 0, "a direction round has no threshold");
    assert.equal(r.context, null, "a normal day has no context line");
  }
});

test("which call is open when", () => {
  const r = cal.rounds[11];
  assert.equal(openForSealing(cal, r.commitOpen + 60)?.roundId, 11, "just after the window opens");
  assert.equal(openForSealing(cal, r.commitClose - 1)?.roundId, 11, "one second before it closes");
  assert.equal(openForSealing(cal, r.commitClose + 1), null, "between 04:00 and 16:00 nothing is open");

  // the 72 h window: at 16:05 on the day of round 11's outcome, three calls are revealable
  const atOutcome = r.outcomeTime + 300;
  const open = openForReveal(cal, atOutcome).map((x) => x.roundId);
  assert.deepEqual(open, [9, 10, 11], "three open calls, oldest first");
  assert.equal(openForReveal(cal, r.outcomeTime - 1).includes(r), false, "not before the outcome");
});

test("a call whose window closed is gone from the reveal list", () => {
  const r = cal.rounds[11];
  const closesAt = Date.parse(r.revealCloseUtc) / 1000;
  assert.equal(closesAt - r.outcomeTime, 72 * 3600);
  assert.ok(openForReveal(cal, closesAt - 1).some((x) => x.roundId === 11));
  assert.equal(openForReveal(cal, closesAt).some((x) => x.roundId === 11), false);
});
