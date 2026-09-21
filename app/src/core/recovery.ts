// Getting an open answer back after a reinstall.
//
// After an uninstall the phone has nothing: no salt, no number, no record. What it can get back
// is the secret (from the wallet signature) — and with it everything else, because the chain
// still holds the commitment: try all 21 possible answers, and the one whose commitment matches
// is the answer that was sealed. 21 hashes, no guessing, no trust.
import type { PublicKey } from "@solana/web3.js";
import { commitmentHash, saltFor } from "../chain/commitment.ts";
import { bytesToHex } from "../chain/calendar.ts";
import type { CalendarRound } from "../chain/calendar.ts";
import type { Entry } from "../chain/layout.ts";
import { roundPda } from "../chain/pda.ts";
import { BUCKET_STEP, MAX_P_BPS } from "../chain/ids.ts";
import { hexToBytes } from "../chain/calendar.ts";
import type { SealRecord } from "./records.ts";

/**
 * Recovers the sealed answer for one call, or null if this secret does not open this entry
 * (wrong wallet, wrong secret, or a random secret that is gone for good).
 */
export function recoverAnswer(args: {
  secret: Uint8Array;
  round: CalendarRound;
  entry: Entry;
  wallet: PublicKey;
  sgtMint: PublicKey;
}): SealRecord | null {
  const salt = saltFor(args.secret, args.round.roundId);
  const onChain = bytesToHex(args.entry.commitment);
  for (let pBps = 0; pBps <= MAX_P_BPS; pBps += BUCKET_STEP) {
    const candidate = commitmentHash({
      round: roundPda(args.round.roundId),
      termsHash: hexToBytes(args.round.termsHash),
      sgtMint: args.sgtMint,
      beneficiary: args.wallet,
      pBps,
      salt,
    });
    if (bytesToHex(candidate) === onChain) {
      return {
        roundId: args.round.roundId,
        pBps,
        salt: bytesToHex(salt),
        commitment: onChain,
        share: false,
        status: "confirmed",
        savedAt: args.entry.committedAt,
        note: "recovered from the chain after a reinstall",
      };
    }
  }
  return null;
}

/** The same for every call that still has an open entry — what a fresh install runs once. */
export function recoverAll(args: {
  secret: Uint8Array;
  calendar: CalendarRound[];
  entries: { round: CalendarRound; entry: Entry }[];
  wallet: PublicKey;
  sgtMint: PublicKey;
}): { recovered: SealRecord[]; lost: number[] } {
  const recovered: SealRecord[] = [];
  const lost: number[] = [];
  for (const { round, entry } of args.entries) {
    const r = recoverAnswer({ secret: args.secret, round, entry, wallet: args.wallet, sgtMint: args.sgtMint });
    if (r) recovered.push(r);
    else lost.push(round.roundId);
  }
  return { recovered, lost };
}
