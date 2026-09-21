// What the two screens show, derived in one place from chain state plus local records.
//
// The screens must not decide anything: every line they draw comes out of here, and everything
// here comes from the chain or from a record that was written before an approval. That is what
// makes the daily loop testable without a phone.
import { RoundStatus } from "../chain/ids.ts";
import type { CalendarRound } from "../chain/calendar.ts";
import type { Entry, Round } from "../chain/layout.ts";
import { copy } from "../copy.ts";
import type { SealRecord } from "./records.ts";
import { checkFunding, needAboutSol } from "./funding.ts";
import { outcomeFor } from "./revealing.ts";

export type TodayView =
  | { phase: "no-call"; openReveals: number }
  | { phase: "closed"; text: string; openReveals: number }
  | {
      phase: "open";
      roundId: number;
      question: string;
      context: string | null;
      /** null until the player picks a side. */
      pBps: number | null;
      confidence: string | null;
      sentenceHeading: string;
      sealedAt?: number;
      blocked?: { kind: "no-sgt"; text: string } | { kind: "no-sol"; title: string; body: string };
      openReveals: number;
    }
  | { phase: "sealed"; roundId: number; question: string; sealedAt: number; openReveals: number };

export function todayView(args: {
  now: number;
  calendar: CalendarRound[];
  record: SealRecord | null;
  draftPBps: number | null;
  openReveals: number;
  hasGenesisToken: boolean;
  balanceLamports: number;
}): TodayView {
  const round = args.calendar.find((r) => args.now >= r.commitOpen && args.now < r.commitClose);
  if (!round) {
    return args.calendar.some((r) => args.now < r.commitOpen)
      ? { phase: "closed", text: copy.windowClosed, openReveals: args.openReveals }
      : { phase: "no-call", openReveals: args.openReveals };
  }
  if (args.record?.status === "confirmed") {
    return {
      phase: "sealed",
      roundId: round.roundId,
      question: round.question,
      sealedAt: args.record.savedAt,
      openReveals: args.openReveals,
    };
  }
  const pBps = args.draftPBps ?? args.record?.pBps ?? null;
  const funding = checkFunding({ balanceLamports: args.balanceLamports, needsNewEntry: true });
  return {
    phase: "open",
    roundId: round.roundId,
    question: round.question,
    context: round.context,
    pBps,
    confidence: pBps === null ? null : copy.confidence(pBps),
    sentenceHeading: copy.sentence.headingFor(pBps ?? 5_000),
    blocked: !args.hasGenesisToken
      ? { kind: "no-sgt", text: copy.noGenesisToken }
      : funding.ok
        ? undefined
        : { kind: "no-sol", title: copy.notEnoughSol.title(needAboutSol(funding)), body: copy.notEnoughSol.body },
    openReveals: args.openReveals,
  };
}

export type ResultView = {
  question: string;
  context: string | null;
  /** §3: the sentence first, then the sealed answer, then the verdict, then the streak. */
  sentence: string | null;
  sealedAnswer: string;
  verdict: string;
  verdictDetail: string | null;
  /** Only when the call was too close AND no side was picked (owner decision 21.09.). */
  verdictSubline: string | null;
  streak: string;
  crowd: { mean: number | null; revealed: number };
  /** The 21 buckets the program counts, for the distribution. */
  crowdBuckets: number[];
  /** The player's own answer as a percentage, for the cursor in the distribution. */
  ownPercent: number;
  /** Sentences of others, already checked against their seal memos (E8). Empty until then. */
  others: string[];
};

export function resultView(args: {
  round: Round;
  calendar: CalendarRound;
  entry: Entry;
  record: SealRecord | null;
  streak: number;
  /** Already verified against their seal memos — this function does not check them. */
  others?: string[];
}): ResultView {
  const { kind, movedBps } = outcomeFor(args.entry, args.round);
  const moved = (Math.abs(movedBps) / 100).toFixed(2);
  const feed = args.calendar.feed.split("/")[0];
  const noSide = args.entry.pBps === 5_000;

  const verdict =
    kind === "called"
      ? copy.verdict.called
      : kind === "missed-side"
        ? copy.verdict.missed
        : kind === "too-close"
          ? copy.verdict.tooClose
          : copy.verdict.noSide;

  return {
    question: args.calendar.question,
    context: args.calendar.context,
    sentence: args.record?.sentence ?? null,
    sealedAnswer: copy.sealedAnswer(args.entry.pBps),
    verdict,
    verdictDetail: kind === "too-close" ? copy.verdict.tooCloseDetail(feed, moved) : null,
    // "Too close to call." wins; "You didn't pick a side." moves underneath it.
    verdictSubline: kind === "too-close" && noSide ? copy.verdict.noSide : null,
    streak: copy.streak(args.streak),
    crowd: { mean: crowdMean(args.round), revealed: args.round.revealCount },
    crowdBuckets: args.round.histogram,
    ownPercent: args.entry.pBps / 100,
    others: args.others ?? [],
  };
}

/** The crowd's average answer, from the histogram the program keeps. */
export function crowdMean(round: Round): number | null {
  const total = round.histogram.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const sum = round.histogram.reduce((acc, count, i) => acc + count * i * 500, 0);
  return Math.round(sum / total);
}

/** Evenings in a row with a reveal — the streak counts revealed evenings, not hits (§11.6). */
export function streakOf(records: SealRecord[], revealedRoundIds: Set<number>): number {
  const sealed = records.filter((r) => r.status === "confirmed").sort((a, b) => b.roundId - a.roundId);
  let streak = 0;
  for (const r of sealed) {
    if (!revealedRoundIds.has(r.roundId)) break;
    streak += 1;
  }
  return streak;
}

/** The side record: calls with a side, minus the ones that were too close to count. */
export function sideRecord(items: { entry: Entry; round: Round }[]): { hits: number; calls: number } {
  let hits = 0;
  let calls = 0;
  for (const { entry, round } of items) {
    if (!entry.revealed || round.status !== RoundStatus.Resolved) continue;
    const { kind } = outcomeFor(entry, round);
    if (kind === "too-close" || kind === "no-side") continue;
    calls += 1;
    if (kind === "called") hits += 1;
  }
  return { hits, calls };
}
