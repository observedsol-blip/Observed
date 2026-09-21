// Is there enough SOL to seal? Checked BEFORE the wallet sheet opens (03-SCREEN-MAP §2).
//
// Why before: a wallet error at the approval is the worst place to learn this. The player has
// already decided, already tapped, and gets a message from an app that is not ours. The answer
// stays on the phone either way — that is what the copy says, and it is true, because the
// record is written before any of this.
export const LAMPORTS_PER_SOL = 1_000_000_000;
/** Rent-exemption of one Entry: (184 + 128) × 6960 lamports. It comes back when the call closes. */
export const ENTRY_RENT_LAMPORTS = (184 + 128) * 6_960;
/** Base fee plus room for a priority fee on a busy evening. */
export const FEE_HEADROOM_LAMPORTS = 300_000;

export type FundingCheck = {
  ok: boolean;
  needLamports: number;
  balanceLamports: number;
  /** What the player has to add, rounded up to a readable number of SOL. */
  shortfallSol: number;
};

/**
 * `alreadySealedThisCall` matters: revealing an existing entry costs a fee but no new rent, and
 * a player who only reveals should not be told to top up for rent they already paid.
 */
export function checkFunding(args: {
  balanceLamports: number;
  needsNewEntry: boolean;
}): FundingCheck {
  const need = (args.needsNewEntry ? ENTRY_RENT_LAMPORTS : 0) + FEE_HEADROOM_LAMPORTS;
  const missing = Math.max(0, need - args.balanceLamports);
  return {
    ok: args.balanceLamports >= need,
    needLamports: need,
    balanceLamports: args.balanceLamports,
    shortfallSol: Math.ceil((missing / LAMPORTS_PER_SOL) * 1000) / 1000,
  };
}

/** The number the copy shows: "you need about 0.003 SOL". */
export const needAboutSol = (check: FundingCheck) =>
  Math.ceil((check.needLamports / LAMPORTS_PER_SOL) * 1000) / 1000;
