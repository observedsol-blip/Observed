// Byte layouts of the four accounts, mirrored from programs/observed/src/lib.rs.
// Checked against fixtures the program itself serialised (app/test/layout.test.ts) — if anyone
// reorders a field in Rust, those tests go red. Read with DataView, never with Buffer: the app
// runs in Hermes, the tests in node, and the two disagree about what Buffer is.
import { PublicKey } from "@solana/web3.js";

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const u8 = (b: Uint8Array, o: number) => b[o];
const bool = (b: Uint8Array, o: number) => b[o] === 1;
const u16 = (b: Uint8Array, o: number) => view(b).getUint16(o, true);
const u32 = (b: Uint8Array, o: number) => view(b).getUint32(o, true);
const i32 = (b: Uint8Array, o: number) => view(b).getInt32(o, true);
const i64 = (b: Uint8Array, o: number) => Number(view(b).getBigInt64(o, true));
const u64 = (b: Uint8Array, o: number) => Number(view(b).getBigUint64(o, true));
const key = (b: Uint8Array, o: number) => new PublicKey(b.subarray(o, o + 32));
const bytes32 = (b: Uint8Array, o: number) => b.slice(o, o + 32);

export const CONFIG_OFFSET = {
  version: 8,
  gameId: 9,
  calendarAuthority: 17,
  pauseAuthority: 49,
  paused: 81,
  nextRoundId: 82,
  season: 86,
  calendarRoot: 88,
  firstRoundId: 120,
  maxRoundId: 124,
  bump: 128,
  size: 129,
} as const;

/** Terms v3 (498 B since close_after_secs and earliest_close_unix were added). */
export const ROUND_OFFSET = {
  roundId: 8,
  termsHash: 12,
  version: 44,
  kind: 45,
  sourceKind: 46,
  feedId: 47,
  priceAccount: 79,
  offsetBps: 111,
  maxConfBps: 115,
  bandBps: 117,
  windowSecs: 119,
  maxAgeSecs: 121,
  closeAfterSecs: 123,
  earliestCloseUnix: 127,
  commitOpen: 135,
  commitClose: 143,
  referenceTime: 151,
  outcomeTime: 159,
  revealClose: 167,
  resolveDeadline: 175,
  status: 183,
  outcome: 184,
  reference: 185,
  evidence: 269,
  thresholdMantissa: 353,
  thresholdLowMantissa: 361,
  outcomeMarginBps: 369,
  commitCount: 373,
  revealCount: 377,
  histogram: 381,
  reserved: 465,
  bump: 497,
  size: 498,
} as const;

export const READING_OFFSET = {
  price: 0,
  conf: 8,
  expo: 16,
  publishTime: 20,
  postedSlot: 28,
  submittedSlot: 36,
  submittedAt: 44,
  submitter: 52,
  size: 84,
} as const;

export const ENTRY_OFFSET = {
  round: 8,
  sgtMint: 40,
  beneficiary: 72,
  rentRefundTo: 104,
  commitment: 136,
  committedAt: 168,
  revealed: 176,
  pBps: 177,
  scored: 179,
  scoredAsMissing: 180,
  scoreBps: 181,
  bump: 183,
  size: 184,
} as const;

export const PLAYER_OFFSET = {
  sgtMint: 8,
  commits: 40,
  reveals: 44,
  missingScored: 48,
  scoreSum: 52,
  scoredRounds: 60,
  bump: 64,
  size: 65,
} as const;

export type Config = {
  version: number;
  gameId: number;
  calendarAuthority: PublicKey;
  pauseAuthority: PublicKey;
  paused: boolean;
  nextRoundId: number;
  season: number;
  calendarRoot: Uint8Array;
  firstRoundId: number;
  maxRoundId: number;
};

export type Reading = {
  price: number;
  conf: number;
  expo: number;
  publishTime: number;
  postedSlot: number;
  submittedSlot: number;
  submittedAt: number;
  submitter: PublicKey;
};

export type Round = {
  pubkey: PublicKey;
  roundId: number;
  termsHash: Uint8Array;
  kind: number;
  feedId: Uint8Array;
  priceAccount: PublicKey;
  offsetBps: number;
  bandBps: number;
  windowSecs: number;
  maxAgeSecs: number;
  closeAfterSecs: number;
  earliestCloseUnix: number;
  commitOpen: number;
  commitClose: number;
  referenceTime: number;
  outcomeTime: number;
  revealClose: number;
  resolveDeadline: number;
  status: number;
  outcome: number;
  reference: Reading;
  evidence: Reading;
  outcomeMarginBps: number;
  commitCount: number;
  revealCount: number;
  histogram: number[];
};

export type Entry = {
  pubkey: PublicKey;
  round: PublicKey;
  sgtMint: PublicKey;
  beneficiary: PublicKey;
  rentRefundTo: PublicKey;
  commitment: Uint8Array;
  committedAt: number;
  revealed: boolean;
  pBps: number;
  scored: boolean;
  scoredAsMissing: boolean;
  scoreBps: number;
};

