// The memory log: what the memory question was answered with, per entry.
//
// It exists to make the experiment evaluable at all (owner, 22.09.2026). Without it the answers
// sit in a keystore nobody can read, and "does what people remember drift from what they
// sealed" stays an opinion.
//
// Three rules it must keep, and the test file checks each one:
//   * no wallet address — the log says which CALL, never who
//   * no sentences — they are the one thing players write for themselves
//   * no network — it is built from this phone and read by this phone
//
// It only exists in the build that asks the question (ASK_MEMORY); everywhere else the entry
// is not in Settings at all.

/** One answered — or waved-away — memory question. */
export type MemoryLogRow = {
  roundId: number;
  /** The call's own day, UTC, as the record writes it: `6 OCT`. */
  date: string;
  /**
   * What was sealed, 50–100 — only once the call has been opened on chain. Before that the
   * number is this phone's note, and printing it would answer the question it belongs to.
   */
  sealedConfidence: number | null;
  /** What the player said they remembered, or null when they waved the question away. */
  remembered: number | null;
  /** Hours from the seal going out to the question being answered, one decimal. */
  hoursAfterSeal: number | null;
};

export function memoryLogRows(args: {
  notes: { roundId: number; confidence: number | null; atSeconds: number; sealedAt: number | null }[];
  /** `6 OCT` for a call, from the calendar — handed in so this stays free of date formatting. */
  dateOf: (roundId: number) => string;
  /** The sealed confidence, or null while the call is not opened yet. */
  sealedConfidenceOf: (roundId: number) => number | null;
}): MemoryLogRow[] {
  return args.notes
    .map((n) => ({
      roundId: n.roundId,
      date: args.dateOf(n.roundId),
      sealedConfidence: args.sealedConfidenceOf(n.roundId),
      remembered: n.confidence,
      hoursAfterSeal:
        n.sealedAt === null
          ? null
          : Math.round(((n.atSeconds - n.sealedAt) / 3600) * 10) / 10,
    }))
    .sort((a, b) => b.roundId - a.roundId);
}

/**
 * The log as plain text, for the clipboard. Mechanical on purpose: one line per call, the same
 * fields in the same order, so it can be pasted into anything and read by eye.
 */
export function memoryLogText(rows: MemoryLogRow[]): string {
  if (rows.length === 0) return "Memory log: nothing yet.";
  const lines = rows.map((r) => {
    const sealed = r.sealedConfidence === null ? "sealed —" : `sealed ${r.sealedConfidence}`;
    const remembered = r.remembered === null ? "skipped" : `remembered ${r.remembered}`;
    const after = r.hoursAfterSeal === null ? "" : ` · +${r.hoursAfterSeal}h`;
    return `${r.date} · call ${r.roundId} · ${sealed} · ${remembered}${after}`;
  });
  return ["Memory log", ...lines].join("\n");
}
