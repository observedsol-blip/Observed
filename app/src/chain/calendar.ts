// The season calendar: which call is open, what its terms are, and the proof that they are the
// ones the owner published before the season started.
//
// The app ships the calendar file. It does not have to trust it: every round's terms hash is
// recomputed here and checked against the Merkle root that is on chain in Config.
import { sha256 } from "@noble/hashes/sha256";
import bs58 from "bs58";
import { CALENDAR_DEPTH, LEAF_TAG, NODE_TAG, NODE_TAG as _NODE, TERMS_DOMAIN } from "./ids.ts";

export type CalendarRound = {
  season: number;
  roundId: number;
  version: number;
  kind: number;
  sourceKind: number;
  feedId: string;
  priceAccount: string;
  /** Only a two-feed question has a second feed; every other kind leaves it out. */
  feedB?: string | null;
  offsetBps: number;
  maxConfBps: number;
  bandBps: number;
  windowSecs: number;
  maxAgeSecs: number;
  closeAfterSecs: number;
  earliestCloseUnix: number;
  commitOpen: number;
  commitClose: number;
  referenceTime: number;
  outcomeTime: number;
  revealCloseUtc: string;
  feed: string;
  measuredDay: string;
  question: string;
  /** Display only, never hashed: the line for an event day, or null. */
  context: string | null;
  termsHash: string;
  proof: string[];
};

export type Calendar = {
  season: number;
  merkleRoot: string;
  rounds: CalendarRound[];
};

const utf8 = (s: string) => new TextEncoder().encode(s);
const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)));
const bytesToHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
const u16le = (n: number) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
const u32le = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const i32le = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n, true); return b; };
const i64le = (n: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(n), true); return b; };

/** Byte-for-byte the same input as RoundTerms::hash in the program (terms v3). */
export function termsHash(r: CalendarRound): Uint8Array {
  return sha256(
    concat([
      utf8(TERMS_DOMAIN),
      u16le(r.season),
      u32le(r.roundId),
      Uint8Array.from([r.version, r.kind, r.sourceKind]),
      hexToBytes(r.feedId),
      bs58.decode(r.priceAccount),
      i32le(r.offsetBps),
      u16le(r.maxConfBps),
      u16le(r.bandBps),
      u16le(r.windowSecs),
      u16le(r.maxAgeSecs),
      u32le(r.closeAfterSecs),
      i64le(r.earliestCloseUnix),
      i64le(r.commitOpen),
      i64le(r.commitClose),
      i64le(r.referenceTime),
      i64le(r.outcomeTime),
    ]),
  );
}

/** Walks the proof exactly like `verify_leaf` in the program. */
export function verifyLeaf(hash: Uint8Array, roundId: number, proof: Uint8Array[], root: Uint8Array): boolean {
  if (proof.length !== CALENDAR_DEPTH) return false;
  let node = sha256(concat([Uint8Array.from([LEAF_TAG]), hash]));
  let index = roundId;
  for (const sibling of proof) {
    node =
      index % 2 === 0
        ? sha256(concat([Uint8Array.from([NODE_TAG]), node, sibling]))
        : sha256(concat([Uint8Array.from([NODE_TAG]), sibling, node]));
    index = Math.floor(index / 2);
  }
  return bytesToHex(node) === bytesToHex(root);
}

/**
 * Checks one round of the shipped calendar against the root that is on chain. The app calls this
 * before it seals: a calendar file that does not match the chain is a calendar the app must not
 * act on, no matter where it came from.
 */
export function roundIsInTheCalendar(r: CalendarRound, onChainRoot: Uint8Array): boolean {
  const recomputed = termsHash(r);
  if (bytesToHex(recomputed) !== r.termsHash) return false;
  return verifyLeaf(recomputed, r.roundId, r.proof.map(hexToBytes), onChainRoot);
}

/** The call whose sealing window contains `nowSecs`, or null between 04:00 and 16:00 UTC. */
export function openForSealing(cal: Calendar, nowSecs: number): CalendarRound | null {
  return cal.rounds.find((r) => nowSecs >= r.commitOpen && nowSecs < r.commitClose) ?? null;
}

/** Every call whose reveal window is open right now (at most three, since the window is 72 h). */
export function openForReveal(cal: Calendar, nowSecs: number): CalendarRound[] {
  return cal.rounds.filter(
    (r) => nowSecs >= r.outcomeTime && nowSecs < Date.parse(r.revealCloseUtc) / 1000,
  );
}

/** What the app shows while a call is open. Display only — never hashed. */
export function questionOf(r: CalendarRound): { question: string; context: string | null } {
  return { question: r.question, context: r.context };
}

export { bytesToHex, hexToBytes };
