// What the phone remembers about an answer, and in which order.
//
// The rule behind every state here: the record is written BEFORE the wallet is asked. A phone
// that dies during the approval must come back knowing what it was about to seal — otherwise
// the answer is lost and counts as a full miss.
export type SealStatus =
  /** Written down, nothing sent. The wallet has not been asked yet. */
  | "saved"
  /** A signature exists and the transaction went out. Not confirmed yet. */
  | "sent"
  /** The Entry is on chain and carries our commitment. Done. */
  | "confirmed"
  /** We sent something and do not know what happened. Never re-seal from here without asking
   *  the chain first — that is how you seal twice and lose the first answer. */
  | "unknown"
  /** The chain says no, and the window is still open: it can be tried again. */
  | "failed"
  /** The window closed without an Entry. Nothing to reveal, and nothing was scored. */
  | "missed";

export type SealRecord = {
  roundId: number;
  /** The answer itself, in the program's units. */
  pBps: number;
  /** Hex, derived from the season secret: salt = H(secret, roundId). */
  salt: string;
  /** The commitment we computed, hex — what the Entry on chain must carry. */
  commitment: string;
  /** Optional, stays on the phone unless `share` is true (E8/E13). */
  sentence?: string;
  share: boolean;
  status: SealStatus;
  /** Unix seconds. */
  savedAt: number;
  sentAt?: number;
  signature?: string;
  /** Last error, for the diagnosis screen — never shown as-is to the player. */
  note?: string;
};

export type RevealRecord = {
  roundId: number;
  status: "open" | "sent" | "confirmed" | "unknown" | "missed";
  signature?: string;
  sentAt?: number;
};

export const sealKey = (roundId: number) => `seal:${roundId}`;
export const revealKey = (roundId: number) => `reveal:${roundId}`;

/** A record is still actionable while its call can be sealed or revealed. */
export function isOpen(status: SealStatus): boolean {
  return status === "saved" || status === "sent" || status === "unknown" || status === "failed";
}
