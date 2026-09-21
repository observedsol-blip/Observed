// "What others wrote" (E8) — read from the chain, and only shown when it checks out.
//
// The rule that makes this worth anything: a sentence counts as genuine only if the same wallet
// posted H(salt ‖ sentence) BEFORE the outcome, in the transaction that sealed. The salt becomes
// public with the reveal, so anyone can recompute it. A sentence without a matching seal memo is
// a sentence someone wrote after the fact — it is dropped, not shown with a warning.
//
// Nothing here trusts the RPC either: the memos are read from the transactions that touched the
// round account, and every one of them is checked locally.
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
  const sealHashes = new Map<string, string[]>(); // payer -> hex hashes posted before the outcome
  for (const tx of args.transactions) {
    if (tx.revealed) continue;
    for (const memo of tx.memos) {
      const hex = memo.trim().toLowerCase();
      if (/^[0-9a-f]{64}$/.test(hex)) {
        sealHashes.set(tx.payer, [...(sealHashes.get(tx.payer) ?? []), hex]);
      }
    }
  }

  const out: OthersSentence[] = [];
  const seen = new Set<string>();
  for (const tx of args.transactions) {
    if (!tx.revealed || !tx.saltHex) continue;
    if (args.self && tx.payer === args.self.toBase58()) continue;
    if (args.hidden?.has(tx.payer)) continue;
    if (seen.has(tx.payer)) continue; // one sentence per wallet and call

    const candidates = sealHashes.get(tx.payer) ?? [];
    if (candidates.length === 0) continue;

    for (const memo of tx.memos) {
      const sentence = memo.trim();
      if (sentence.length === 0) continue;
      if (new TextEncoder().encode(sentence).length > SENTENCE_LIMIT) continue;
      if (/^[0-9a-f]{64}$/.test(sentence)) continue; // that is a hash, not a sentence
      const hash = hexOf(sha256Of(tx.saltHex, sentence));
      if (!candidates.includes(hash)) continue; // written after the fact, or by someone else
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
