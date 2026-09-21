// Every user-facing string of the daily loop, word for word from docs/03-SCREEN-MAP.md §11
// (owner-approved, 21.09.2026). One place, so the screens cannot drift from the document.
//
// Word rule (owner, 21.09.2026): user-facing it is a "call", never a "round".
export const copy = {
  side: { up: "Up", down: "Down" },

  /** §11.1 — the confidence words, symmetrical. */
  confidence(pBps: number): string {
    const up = pBps > 5_000;
    const p = up ? pBps : 10_000 - pBps;
    const side = up ? "Up" : "Down";
    if (p === 5_000) return "Could go either way";
    if (p <= 6_500) return `Leaning ${side}`;
    if (p <= 8_500) return `Fairly sure: ${side}`;
    return `Very sure: ${side}`;
  },

  /** §11.2 — the sentence field. */
  sentence: {
    headingFor: (pBps: number) =>
      pBps === 5_000
        ? "What makes this hard to call?"
        : `What tipped you toward ${pBps > 5_000 ? "Up" : "Down"}?`,
    hint: "One sentence for tomorrow. Optional.",
    share: "Share it after the reveal",
    shareHint: "Private until you reveal. If shared, it's public and permanent on Solana.",
    limit: 140,
  },

  /** §3 — the sealed answer, read back word for word, with the exact number. */
  sealedAnswer(pBps: number): string {
    if (pBps === 5_000) return "You sealed: 50/50.";
    const up = pBps > 5_000;
    const percent = (up ? pBps : 10_000 - pBps) / 100;
    return `You sealed: ${up ? "Up" : "Down"}, ${percent}% sure.`;
  },

  /** §11.3 — the daily result. */
  verdict: {
    called: "You called the side.",
    missed: "It went the other way.",
    tooClose: "Too close to call.",
    tooCloseDetail: (feed: string, movedPercent: string) =>
      `${feed} moved ${movedPercent}% — inside the measurement band. A different reading could have flipped it, so it doesn't count for or against your side record.`,
    noSide: "You didn't pick a side.",
  },

  streak: (n: number) => (n === 1 ? "First evening." : `${n} evenings in a row.`),

  /** §11.4 — the sentences of the others. */
  others: { heading: "What others wrote", empty: "Nobody shared a sentence this time." },

  /** §11.5 — the record. */
  record: {
    explain: "Your side record counts calls. Your season score measures how sure you were.",
    sideRecord: (hits: number, calls: number) => `${hits} of ${calls} calls`,
    locked: (revealed: number) => `Unlocks after 20 revealed calls · you're at ${revealed}`,
    unlockAt: 20,
  },

  /** §2 — the states that block sealing. */
  notEnoughSol: {
    title: (needSol: number) => `Not enough SOL to seal · you need about ${needSol} SOL`,
    body: "Your answer is saved on this phone. Add SOL and seal before 04:00 UTC.",
  },
  noGenesisToken: "No Genesis Token found in this wallet.",
  windowClosed: "Window closed · next question 16:00 UTC",
  openReveals: (n: number) => `${n} ${n === 1 ? "call" : "calls"} still open to reveal`,

  /**
   * Backup and restore (E2) — approved by the owner, 21.09.2026.
   *
   * The word is "backup code", never "key" and never "recovery". A field that asks for a "key"
   * or a "recovery phrase" is the pattern people are robbed with, and an app that trains it has
   * no business asking for trust.
   */
  backup: {
    line: "Backup code",
    sub: "Needed to reveal open calls after reinstalling.",
    copyButton: "Copy backup code",
    copied:
      "Copied. Keep it private — with it, someone could see your sealed answers before you reveal them.",
    restoreTitle: "Restore your open calls",
    restoreBody: "Paste the backup code you copied from Observed.",
    notYourPhrase:
      "This is not your wallet's recovery phrase. Never paste that here — or anywhere.",
    restoreButton: "Restore",
    skip: "Skip — open calls will count as misses",
    bad: "This code doesn't match your sealed calls.",
    /** Onboarding, under "Reinstalling can forfeit a pending answer." */
    onboarding: "You can copy a backup code in Settings.",
  },
} as const;
