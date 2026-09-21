// The answer itself, as arithmetic: side + how sure ↔ p_bps, and when that counts as an answer.
//
// It lives in core, not in the screen, for the same reason as everything else here: the rule
// that decides whether an approval may be asked for must be testable without a phone.
import { INPUT_MIN, snapInput } from "./scale.ts";

export type Side = "up" | "down" | null;

/** p_bps for a side and a confidence in percent: Up 80 → 8000, Down 80 → 2000. */
export function toPBps(side: Side, confidence: number): number {
  if (side === null) return 5_000;
  return side === "up" ? confidence * 100 : 10_000 - confidence * 100;
}

/** The other direction, for a record that was already sealed. */
export function fromPBps(pBps: number): { side: Side; confidence: number } {
  if (pBps === 5_000) return { side: null, confidence: INPUT_MIN };
  const up = pBps > 5_000;
  return { side: up ? "up" : "down", confidence: (up ? pBps : 10_000 - pBps) / 100 };
}

/**
 * The program only accepts steps of 5 percentage points, and never below 50 on the chosen side —
 * 45 % Up is 55 % Down, and saying it twice would be two names for one answer.
 */
export const clampToStep = snapInput;

/**
 * May the day be sealed?
 *
 * Both halves have to be a decision. Until 22.09.2026 only the side counted, so a tap on `Up`
 * armed the button while the untouched scale still sat at 50 — and sealing then wrote 50/50,
 * "no side", for a player who had just picked one. The new label made that visible: the screen
 * said `How sure?` and the button said "go" (owner, 22.09.2026).
 *
 * Touching the scale and leaving it at 50 is fine. That is a deliberate 50, and the difference
 * between the two is the whole point.
 */
export function canSeal(args: { side: Side; confidenceTouched: boolean }): boolean {
  return args.side !== null && args.confidenceTouched;
}
