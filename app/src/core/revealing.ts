// Revealing: which calls are open, what goes into today's one transaction, and what the chain
// says afterwards.
//
// The reveal has no secret of its own — it needs the number and the salt from the seal record.
// Lose those and the answer counts as a full miss, which is why the secret is recoverable (E2).
import type { CalendarRound } from "../chain/calendar.ts";
import type { Entry, Round } from "../chain/layout.ts";
import { RoundStatus } from "../chain/ids.ts";
import type { SealRecord } from "./records.ts";

export type Revealable = {
  round: CalendarRound;
  record: SealRecord;
};

/**
 * What can be revealed right now: the call is resolved, its 72 h window is open, our Entry is
 * there and not yet revealed, and we still know the number and the salt.
 *
 * A cancelled call (NO_RESOLVE) is deliberately not revealable: nobody is scored, so asking for
 * an approval would spend one for nothing.
 */
export function revealableNow(args: {
  now: number;
  calendar: CalendarRound[];
  records: SealRecord[];
  roundState: (roundId: number) => Round | null;
  entryState: (roundId: number) => Entry | null;
}): Revealable[] {
  const out: Revealable[] = [];
  for (const record of args.records) {
    const round = args.calendar.find((r) => r.roundId === record.roundId);
    if (!round) continue;
    const onChain = args.roundState(record.roundId);
    const entry = args.entryState(record.roundId);
    if (!onChain || !entry) continue;
    if (onChain.status !== RoundStatus.Resolved) continue; // cancelled or not resolved yet
    if (entry.revealed) continue;
    if (args.now < onChain.outcomeTime || args.now >= onChain.revealClose) continue;
    out.push({ round, record });
  }
  return out.sort((a, b) => a.round.roundId - b.round.roundId);
}

/** How long the oldest open call still has, in seconds — for "Last evening to reveal". */
export function secondsLeft(items: Revealable[], roundState: (id: number) => Round | null, now: number): number | null {
  const deadlines = items
    .map((i) => roundState(i.round.roundId)?.revealClose)
    .filter((x): x is number => typeof x === "number");
  if (deadlines.length === 0) return null;
  return Math.min(...deadlines) - now;
}

/**
 * The three numbers the daily result needs, all derived from what the chain stores — no second
 * source of truth (03-SCREEN-MAP §11.6).
 */
export function outcomeFor(entry: Entry, round: Round): {
  kind: "called" | "missed-side" | "too-close" | "no-side";
  movedBps: number;
} {
  const movedBps = round.outcomeMarginBps;
  const tooClose = Math.abs(round.outcomeMarginBps) <= round.bandBps;
  if (tooClose) return { kind: "too-close", movedBps };
  if (entry.pBps === 5_000) return { kind: "no-side", movedBps };
  const saidYes = entry.pBps > 5_000;
  const wasYes = round.outcome === 1;
  return { kind: saidYes === wasYes ? "called" : "missed-side", movedBps };
}
