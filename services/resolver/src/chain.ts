// On-chain reading and instruction building for the Observed program.
// Layouts mirror programs/observed/src/lib.rs; discriminators come from target/idl/observed.json.
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("48YybyMgkdzPQN5R3V1xsFHkUMxDvBDBDwW48cRTx2ni");

export const DISC = {
  setReference: Uint8Array.from([184, 96, 203, 159, 23, 67, 215, 242]),
  resolve: Uint8Array.from([246, 150, 236, 206, 108, 63, 58, 10]),
  scoreEntry: Uint8Array.from([231, 190, 137, 114, 174, 90, 253, 147]),
  cancelRound: Uint8Array.from([82, 70, 134, 54, 46, 96, 148, 8]),
  roundAccount: Uint8Array.from([87, 127, 165, 51, 73, 78, 116, 174]),
  entryAccount: Uint8Array.from([63, 18, 152, 113, 215, 246, 221, 250]),
} as const;

export const RoundStatus = { Open: 0, Closed: 1, Referenced: 2, Resolved: 3, Cancelled: 4 } as const;

export type Round = {
  pubkey: PublicKey;
  roundId: number;
  feedId: Uint8Array;
  commitClose: number;
  outcomeTime: number;
  revealClose: number;
  resolveDeadline: number;
  status: number;
  commitCount: number;
  revealCount: number;
};

export type Entry = {
  pubkey: PublicKey;
  round: PublicKey;
  sgtMint: PublicKey;
  revealed: boolean;
  scored: boolean;
};

const u8 = (b: Buffer, o: number) => b.readUInt8(o);
const i64 = (b: Buffer, o: number) => Number(b.readBigInt64LE(o));

/** Round layout: disc(8) round_id(4) terms_hash(32) feed_id(32) offset(4) max_conf(2) times(5×8) status outcome … */
export function decodeRound(pubkey: PublicKey, data: Buffer): Round {
  let o = 8;
  const roundId = data.readUInt32LE(o); o += 4;
  o += 32; // terms_hash
  const feedId = new Uint8Array(data.subarray(o, o + 32)); o += 32;
  o += 4 + 2; // offset_bps, max_conf_bps
  o += 8; // commit_open
  const commitClose = i64(data, o); o += 8;
  const outcomeTime = i64(data, o); o += 8;
  const revealClose = i64(data, o); o += 8;
  const resolveDeadline = i64(data, o); o += 8;
  const status = u8(data, o); o += 1;
  o += 1; // outcome
  o += 8 + 4 + 8 + 8 + 8 + 8 + 32; // ref_* + threshold + referencer
  o += 8 + 8 + 4 + 8 + 8 + 32; // evidence_* + resolver
  const commitCount = data.readUInt32LE(o); o += 4;
  const revealCount = data.readUInt32LE(o);
  return { pubkey, roundId, feedId, commitClose, outcomeTime, revealClose, resolveDeadline, status, commitCount, revealCount };
}

/** Entry layout: disc(8) round(32) sgt_mint(32) beneficiary(32) rent_refund_to(32) commitment(32) committed_at(8) revealed scored … */
export function decodeEntry(pubkey: PublicKey, data: Buffer): Entry {
  const round = new PublicKey(data.subarray(8, 40));
  const sgtMint = new PublicKey(data.subarray(40, 72));
  const revealed = data.readUInt8(168) === 1;
  const scored = data.readUInt8(171) === 1;
  return { pubkey, round, sgtMint, revealed, scored };
}

export const configPda = (gameId: bigint) => {
  const seed = Buffer.alloc(8);
  seed.writeBigUInt64LE(gameId);
  return PublicKey.findProgramAddressSync([Buffer.from("config"), seed], PROGRAM_ID)[0];
};
export const playerPda = (config: PublicKey, sgtMint: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("player"), config.toBuffer(), sgtMint.toBuffer()], PROGRAM_ID)[0];

export async function loadRounds(connection: Connection, config: PublicKey): Promise<Round[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58Disc(DISC.roundAccount) } }],
  });
  return accounts
    .map(({ pubkey, account }) => decodeRound(pubkey, Buffer.from(account.data)))
    .filter((r) => roundPdaFor(config, r.roundId).equals(r.pubkey))
    .sort((a, b) => a.roundId - b.roundId);
}

export const roundPdaFor = (config: PublicKey, roundId: number) => {
  const seed = Buffer.alloc(4);
  seed.writeUInt32LE(roundId);
  return PublicKey.findProgramAddressSync([Buffer.from("round"), config.toBuffer(), seed], PROGRAM_ID)[0];
};

/** Entries of one round that still need scoring (not scored yet). */
export async function loadUnscoredEntries(connection: Connection, round: PublicKey): Promise<Entry[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58Disc(DISC.entryAccount) } },
      { memcmp: { offset: 8, bytes: round.toBase58() } },
    ],
  });
  return accounts
    .map(({ pubkey, account }) => decodeEntry(pubkey, Buffer.from(account.data)))
    .filter((e) => !e.scored);
}

function bs58Disc(disc: Uint8Array): string {
  // getProgramAccounts memcmp wants base58; discriminators are short so this stays cheap
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = 0n;
  for (const byte of disc) num = num * 256n + BigInt(byte);
  let out = "";
  while (num > 0n) {
    out = ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const byte of disc) {
    if (byte !== 0) break;
    out = "1" + out;
  }
  return out;
}

const ix = (keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[], data: Uint8Array) =>
  new TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.from(data) });

export const setReferenceIx = (payer: PublicKey, config: PublicKey, round: PublicKey, priceUpdate: PublicKey) =>
  ix(
    [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: priceUpdate, isSigner: false, isWritable: false },
    ],
    DISC.setReference,
  );

export const resolveIx = (payer: PublicKey, config: PublicKey, round: PublicKey, priceUpdate: PublicKey) =>
  ix(
    [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: priceUpdate, isSigner: false, isWritable: false },
    ],
    DISC.resolve,
  );

export const scoreEntryIx = (config: PublicKey, round: PublicKey, entry: PublicKey, player: PublicKey) =>
  ix(
    [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: false },
      { pubkey: entry, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: false, isWritable: true },
    ],
    DISC.scoreEntry,
  );

export const cancelRoundIx = (config: PublicKey, round: PublicKey) =>
  ix(
    [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
    ],
    DISC.cancelRound,
  );
