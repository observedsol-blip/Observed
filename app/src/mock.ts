/**
 * OBSERVED — the ONLY data source in this skeleton.
 *
 * Every number here comes from docs/03-SCREEN-MAP.md §Beispielzahlen.
 * No clock, no RPC, no wallet, no chain. Nothing in this file reads the device
 * time or the network; the strings below are what the screens render.
 */

/* ------------------------------------------------------------------ */
/* Mock states (driven from the Settings stub, never from Today/Result) */
/* ------------------------------------------------------------------ */



export type RecordState = 'default' | 'early_read';

export const RECORD_STATES: { key: RecordState; label: string }[] = [
  { key: 'default', label: 'Record · lock at 8 revealed' },
  { key: 'early_read', label: 'Record · early read at 12 revealed' },
];

/* ------------------------------------------------------------------ */
/* The 21-tick scale geometry — shared by input and distribution        */
/* ------------------------------------------------------------------ */

/** 0, 5, 10 … 100. Exactly 21 positions, 5% steps. */
export const TICKS: number[] = Array.from({ length: 21 }, (_, i) => i * 5);

/* ------------------------------------------------------------------ */
/* Today — round 42 · 17 SEP                                            */
/* ------------------------------------------------------------------ */

export const today = {
  roundLine: 'ROUND 42 · 17 SEP',
  genesis: 'Genesis · verified',
  /** relative form, shown before 12:00 UTC */
  question: 'Will SOL be more than 1% above its 12:00 UTC price at 00:00 UTC?',
  /** absolute form, shown once the reference is in */
  questionResolvedDetail: 'above $151.50 · 12:00 reference $150.00',
  windowLine: 'Seal by 12:00 UTC · 14:00 where you are',
  windowLineBusy: 'Network is busy — seal now',
  chanceLabel: 'chance this is Yes',
  primary: 'Seal today',
  sameSignature: 'Yesterday reveals in this same signature',
  cost:
    'No app fees. Network ≈ 0.0001 SOL per day · ≈ 0.002 SOL deposit, ' +
    'refunded when the round closes.',
  sealedStatus: 'Sealed · 09:12 UTC',
  sealedHint: 'Hidden until you reveal tomorrow.',
  pendingStatus: 'pending · observed at 00:00 UTC',
  pendingNextWindow: 'Next window 00:00 UTC · 02:00 where you are',
  missed: 'Window closed · next question 00:00 UTC',
  notEligible: 'No Genesis Token found in this wallet.',
  notEligibleDetail:
    'Eligibility is tied to this device: the Genesis Token minted to this phone ' +
    'is what counts, not the balance in the wallet.',
  notEligibleLink: 'Open Settings',
  noRound: 'No question today. Yesterday still reveals.',
  /** the value the user has not yet sealed */
  defaultProbability: 40,
} as const;

/* ------------------------------------------------------------------ */
/* Result — reading of round 41 · 16 SEP                                */
/* ------------------------------------------------------------------ */

/** 21 buckets at the same coordinates as TICKS. 63 revealed, mean 64. */
export const crowdBuckets: number[] = [
  0, 0, 1, 0, 1, 1, 2, 2, 3, 2, 4, 4, 5, 7, 8, 6, 6, 6, 3, 1, 1,
];

export const result = {
  kicker: 'READING · 16 SEP',
  question: 'Will SOL be more than 1% above its 12:00 UTC price at 00:00 UTC?',
  strikeBefore: 'pending',
  strikeAfter: 'observed',
  reading: 'It did not happen.',
  readingHappened: 'It happened.',
  outcomeMeta: 'Outcome · No',
  yourSentence: 'You gave Yes a 40% chance.',
  revealedPartial: '63 of 71 revealed · closes 12:00 UTC',
  revealedFinal: '63 revealed',
  facts: 'Crowd 64 · You 40',
  protocol: 'Brier 0.160 · Record 0.313 · 9 scored · 1 missing (counts as a full miss)',
  closing: 'One round added. No verdict on your skill.',
  yourProbability: 40,
  crowdMean: 64,
  noResolve: 'No valid reading in the window. Nobody scored.',
  noResolveReference: 'Reference 12:00–12:01 UTC · missing',
  noResolveOutcome: 'Outcome 00:00–00:01 UTC · missing',
  sampleBanner: 'Sample round · completed',
  sampleWindow: 'Yours starts 00:00 UTC · 02:00 where you are',
} as const;

export const evidence = {
  feed: 'Feed · SOL/USD · 0xef0d8b6f…f4b70e2c',
  reference: 'Reference · 12:00:00 UTC · 14:00 where you are · $150.00',
  referenceMeta: 'publish_time 12:00:00 · prev_publish_time 11:59:59 · confidence ±$0.04',
  outcome: 'Outcome · 00:00:00 UTC · 02:00 where you are · $149.82',
  outcomeMeta: 'publish_time 00:00:00 · prev_publish_time 23:59:59 · confidence ±$0.05',
  poster: 'This phone posted the oracle reading.',
  explorerReference: 'Reference transaction · 4Qv1…8TnZ',
  explorerOutcome: 'Outcome transaction · 7Kx9…2Jba',
} as const;

