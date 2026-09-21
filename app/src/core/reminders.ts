// Reminders (E3) — local notifications, scheduled on the phone.
//
// Owner's rules, 21.09.2026:
//   * LOCAL only. No remote push, no FCM, no server. The message for 16:00 is planned without
//     knowing the outcome; on a NO_RESOLVE day it is wrong, and that is accepted.
//   * Inexact scheduling. A few minutes late costs nothing; an extra permission does.
//   * POST_NOTIFICATIONS is requested only after the player taps "Remind me", never on start.
//
// The texts are the approved ones from docs/03-SCREEN-MAP.md §8.
import type { CalendarRound } from "../chain/calendar.ts";

export type Reminder = { id: string; atSeconds: number; title: string; body: string };

/** The wrapper around expo-notifications, so the planning logic stays testable. */
export interface Notifier {
  /** Whether the player already allowed notifications. Never asks. */
  granted(): Promise<boolean>;
  /** Asks. Only ever called from a tap on "Remind me". */
  request(): Promise<boolean>;
  schedule(reminder: Reminder): Promise<void>;
  cancelAll(): Promise<void>;
}

export const texts = {
  /** 16:00 UTC, the outcome of the call sealed yesterday. */
  outcomeWithSentence: "Yesterday's call is in. See what you wrote.",
  outcomeWithoutSentence: "Yesterday's call is in.",
  /** One hour before sealing closes. */
  lastHour: "One hour to seal today's answer.",
  /** The evening a call would expire unrevealed. */
  lastEvening: (weekday: string) =>
    `Last evening to reveal ${weekday}'s call. After that it counts as a miss.`,
} as const;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * What to schedule after a seal. Three kinds, and never more than a week ahead: the calendar is
 * fixed, but a phone that has not been opened in a week has other problems than a reminder.
 */
export function plan(args: {
  now: number;
  calendar: CalendarRound[];
  /** Calls that are sealed and still unrevealed, with the moment their window closes. */
  openReveals: { roundId: number; revealCloseSeconds: number }[];
  hasSentence: boolean;
}): Reminder[] {
  const out: Reminder[] = [];
  const horizon = args.now + 7 * 86_400;

  for (const round of args.calendar) {
    // 16:00 UTC — the outcome of the call that was sealed yesterday evening
    if (round.outcomeTime > args.now && round.outcomeTime < horizon) {
      out.push({
        id: `outcome-${round.roundId}`,
        atSeconds: round.outcomeTime,
        title: "Observed",
        body: args.hasSentence ? texts.outcomeWithSentence : texts.outcomeWithoutSentence,
      });
    }
    // one hour before sealing closes
    const lastHour = round.commitClose - 3600;
    if (lastHour > args.now && lastHour < horizon) {
      out.push({
        id: `last-hour-${round.roundId}`,
        atSeconds: lastHour,
        title: "Observed",
        body: texts.lastHour,
      });
    }
  }

  for (const open of args.openReveals) {
    // four hours before the 72 h window closes — enough to act, late enough to be the last word
    const at = open.revealCloseSeconds - 4 * 3600;
    if (at <= args.now || at >= horizon) continue;
    const round = args.calendar.find((r) => r.roundId === open.roundId);
    const weekday = round ? WEEKDAYS[new Date(round.commitClose * 1000).getUTCDay()] : "that";
    out.push({
      id: `last-evening-${open.roundId}`,
      atSeconds: at,
      title: "Observed",
      body: texts.lastEvening(weekday),
    });
  }

  return out.sort((a, b) => a.atSeconds - b.atSeconds);
}

/**
 * Rebuilds the whole schedule. Cancel first, then plan: the calendar is the truth, and a phone
 * that was off for three days must not fire yesterday's reminders.
 */
export async function reschedule(notifier: Notifier, reminders: Reminder[]): Promise<number> {
  if (!(await notifier.granted())) return 0;
  await notifier.cancelAll();
  for (const r of reminders) await notifier.schedule(r);
  return reminders.length;
}

/** The only place that may ask for the permission: behind a tap. */
export async function enableReminders(
  notifier: Notifier,
  reminders: Reminder[],
): Promise<{ granted: boolean; scheduled: number }> {
  const granted = (await notifier.granted()) || (await notifier.request());
  if (!granted) return { granted: false, scheduled: 0 };
  await notifier.cancelAll();
  for (const r of reminders) await notifier.schedule(r);
  return { granted: true, scheduled: reminders.length };
}
