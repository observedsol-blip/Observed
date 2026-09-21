// The optional sentence (E13) and how it is made checkable without being public too early (E8).
//
// At seal time the app writes H(salt ‖ sentence) into a memo. At reveal time it writes the
// sentence itself. Anyone can then check that the sentence existed before the outcome: the salt
// becomes public with the reveal, so H(salt ‖ sentence) can be recomputed against the older memo.
//
// Only when the player switched sharing on. Otherwise no memo exists and the sentence never
// leaves the phone.
import { sha256 } from "@noble/hashes/sha256";
import { hexToBytes } from "../chain/calendar.ts";

/** Max length of a shared sentence, in bytes — the transaction has to stay under 1 232 B. */
export const SENTENCE_LIMIT = 140;

export function sha256Of(saltHex: string, sentence: string): Uint8Array {
  const salt = hexToBytes(saltHex);
  const text = new TextEncoder().encode(sentence);
  const both = new Uint8Array(salt.length + text.length);
  both.set(salt, 0);
  both.set(text, salt.length);
  return sha256(both);
}

/** What the app refuses before it costs an approval. */
export function checkSentence(sentence: string): { ok: boolean; bytes: number } {
  const bytes = new TextEncoder().encode(sentence).length;
  return { ok: bytes <= SENTENCE_LIMIT, bytes };
}

/** The check a reader does later: does this sentence match the hash that was sealed? */
export function sentenceMatches(saltHex: string, sentence: string, sealedHash: Uint8Array): boolean {
  const computed = sha256Of(saltHex, sentence);
  return computed.length === sealedHash.length && computed.every((b, i) => b === sealedHash[i]);
}