/** Only true in the mock state that demonstrates §6 Publication. */
export const thisPhonePosted = true;

/* ------------------------------------------------------------------ */
/* Record                                                              */
/* ------------------------------------------------------------------ */

export type RoundStatus = 'scored' | 'missing' | 'no resolve' | 'open';

export interface PastRound {
  round: number;
  date: string;
  question: string;
  /** P(Yes) in percent, or null when never revealed */
  probability: number | null;
  outcome: 'Yes' | 'No' | null;
  /** Brier as a 3-decimal string, or null */
  brier: string | null;
  status: RoundStatus;
}

const DAILY_QUESTION = 'Will SOL be more than 1% above its 12:00 UTC price at 00:00 UTC?';

/**
 * Nine commits, eight reveals, one missing → nine scored.
 * The eight Brier scores sum to 1.8125; with the missing round at 0.250 the
 * cumulative record is 2.8125 / 9 = 0.313 (the missing round counts as a full miss, 1.000).
 */
export const pastRounds: PastRound[] = [
  { round: 41, date: '16 SEP', question: DAILY_QUESTION, probability: 40, outcome: 'No', brier: '0.160', status: 'scored' },
  { round: 40, date: '15 SEP', question: DAILY_QUESTION, probability: 80, outcome: 'Yes', brier: '0.040', status: 'scored' },
  { round: 39, date: '14 SEP', question: DAILY_QUESTION, probability: 40, outcome: 'Yes', brier: '0.360', status: 'scored' },
  { round: 38, date: '13 SEP', question: DAILY_QUESTION, probability: 30, outcome: 'No', brier: '0.090', status: 'scored' },
  { round: 37, date: '12 SEP', question: DAILY_QUESTION, probability: 25, outcome: 'No', brier: '0.063', status: 'scored' },
  { round: 36, date: '11 SEP', question: DAILY_QUESTION, probability: 50, outcome: 'Yes', brier: '0.250', status: 'scored' },
  { round: 35, date: '10 SEP', question: DAILY_QUESTION, probability: 70, outcome: 'No', brier: '0.490', status: 'scored' },
  { round: 34, date: '9 SEP', question: DAILY_QUESTION, probability: 60, outcome: 'No', brier: '0.360', status: 'scored' },
  { round: 33, date: '8 SEP', question: DAILY_QUESTION, probability: null, outcome: 'Yes', brier: null, status: 'missing' },
];

export const record = {
  brier: '0.313',
  brierLabel: 'Cumulative Brier · includes missing',
  commits: 9,
  reveals: 8,
  missing: 1,
  countsLabel: 'Commits · Reveals · Missing',
  countsValue: '9 · 8 · 1',
  countsFootnote: 'missing counts as a full miss',
  baselines: 'Always 50%: 0.250 · Crowd: 0.211',
  calibrationLocked: "Unlocks after 21 revealed rounds · you're at 8",
  sampleToggle: 'Show sample record (36 rounds)',
  sampleBanner: 'Sample data · not your phone',
} as const;

/* ------------------------------------------------------------------ */
/* The early read (10–20 revealed rounds)                              */
/*                                                                     */
/* Owner addition — this copy is NOT in 03-SCREEN-MAP.md yet.          */
/* From 10 revealed rounds the Record shows a provisional finding with */
/* an uncertainty band instead of only the lock. It always names the   */
/* sample size and the band, and it never states a verdict. The        */
/* calibration curve itself stays locked until 21 revealed rounds.     */
/* ------------------------------------------------------------------ */

/** Below this many revealed rounds there is no early read at all. */
export const EARLY_READ_MIN_REVEALED = 10;
/** The calibration curve unlocks only here. */
export const CALIBRATION_MIN_REVEALED = 21;
/** Uncertainty band, in percentage points. */
export const EARLY_READ_BAND_PTS = 14;

export type Leaning = 'hot' | 'cold' | 'true';

/**
 * Derived, not asserted: the gap between the average probability given and how
 * often Yes actually happened. Inside the band the read is "true" — which is a
 * position on the scale, not a judgement.
 */
export function leaningOf(rounds: PastRound[], bandPts: number): Leaning {
  const revealed = rounds.filter((r) => r.probability !== null && r.outcome !== null);
  if (revealed.length === 0) return 'true';
  const meanP = revealed.reduce((s, r) => s + (r.probability as number), 0) / revealed.length;
  const yesRate =
    (revealed.filter((r) => r.outcome === 'Yes').length / revealed.length) * 100;
  const gap = meanP - yesRate;
  if (gap > bandPts) return 'hot';
  if (gap < -bandPts) return 'cold';
  return 'true';
}

