// The design states, as the same views the chain produces.
//
// One screen, two data sources: this file exists so the design can be reviewed without a wallet
// while the screens themselves stay the ones that run for real. Numbers come from the example
// round in docs/03-SCREEN-MAP.md ("Beispielzahlen") — a real call of the real calendar.
import type { ResultView, TodayView } from "./core/day.ts";
import { copy } from "./copy.ts";

export type DesignState =
  | "open"
  | "open_no_sol"
  | "open_no_sgt"
  | "sealed"
  | "closed"
  | "no_call"
  | "open_with_reveals";

const QUESTION = "Will SOL be higher at 16:00 than at 04:02 UTC on 2026-10-06?";

export function mockToday(state: DesignState): TodayView {
  switch (state) {
    case "closed":
      return { phase: "closed", text: copy.windowClosed, openReveals: 0 };
    case "no_call":
      return { phase: "no-call", openReveals: 0 };
    case "sealed":
      return { phase: "sealed", roundId: 11, question: QUESTION, sealedAt: 0, openReveals: 0 };
    default: {
      const base: TodayView = {
        phase: "open",
        roundId: 11,
        question: QUESTION,
        context: null,
        pBps: null,
        confidence: null,
        sentenceHeading: copy.sentence.headingFor(5_000),
        openReveals: state === "open_with_reveals" ? 2 : 0,
      };
      if (state === "open_no_sol") {
        return { ...base, blocked: { kind: "no-sol", title: copy.notEnoughSol.title(0.003), body: copy.notEnoughSol.body } };
      }
      if (state === "open_no_sgt") {
        return { ...base, blocked: { kind: "no-sgt", text: copy.noGenesisToken } };
      }
      return base;
    }
  }
}

export type ResultDesignState = "called" | "missed" | "too_close" | "no_side" | "nothing";

export function mockResult(state: ResultDesignState): ResultView | null {
  if (state === "nothing") return null;
  const buckets = Array.from({ length: 21 }, (_, i) => (i === 13 ? 63 : 0));
  const base: ResultView = {
    question: QUESTION,
    context: null,
    sentence: "Funding flipped negative overnight.",
    sealedAnswer: copy.sealedAnswer(8_000),
    verdict: copy.verdict.called,
    verdictDetail: null,
    verdictSubline: null,
    streak: copy.streak(3),
    crowd: { mean: 6_400, revealed: 63 },
    crowdBuckets: buckets,
    ownPercent: 80,
    others: [],
  };
  switch (state) {
    case "missed":
      return { ...base, verdict: copy.verdict.missed };
    case "too_close":
      return {
        ...base,
        verdict: copy.verdict.tooClose,
        verdictDetail: copy.verdict.tooCloseDetail("SOL", "0.10"),
      };
    case "no_side":
      return { ...base, sealedAnswer: copy.sealedAnswer(5_000), ownPercent: 50, verdict: copy.verdict.noSide };
    default:
      return base;
  }
}

/** What the design switcher in Settings offers — the same unions the screens draw from. */
export const TODAY_STATES: { key: DesignState; label: string }[] = [
  { key: "open", label: "open" },
  { key: "open_with_reveals", label: "open + reveals" },
  { key: "open_no_sol", label: "too little SOL" },
  { key: "open_no_sgt", label: "no Genesis Token" },
  { key: "sealed", label: "sealed" },
  { key: "closed", label: "window closed" },
  { key: "no_call", label: "no call today" },
];

export const RESULT_STATES: { key: ResultDesignState; label: string }[] = [
  { key: "called", label: "called the side" },
  { key: "missed", label: "other way" },
  { key: "too_close", label: "too close" },
  { key: "no_side", label: "no side" },
  { key: "nothing", label: "nothing yet" },
];

