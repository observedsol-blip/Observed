// The Record, derived from the chain and the local records — no second source of truth.
//
// Everything here comes from three places: the `Player` account (the program's own counters and
// score sum), the `Round` and `Entry` accounts of the season, and the seal records on the phone.
// Nothing is remembered that the chain could answer, and nothing is invented: a season that has
// not started reads as zero, not as an empty poster.
//
// Until 22.09.2026 this screen drew from `app/src/mock.ts` — stale times, "rounds" instead of
// "calls", the calibration threshold at 21 instead of 20, and a missing reveal counted as 0.250
// although the program has charged a full 1.000 since the review on 18.09.
import { RoundStatus, Outcome, MAX_P_BPS } from "../chain/ids.ts";
import type { CalendarRound } from "../chain/calendar.ts";
import type { Entry, Player, Round } from "../chain/layout.ts";
import { copy } from "../copy.ts";
import { brierBps } from "../chain/commitment.ts";
import { crowdMean, sideRecord, streakOf } from "./day.ts";
import { outcomeFor } from "./revealing.ts";
import type { SealRecord } from "./records.ts";

/** One line of the list of past calls (03 §4). */
export type PastCall = {
  roundId: number;
  /** "6 OCT", from the call's own closing date in UTC. */
  date: string;
  question: string;
  /** `You sealed: Up, 80% sure.` shortened to `Up, 80%` — the document's own wording. */
  sealed: string | null;
  /**
   * Whether this call has been opened on chain. Until it has, `sealed` is this phone's own
   * note, and a build that asks "how sure were you last night?" must not print the answer in
   * the list underneath (owner, 22.09.2026).
   */
  revealed: boolean;
  outcome: "Yes" | "No" | null;
  /** The states 03 §4 lists, word for word. */
  status: "called" | "missed" | "too close" | "no side" | "missing" | "no resolve" | "open";
  /** This call's Brier, once it is scored. */
  brier: string | null;
};

export type RecordView = {
  /** `4 of 6 calls` — only calls with a side, without the close ones. */
  sideRecord: { hits: number; calls: number };
  streak: string;
  /** The season score the program keeps: score_sum / scored_rounds. */
  seasonScore: { value: string; scored: number } | null;
  counts: { commits: number; reveals: number; missing: number };
  /** Always 50 % is a constant; the crowd is computed from the same calls the player was scored on. */
  baselines: { always50: string; crowd: string | null };
  calibration: { unlocked: boolean; revealed: number; locked: string };
  calls: PastCall[];
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "6 OCT", in UTC — the same day the call is named after everywhere else. */
export function dayLabel(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Brier with three decimals, the way every number in this screen is written. */
const three = (bps: number) => (bps / 10_000).toFixed(3);

export function recordView(args: {
  now: number;
  calendar: CalendarRound[];
  rounds: Map<number, Round>;
  entries: Map<number, Entry>;
  records: SealRecord[];
  player: Player | null;
}): RecordView {
  const items: { entry: Entry; round: Round }[] = [];
  for (const [roundId, entry] of args.entries) {
    const round = args.rounds.get(roundId);
    if (round) items.push({ entry, round });
  }

  const revealedIds = new Set([...args.entries].filter(([, e]) => e.revealed).map(([id]) => id));
  const streak = streakOf(
    args.records,
    revealedIds,
    (id) => args.rounds.get(id)?.status === RoundStatus.Resolved,
  );

  // The season score is the program's, not ours: score_sum over scored_rounds, in basis points.
  const scored = args.player?.scoredRounds ?? 0;
  const seasonScore =
    args.player && scored > 0
      ? { value: three(args.player.scoreSum / scored), scored }
      : null;

  return {
    sideRecord: sideRecord(items),
    streak: copy.streak(streak),
    seasonScore,
    counts: {
      commits: args.player?.commits ?? 0,
      reveals: args.player?.reveals ?? 0,
      // The program has no `missing` field: it is commits minus reveals minus what is still open.
      missing: args.player?.missingScored ?? 0,
    },
    baselines: {
      always50: three(brierBps(5_000, true)),
      crowd: crowdBaseline(items),
    },
    calibration: {
      unlocked: revealedIds.size >= copy.record.unlockAt,
      revealed: revealedIds.size,
      locked: copy.record.locked(revealedIds.size),
    },
    calls: pastCalls(args),
  };
}

/**
 * What the crowd scored on the same calls the player was scored on.
 *
 * Measured against the crowd's mean answer per call, which is what the program's histogram
 * gives. Only resolved calls with a revealed crowd count — a call nobody revealed has no crowd.
 * `null` while there is nothing to compare against; the screen then shows no crowd baseline
 * rather than a made-up one.
 */
export function crowdBaseline(items: { entry: Entry; round: Round }[]): string | null {
  let sum = 0;
  let n = 0;
  for (const { round } of items) {
    if (round.status !== RoundStatus.Resolved) continue;
    const mean = crowdMean(round);
    if (mean === null) continue;
    // The crowd's mean is a probability in basis points; the program's grid is 500 bps wide.
    const onGrid = Math.round(mean / 500) * 500;
    sum += brierBps(Math.min(MAX_P_BPS, Math.max(0, onGrid)), round.outcome === Outcome.Yes);
    n += 1;
  }
  return n === 0 ? null : three(sum / n);
}

function pastCalls(args: {
  now: number;
  calendar: CalendarRound[];
  rounds: Map<number, Round>;
  entries: Map<number, Entry>;
  records: SealRecord[];
}): PastCall[] {
  const out: PastCall[] = [];
  for (const call of args.calendar) {
    const round = args.rounds.get(call.roundId);
    const entry = args.entries.get(call.roundId);
    const record = args.records.find((r) => r.roundId === call.roundId);
    // A call this phone never touched is not part of its record.
    if (!entry && !record) continue;

    const sealedPBps = entry?.revealed ? entry.pBps : (record?.pBps ?? null);
    out.push({
      roundId: call.roundId,
      date: dayLabel(call.commitClose),
      question: call.question,
      sealed: sealedPBps === null ? null : shortAnswer(sealedPBps),
      revealed: entry?.revealed === true,
      outcome:
        round?.status === RoundStatus.Resolved
          ? round.outcome === Outcome.Yes
            ? "Yes"
            : "No"
          : null,
      status: statusOf({ now: args.now, round, entry }),
      brier: entry?.scored ? three(entry.scoreBps) : null,
    });
  }
  return out.sort((a, b) => b.roundId - a.roundId);
}

/** `Up, 80%` — §4's own short form of the sealed answer. */
export function shortAnswer(pBps: number): string {
  if (pBps === 5_000) return "50/50";
  const up = pBps > 5_000;
  return `${up ? "Up" : "Down"}, ${(up ? pBps : 10_000 - pBps) / 100}%`;
}

/** The seven states 03 §4 names. "open" is one of them — never "missing" before the window shuts. */
export function statusOf(args: {
  now: number;
  round: Round | undefined;
  entry: Entry | undefined;
}): PastCall["status"] {
  const { now, round, entry } = args;
  if (!round || !entry) return "open";
  if (round.status === RoundStatus.Cancelled) return "no resolve";
  if (round.status !== RoundStatus.Resolved) return "open";
  if (!entry.revealed) return now < round.revealClose ? "open" : "missing";
  const { kind } = outcomeFor(entry, round);
  return kind === "called"
    ? "called"
    : kind === "missed-side"
      ? "missed"
      : kind === "too-close"
        ? "too close"
        : "no side";
}
