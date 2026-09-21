// "What others wrote" (E8) — read from the chain, and only shown when it checks out.
//
// The rule that makes this worth anything: a sentence counts as genuine only if the same wallet
// posted H(salt ‖ sentence) in the VERY transaction that carried its commit for this call, as
// the only 64-hex memo in it. The salt becomes public with the reveal, so anyone can recompute
// it. A sentence without such a memo is a sentence written after the fact — it is dropped, not
// shown with a warning.
//
// Why the commit transaction, and not "some memo before the outcome" (owner, 21.09.2026): the
// first version took every 64-hex memo from every transaction that touched the round and never
// looked at the time at all. A player could read the outcome at 16:00, write the sentence that
// fits it, post its hash in a cheap transaction that touches the round (`score_entry` is
// permissionless and does exactly that), reveal afterwards — and be shown as somebody who knew
// it in advance. That was proven against this code before this rule replaced it.
//
// The strict form needs no clock: the program refuses a commit outside the sealing window, so a
// memo in the same successful transaction is necessarily older than the outcome. The chain does
// the timing; this file only reads it. Two hashes in that transaction, or a hash anywhere else,
// count for nothing — the claim is "this is the sentence I sealed", and that has to be one.
import type { PublicKey } from "@solana/web3.js";
import { sha256Of } from "./sentence.ts";
import { SENTENCE_LIMIT } from "./sentence.ts";

/** One transaction that touched the round account, reduced to what matters here. */
export type MemoTransaction = {
  signature: string;
  /** Unix seconds, from the ledger. */
  blockTime: number | null;
  /** The wallet that paid — the one that sealed or revealed. */
  payer: string;
  /** Every SPL memo of that transaction, in order. */
  memos: string[];
  /**
   * True if this transaction contained a commit for THIS round. Only such a transaction can
   * carry a seal memo, and only the program's own window check makes that memo early enough.
   */
  committed: boolean;
  /** True if this transaction contained a reveal for this round. */
  revealed: boolean;
  /** The salt that was revealed, hex — only present on a reveal. */
  saltHex?: string;
  /** The probability revealed, for display next to the sentence. */
  pBps?: number;
};

export type OthersSentence = {
  payer: string;
  sentence: string;
  pBps: number;
  /** The signature that revealed it, so anyone can look it up. */
  signature: string;
};

/**
 * Pairs seal memos with reveal memos and keeps only the sentences that verify.
 *
 * `hidden` is the client-side moderation the owner asked for: a payer the player has hidden
 * never appears again, and that decision stays on the phone.
 */
export function verifiedSentences(args: {
  transactions: MemoTransaction[];
  /** base58 payers the player chose not to see. */
  hidden?: Set<string>;
  /** Excluded so the player does not read their own sentence back as "someone else". */
  self?: PublicKey | null;
}): OthersSentence[] {
  // payer -> the one hash that wallet sealed with. A payer whose commit transaction is not
  // unambiguous is dropped entirely; ambiguity is not something to resolve in the player's
  // favour, it is a reason to show nothing.
  const sealHash = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const tx of args.transactions) {
    if (!tx.committed) continue;
    const hashes = tx.memos
      .map((m) => m.trim().toLowerCase())
      .filter((m) => /^[0-9a-f]{64}$/.test(m));
    if (hashes.length !== 1 || sealHash.has(tx.payer)) {
      ambiguous.add(tx.payer);
      continue;
    }
    sealHash.set(tx.payer, hashes[0]);
  }

  const out: OthersSentence[] = [];
  const seen = new Set<string>();
  for (const tx of args.transactions) {
    if (!tx.revealed || !tx.saltHex) continue;
    if (args.self && tx.payer === args.self.toBase58()) continue;
    if (args.hidden?.has(tx.payer)) continue;
    if (seen.has(tx.payer)) continue; // one sentence per wallet and call

    if (ambiguous.has(tx.payer)) continue;
    const sealed = sealHash.get(tx.payer);
    if (!sealed) continue; // nothing was sealed with the commit: nothing to verify against

    for (const memo of tx.memos) {
      const sentence = memo.trim();
      if (sentence.length === 0) continue;
      if (new TextEncoder().encode(sentence).length > SENTENCE_LIMIT) continue;
      if (/^[0-9a-f]{64}$/.test(sentence)) continue; // that is a hash, not a sentence
      if (hexOf(sha256Of(tx.saltHex, sentence)) !== sealed) continue; // written after the fact
      out.push({
        payer: tx.payer,
        sentence,
        pBps: tx.pBps ?? 5_000,
        signature: tx.signature,
      });
      seen.add(tx.payer);
      break;
    }
  }
  return out;
}

const hexOf = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
