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

  /**
   * §11.1 — the two states the input has before it has an answer, and the one moment the app
   * cannot do anything (owner, 22.09.2026).
   *
   * `howSure` exists because "Could go either way" is a real answer, not an empty field: a
   * slider nobody has touched must not read as if the player had deliberately chosen 50.
   */
  pickSideFirst: "Pick a side first.",
  howSure: "How sure?",
  waitingForWallet: "Waiting for your wallet.",

  /** The reminder offer (E3), approved 22.09.2026. */
  remindMe: "Remind me each evening",
  notNow: "Not now",

  /** Result, before the first reveal of the season (§3), approved 22.09.2026. */
  nothingRevealed: "Nothing revealed yet.",

  /**
   * Today, when open reveals ride along with tonight's seal (§2), approved 22.09.2026.
   * It replaces the invented "— they go out with this signature".
   */
  revealsRideAlong: "Yesterday's call opens in the same approval.",

  /**
   * The two buttons of the daily loop. They stood in Today.tsx as bare strings until
   * 22.09.2026 — the one place the screens were allowed to drift from the document.
   */
  button: { sealToday: "Seal today", reveal: "Reveal" },

  /** The headings of Record and Settings (§4, §7), approved 22.09.2026. */
  headings: {
    sideRecord: "Side record",
    seasonScore: "Season score",
    calls: "Calls",
    reminders: "Reminders",
    /** Only in the build that asks the memory question (approved 22.09.2026). */
    memoryLog: "Memory log",
  },

  /** The one button of the memory log (approved 22.09.2026). */
  copyButton: "Copy",

  /**
   * The quiet side path: open yesterday without sealing tonight (approved 22.09.2026).
   *
   * The normal evening is ONE approval for both — `revealsRideAlong` says so, and that is what
   * the big button does. This is for the evening where somebody wants to look and not play.
   */
  revealOnly: "Reveal only",

  /**
   * Only once the reveal is on chain: before that there is nothing for a stranger to check
   * (approved 22.09.2026).
   */
  checkYourself: "Check this call yourself →",

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

  /**
   * §3 — the sealed answer with the side but WITHOUT the number (approved 22.09.2026).
   *
   * The first stage of the reveal, when there is no sentence to stand alone. The percentage is
   * exactly what the memory question asks about, so it may not be on the screen before it; the
   * side may. A deliberate 50/50 has no side and gets nothing at all.
   */
  sealedSideOnly(pBps: number): string | null {
    if (pBps === 5_000) return null;
    return `You sealed: ${pBps > 5_000 ? this.side.up : this.side.down}.`;
  },

  /** §3 — the sealed answer, read back word for word, with the exact number. */
  sealedAnswer(pBps: number): string {
    if (pBps === 5_000) return "You sealed: 50/50.";
    const up = pBps > 5_000;
    const percent = (up ? pBps : 10_000 - pBps) / 100;
    return `You sealed: ${up ? "Up" : "Down"}, ${percent}% sure.`;
  },

  /**
   * The reveal, as a sequence (owner, 22.09.2026). The sentence stands alone first, and nothing
   * of the outcome is on the screen until the player asks for it — that tap is the whole moment
   * the app is built around.
   */
  faceIt: "Face it",

  /**
   * The memory question, behind a feature flag and skippable (owner, 22.09.2026).
   *
   * It is asked AFTER the outcome is shown, on purpose: what is being measured is the
   * difference between what you sealed and what you now remember sealing, and that difference
   * only exists once you know how it went. Asking before would measure recall, not drift.
   */
  memory: {
    question: "How sure were you last night?",
    sealedAndRemembered: (sealed: number, remembered: number) =>
      `You sealed ${sealed}%. You remembered ${remembered}%.`,
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

  /**
   * §11.5 — the record.
   *
   * There is no explaining line any more: the Brier left this screen on 22.09.2026, and the
   * owner decided the same day that nothing replaces it. `headings.seasonScore` stays only
   * because Settings still names the number the program keeps.
   */
  record: {
    sideRecord: (hits: number, calls: number) => `${hits} of ${calls} calls`,
    locked: (revealed: number) => `Unlocks after 20 revealed calls · you're at ${revealed}`,
    unlockAt: 20,
  },

  /**
   * What the deposit is, said BEFORE the wallet sheet opens (owner, 22.09.2026).
   *
   * Both amounts are handed in, never written into the text: they come from the account sizes
   * in core/funding.ts, and the date comes from the calendar. A number typed into a string is a
   * number that goes stale without anybody noticing.
   */
  deposit: {
    line: (sol: string, backBy: string) =>
      `No stakes. A ${sol} SOL deposit comes back to this wallet by ${backBy}.`,
    /** Only before the very first seal: the one amount that does not come back. */
    firstCall: (sol: string) =>
      `Your first call also opens your record: ${sol} SOL, once, not returned.`,
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
    /** The paste field, approved 22.09.2026 — it says what a backup code looks like. */
    placeholder: "64 characters",

    /**
     * What the player is told after pasting a code (owner, 22.09.2026). Four cases, and the
     * fourth is the one the old template got wrong: a code that opens nothing read as
     * "0 restored." — which looks like success. Now it says which of the two reasons it was.
     *
     * `recovered` are the calls whose commitment this code could rebuild; `lost` are entries
     * that sit on chain but cannot be opened with it — a different code, a different phone, or
     * a typo that still happened to be 64 hex characters.
     */
    restored(recovered: number, lost: number): string {
      const calls = (n: number) => `${n} ${n === 1 ? "call" : "calls"}`;
      if (recovered === 0) {
        return lost > 0 ? this.bad : "No open calls to restore.";
      }
      if (lost === 0) return `${calls(recovered)} restored.`;
      const rest =
        lost === 1
          ? "1 call can't be opened with this code — it will count as a miss."
          : `${lost} calls can't be opened with this code — they will count as misses.`;
      return `${calls(recovered)} restored. ${rest}`;
    },
  },
} as const;
