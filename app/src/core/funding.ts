// Is there enough SOL to seal? Checked BEFORE the wallet sheet opens (03-SCREEN-MAP §2).
//
// Why before: a wallet error at the approval is the worst place to learn this. The player has
// already decided, already tapped, and gets a message from an app that is not ours. The answer
// stays on the phone either way — that is what the copy says, and it is true, because the
// record is written before any of this.
export const LAMPORTS_PER_SOL = 1_000_000_000;
/** Rent-exemption of one Entry: (184 + 128) × 6960 lamports. It comes back when the call closes. */
export const ENTRY_RENT_LAMPORTS = (184 + 128) * 6_960;
/**
 * Rent-exemption of the Player account: (65 + 128) × 6960 lamports. Paid once, with the very
 * first seal — and it does NOT come back: the program has no instruction that closes a Player
 * (there is exactly one `close =` in lib.rs, and it belongs to the Entry). That is the one
 * amount a player really spends, so it is said out loud instead of hidden in a fee estimate.
 */
export const PLAYER_RENT_LAMPORTS = (65 + 128) * 6_960;
/**
 * What one evening actually costs in fees: one signature at 5 000 lamports. The whole evening —
 * reveals, the seal and the memos — is a single transaction with a single signature (matrix row
 * R4), and the app sets no priority price, so the fee does not depend on the compute units it
 * asks for.
 */
export const SIGNATURE_FEE_LAMPORTS = 5_000;
/** Base fee plus room for a priority fee on a busy evening. */
export const FEE_HEADROOM_LAMPORTS = 300_000;

/**
 * `0.0022` — the way the deposit lines write an amount. Four decimals by default, because that
 * is what the approved lines show; the fee needs six, since four would round 0.000005 down to
 * `0.0000` and the sentence would tell the player the evening is free.
 */
export const solText = (lamports: number, digits = 4) => {
  const factor = 10 ** digits;
  return (Math.round((lamports / LAMPORTS_PER_SOL) * factor) / factor).toFixed(digits);
};

/**
 * "30 Dec" — the day the LAST entry of the season can be closed, which is the honest answer to
 * "when do I get it back". Derived from the calendar, never written down twice: each round may
 * be closed at `max(reveal_close + close_after_secs, earliest_close_unix)` (lib.rs:445-450).
 */
export function lastDepositBack(
  calendar: { outcomeTime: number; closeAfterSecs: number; earliestCloseUnix: number }[],
  revealWindowSecs: number,
): number {
  return calendar.reduce(
    (latest, r) =>
      Math.max(latest, Math.max(r.outcomeTime + revealWindowSecs + r.closeAfterSecs, r.earliestCloseUnix)),
    0,
  );
}

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
