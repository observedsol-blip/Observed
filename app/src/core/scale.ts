// The two scales, as arithmetic — no React, no drawing, therefore testable.
//
// Since 22.09.2026 they are deliberately NOT the same geometry (owner decision). The old rule
// was "input and distribution share one coordinate system", and it was wrong:
//
//   * The input asks how sure you are, after a side has been chosen. It cannot go below 50,
//     because 45 % Up is 55 % Down — two names for one answer. Drawn on a 0–100 track, the whole
//     left half was dead space that invited a gesture the code then silently undid.
//   * The distribution shows what the crowd answered. Those probabilities really do span 0–100,
//     and they sit in the 21 buckets the program counts.
//
// So: input 50…100 in 5-point steps (11 positions, labels 50 · 75 · 100), distribution 0…100 in
// 5-point steps (21 positions). E11 asks for exactly the first; the program stores the second.

/** The input never goes below 50 — there is no answer down there. */
export const INPUT_MIN = 50;
/** 50, 55 … 100 — eleven positions. */
export const INPUT_TICKS: number[] = Array.from({ length: 11 }, (_, i) => INPUT_MIN + i * 5);
/** The three that get a long tick and a label. */
export const INPUT_LABELLED = [50, 75, 100];

/** 0, 5 … 100 — the 21 buckets the program counts (BUCKET_STEP 500 in basis points). */
export const DISTRIBUTION_TICKS: number[] = Array.from({ length: 21 }, (_, i) => i * 5);

/** Rounds to the 5-point grid the program accepts, inside 0…100. */
export function snap(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) / 5) * 5;
}

/** The same for the input, which starts at 50. */
export function snapInput(value: number): number {
  return Math.max(INPUT_MIN, snap(value));
}

/** x of a 0–100 value on a track `width` wide with `edge` padding — the distribution. */
export function xFor(value: number, width: number, edge: number): number {
  const usable = Math.max(0, width - edge * 2);
  return edge + (Math.max(0, Math.min(100, value)) / 100) * usable;
}

/** x of a 50–100 value on the same track — the input. */
export function xForInput(value: number, width: number, edge: number): number {
  const usable = Math.max(0, width - edge * 2);
  const clamped = Math.max(INPUT_MIN, Math.min(100, value));
  return edge + ((clamped - INPUT_MIN) / (100 - INPUT_MIN)) * usable;
}

/** What a touch at `x` means on the input track. */
export function valueAtInput(x: number, width: number, edge: number): number {
  const usable = Math.max(1, width - edge * 2);
  return INPUT_MIN + ((x - edge) / usable) * (100 - INPUT_MIN);
}
