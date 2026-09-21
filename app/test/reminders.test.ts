// Reminders: what gets planned, and — more important — what never happens without a tap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Notifier, type Reminder, enableReminders, plan, reschedule, texts } from "../src/core/reminders.ts";
import type { Calendar } from "../src/chain/calendar.ts";

const cal: Calendar = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../tests/fixtures/calendar/season1.json"), "utf8"),
);
const round = cal.rounds[11];

class FakeNotifier implements Notifier {
  isGranted = false;
  asked = 0;
  scheduled: Reminder[] = [];
  cancels = 0;
  async granted() {
    return this.isGranted;
  }
  async request() {
    this.asked += 1;
    this.isGranted = true;
    return true;
  }
  async schedule(r: Reminder) {
    this.scheduled.push(r);
  }
  async cancelAll() {
    this.cancels += 1;
    this.scheduled = [];
  }
}

test("the permission is never asked without a tap", async () => {
  const notifier = new FakeNotifier();
  const reminders = plan({ now: round.commitOpen, calendar: cal.rounds, openReveals: [], hasSentence: false });
  const scheduled = await reschedule(notifier, reminders);

  assert.equal(notifier.asked, 0, "rescheduling must never open a permission dialog");
  assert.equal(scheduled, 0, "and nothing is scheduled while it is not granted");
});

test("the tap asks once, and then the schedule exists", async () => {
  const notifier = new FakeNotifier();
  const reminders = plan({ now: round.commitOpen, calendar: cal.rounds, openReveals: [], hasSentence: true });
  const result = await enableReminders(notifier, reminders);

  assert.equal(notifier.asked, 1);
  assert.equal(result.granted, true);
  assert.ok(result.scheduled > 0);
  // a second time it does not ask again
  await enableReminders(notifier, reminders);
  assert.equal(notifier.asked, 1);
});

test("what is planned: the outcome, the last hour, and the last evening of an open call", async () => {
  const now = round.commitOpen;
  const reminders = plan({
    now,
    calendar: cal.rounds,
    openReveals: [{ roundId: 9, revealCloseSeconds: now + 20 * 3600 }],
    hasSentence: true,
  });

  const kinds = reminders.map((r) => r.id.replace(/-\d+$/, ""));
  assert.ok(kinds.includes("outcome"));
  assert.ok(kinds.includes("last-hour"));
  assert.ok(kinds.includes("last-evening"));

  const outcome = reminders.find((r) => r.id === `outcome-${round.roundId}`)!;
  assert.equal(outcome.atSeconds, round.outcomeTime);
  assert.equal(outcome.body, texts.outcomeWithSentence);

  const lastHour = reminders.find((r) => r.id === `last-hour-${round.roundId}`)!;
  assert.equal(lastHour.atSeconds, round.commitClose - 3600);
  assert.equal(lastHour.body, "One hour to seal today's answer.");

  const lastEvening = reminders.find((r) => r.id === "last-evening-9")!;
  assert.equal(lastEvening.atSeconds, now + 16 * 3600, "four hours before the window closes");
  assert.match(lastEvening.body, /After that it counts as a miss\./);
});

test("without a sentence the outcome reminder does not promise one", async () => {
  const reminders = plan({
    now: round.commitOpen,
    calendar: cal.rounds,
    openReveals: [],
    hasSentence: false,
  });
  assert.equal(reminders.find((r) => r.id.startsWith("outcome-"))!.body, texts.outcomeWithoutSentence);
});

test("nothing is planned into the past, and not further than a week", async () => {
  const now = round.commitOpen;
  const reminders = plan({ now, calendar: cal.rounds, openReveals: [], hasSentence: false });
  for (const r of reminders) {
    assert.ok(r.atSeconds > now, `${r.id} is in the past`);
    assert.ok(r.atSeconds < now + 7 * 86_400, `${r.id} is further out than a week`);
  }
});

test("rescheduling cancels first — a phone that was off must not fire yesterday", async () => {
  const notifier = new FakeNotifier();
  notifier.isGranted = true;
  const reminders = plan({ now: round.commitOpen, calendar: cal.rounds, openReveals: [], hasSentence: false });
  await reschedule(notifier, reminders);
  const first = notifier.scheduled.length;
  await reschedule(notifier, reminders);
  assert.equal(notifier.cancels, 2);
  assert.equal(notifier.scheduled.length, first, "not doubled");
});