export type Player = {
  sgtMint: PublicKey;
  commits: number;
  reveals: number;
  missingScored: number;
  scoreSum: number;
  scoredRounds: number;
};

export function decodeConfig(data: Uint8Array): Config {
  const o = CONFIG_OFFSET;
  return {
    version: u8(data, o.version),
    gameId: u64(data, o.gameId),
    calendarAuthority: key(data, o.calendarAuthority),
    pauseAuthority: key(data, o.pauseAuthority),
    paused: bool(data, o.paused),
    nextRoundId: u32(data, o.nextRoundId),
    season: u16(data, o.season),
    calendarRoot: bytes32(data, o.calendarRoot),
    firstRoundId: u32(data, o.firstRoundId),
    maxRoundId: u32(data, o.maxRoundId),
  };
}

export function decodeReading(data: Uint8Array, at: number): Reading {
  const o = READING_OFFSET;
  return {
    price: i64(data, at + o.price),
    conf: u64(data, at + o.conf),
    expo: i32(data, at + o.expo),
    publishTime: i64(data, at + o.publishTime),
    postedSlot: u64(data, at + o.postedSlot),
    submittedSlot: u64(data, at + o.submittedSlot),
    submittedAt: i64(data, at + o.submittedAt),
    submitter: key(data, at + o.submitter),
  };
}

export function decodeRound(pubkey: PublicKey, data: Uint8Array): Round {
  const o = ROUND_OFFSET;
  const histogram: number[] = [];
  for (let i = 0; i < 21; i++) histogram.push(u32(data, o.histogram + i * 4));
  return {
    pubkey,
    roundId: u32(data, o.roundId),
    termsHash: bytes32(data, o.termsHash),
    kind: u8(data, o.kind),
    feedId: bytes32(data, o.feedId),
    priceAccount: key(data, o.priceAccount),
    offsetBps: i32(data, o.offsetBps),
    bandBps: u16(data, o.bandBps),
    windowSecs: u16(data, o.windowSecs),
    maxAgeSecs: u16(data, o.maxAgeSecs),
    closeAfterSecs: u32(data, o.closeAfterSecs),
    earliestCloseUnix: i64(data, o.earliestCloseUnix),
    commitOpen: i64(data, o.commitOpen),
    commitClose: i64(data, o.commitClose),
    referenceTime: i64(data, o.referenceTime),
    outcomeTime: i64(data, o.outcomeTime),
    revealClose: i64(data, o.revealClose),
    resolveDeadline: i64(data, o.resolveDeadline),
    status: u8(data, o.status),
    outcome: u8(data, o.outcome),
    reference: decodeReading(data, o.reference),
    evidence: decodeReading(data, o.evidence),
    outcomeMarginBps: i32(data, o.outcomeMarginBps),
    commitCount: u32(data, o.commitCount),
    revealCount: u32(data, o.revealCount),
    histogram,
  };
}

export function decodeEntry(pubkey: PublicKey, data: Uint8Array): Entry {
  const o = ENTRY_OFFSET;
  return {
    pubkey,
    round: key(data, o.round),
    sgtMint: key(data, o.sgtMint),
    beneficiary: key(data, o.beneficiary),
    rentRefundTo: key(data, o.rentRefundTo),
    commitment: bytes32(data, o.commitment),
    committedAt: i64(data, o.committedAt),
    revealed: bool(data, o.revealed),
    pBps: u16(data, o.pBps),
    scored: bool(data, o.scored),
    scoredAsMissing: bool(data, o.scoredAsMissing),
    scoreBps: u16(data, o.scoreBps),
  };
}

export function decodePlayer(data: Uint8Array): Player {
  const o = PLAYER_OFFSET;
  return {
    sgtMint: key(data, o.sgtMint),
    commits: u32(data, o.commits),
    reveals: u32(data, o.reveals),
    missingScored: u32(data, o.missingScored),
    scoreSum: u64(data, o.scoreSum),
    scoredRounds: u32(data, o.scoredRounds),
  };
}

/** A token account of Token-2022: mint, owner, amount — the only three fields the app needs. */
export const TOKEN_ACCOUNT_OFFSET = { mint: 0, owner: 32, amount: 64 } as const;
/** The base account is 165 bytes. Anything shorter is not one (audit 21.09.2026, finding 9). */
export const TOKEN_ACCOUNT_BASE_LEN = 165;

export class NotATokenAccount extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotATokenAccount";
  }
}

export function decodeTokenAccount(data: Uint8Array) {
  if (data.length < TOKEN_ACCOUNT_BASE_LEN) {
    throw new NotATokenAccount(`token account is ${data.length} bytes, expected at least 165`);
  }
  return {
    mint: key(data, TOKEN_ACCOUNT_OFFSET.mint),
    owner: key(data, TOKEN_ACCOUNT_OFFSET.owner),
    amount: u64(data, TOKEN_ACCOUNT_OFFSET.amount),
  };
}