export function earlyReadLine(rounds: PastRound[], bandPts: number): string {
  const revealed = rounds.filter((r) => r.probability !== null).length;
  return `Leaning ${leaningOf(rounds, bandPts)} · ${revealed} revealed · ±${bandPts} pts`;
}

/** Thirteen commits, twelve reveals, one missing. */
const earlyReadRaw: { round: number; date: string; p: number | null; outcome: 'Yes' | 'No' }[] = [
  { round: 41, date: '16 SEP', p: 70, outcome: 'No' },
  { round: 40, date: '15 SEP', p: 65, outcome: 'Yes' },
  { round: 39, date: '14 SEP', p: 80, outcome: 'No' },
  { round: 38, date: '13 SEP', p: 60, outcome: 'Yes' },
  { round: 37, date: '12 SEP', p: 55, outcome: 'No' },
  { round: 36, date: '11 SEP', p: 75, outcome: 'No' },
  { round: 35, date: '10 SEP', p: 50, outcome: 'Yes' },
  { round: 34, date: '9 SEP', p: 70, outcome: 'Yes' },
  { round: 33, date: '8 SEP', p: 60, outcome: 'No' },
  { round: 32, date: '7 SEP', p: 65, outcome: 'No' },
  { round: 31, date: '6 SEP', p: 55, outcome: 'Yes' },
  { round: 30, date: '5 SEP', p: 75, outcome: 'Yes' },
  { round: 29, date: '4 SEP', p: null, outcome: 'No' },
];

const earlyReadRounds: PastRound[] = earlyReadRaw.map((r) => {
  if (r.p === null) {
    return {
      round: r.round,
      date: r.date,
      question: DAILY_QUESTION,
      probability: null,
      outcome: r.outcome,
      brier: null,
      status: 'missing',
    };
  }
  const p = r.p / 100;
  const b = r.outcome === 'Yes' ? (1 - p) * (1 - p) : p * p;
  return {
    round: r.round,
    date: r.date,
    question: DAILY_QUESTION,
    probability: r.p,
    outcome: r.outcome,
    brier: b.toFixed(3),
    status: 'scored',
  };
});

/** Cumulative Brier including the missing round at 0.250, as 03 §4 requires. */
function cumulativeBrier(rounds: PastRound[]): string {
  const scored = rounds.filter((r) => r.status === 'scored' || r.status === 'missing');
  const total = scored.reduce(
    (s, r) => s + (r.brier === null ? 0.25 : Number(r.brier)),
    0,
  );
  return (total / scored.length).toFixed(3);
}

export const earlyRecord = {
  rounds: earlyReadRounds,
  brier: cumulativeBrier(earlyReadRounds),
  countsValue: '13 · 12 · 1',
  baselines: 'Always 50%: 0.250 · Crowd: 0.221',
  calibrationLocked: "Unlocks after 21 revealed rounds · you're at 12",
  earlyRead: earlyReadLine(earlyReadRounds, EARLY_READ_BAND_PTS),
};

/** Demo toggle from 03 §4. Deterministic, not random. */
export const sampleRecord = {
  brier: '0.214',
  countsValue: '36 · 34 · 2',
  baselines: 'Always 50%: 0.250 · Crowd: 0.207',
  calibrationLocked: null,
  rounds: Array.from({ length: 36 }, (_, i): PastRound => {
    const round = 41 - i;
    const day = ((41 - i - 1) % 30) + 1;
    const probability = TICKS[(i * 7) % 21];
    const outcome: 'Yes' | 'No' = (i * 5) % 3 === 0 ? 'Yes' : 'No';
    const p = probability / 100;
    const b = outcome === 'Yes' ? (1 - p) * (1 - p) : p * p;
    const missing = i === 11 || i === 25;
    return {
      round,
      date: `${day} ${i < 16 ? 'SEP' : 'AUG'}`,
      question: DAILY_QUESTION,
      probability: missing ? null : probability,
      outcome,
      brier: missing ? null : b.toFixed(3),
      status: missing ? 'missing' : 'scored',
    };
  }),
};

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const settings = {
  wallet: 'Wallet · 9xQe…7bTk',
  genesis: 'Genesis · verified',
  genesisMint: 'Mint · GNSis1…4vR2',
  authorityCalendar: 'calendar · Cal7kP…9mXw',
  authorityPause: 'pause · Pau3sE…1qLd',
  authorityUpgrade: 'upgrade · Upg8rA…6yHn',
  cost: today.cost,
  ownership: 'The answer belongs to the wallet that sealed it.',
  noCharge: 'Observed does not charge you.',
  pushTimes: 'Push · 02:00 and 14:00 where you are',
  backup: 'Export of the reveal backup · not in this version',
  publication: 'This phone posted the oracle reading for round 41 · 63 entries.',
} as const;
