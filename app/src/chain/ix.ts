// Instruction builders and the one transaction the app sends per day.
//
// The daily transaction is the whole product in one signature: reveal every call that is still
// open, seal today's, and — only if the player asked for it — two memos with the sentence.
// It must fit in 1 232 bytes. That is checked here, before the wallet is opened, because a
// transaction that is too large fails after the approval, and an approval spent for nothing is
// the one thing a daily habit does not survive.
import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Blockhash,
} from "@solana/web3.js";
import {
  CU_COMMIT,
  CU_REVEAL,
  cuForMemo,
  IX,
  MEMO_ID,
  PROGRAM_ID,
  SYSTEM_ID,
  TOKEN_2022_ID,
  TX_SIZE_LIMIT,
} from "./ids.ts";
import { assertProbability } from "./commitment.ts";
import { configPda, entryPda, playerPda, roundPda } from "./pda.ts";

const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({ pubkey, isSigner, isWritable });

function data(disc: Uint8Array, ...rest: Uint8Array[]): Buffer {
  const total = disc.length + rest.reduce((n, r) => n + r.length, 0);
  const out = new Uint8Array(total);
  out.set(disc, 0);
  let at = disc.length;
  for (const r of rest) {
    out.set(r, at);
    at += r.length;
  }
  return Buffer.from(out);
}
const u16le = (n: number) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };

export function commitIx(args: {
  wallet: PublicKey;
  sgtMint: PublicKey;
  sgtTokenAccount: PublicKey;
  roundId: number;
  commitment: Uint8Array;
}): TransactionInstruction {
  const config = configPda();
  const round = roundPda(args.roundId, config);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      meta(args.wallet, true, true),
      meta(args.sgtMint, false, false),
      meta(args.sgtTokenAccount, false, false),
      meta(config, false, false),
      meta(round, false, true),
      meta(entryPda(round, args.sgtMint), false, true),
      meta(playerPda(args.sgtMint, config), false, true),
      meta(TOKEN_2022_ID, false, false),
      meta(SYSTEM_ID, false, false),
    ],
    data: data(IX.commit, args.commitment),
  });
}

export function revealIx(args: {
  wallet: PublicKey;
  sgtMint: PublicKey;
  roundId: number;
  pBps: number;
  salt: Uint8Array;
}): TransactionInstruction {
  assertProbability(args.pBps);
  const config = configPda();
  const round = roundPda(args.roundId, config);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      meta(args.wallet, true, true),
      meta(config, false, false),
      meta(round, false, true),
      meta(entryPda(round, args.sgtMint), false, true),
      meta(playerPda(args.sgtMint, config), false, true),
    ],
    data: data(IX.reveal, u16le(args.pBps), args.salt),
  });
}

/** An SPL memo. No accounts: the payer signs the transaction, that is enough. */
export function memoIx(payload: Uint8Array | string): TransactionInstruction {
  const bytes = typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
  return new TransactionInstruction({ programId: MEMO_ID, keys: [], data: Buffer.from(bytes) });
}

export type DailyPlan = {
  wallet: PublicKey;
  sgtMint: PublicKey;
  sgtTokenAccount: PublicKey;
  /** Calls to reveal, oldest first. At most three can ever be open at once. */
  reveals: { roundId: number; pBps: number; salt: Uint8Array }[];
  /** Today's seal, if the window is open and the player answered. */
  seal?: { roundId: number; commitment: Uint8Array };
  /** Only when the player switched "Share it after the reveal" on. */
  memos?: Uint8Array[];
  priorityMicroLamports?: number;
};

export type BuiltDaily = {
  instructions: TransactionInstruction[];
  computeUnits: number;
  /** Serialised size with one signature — what the 1 232 byte limit applies to. */
  size: number;
};

/**
 * Builds the daily transaction and measures it. Throws if it would not fit, so the caller can
 * drop the memos or split the reveals BEFORE asking for an approval.
 */
export function buildDaily(plan: DailyPlan, blockhash: Blockhash = "11111111111111111111111111111111"): BuiltDaily {
  const instructions: TransactionInstruction[] = [];
  let computeUnits = 0;

  for (const r of plan.reveals) {
    instructions.push(revealIx({ wallet: plan.wallet, sgtMint: plan.sgtMint, ...r }));
    computeUnits += CU_REVEAL;
  }
  if (plan.seal) {
    instructions.push(
      commitIx({
        wallet: plan.wallet,
        sgtMint: plan.sgtMint,
        sgtTokenAccount: plan.sgtTokenAccount,
        roundId: plan.seal.roundId,
        commitment: plan.seal.commitment,
      }),
    );
    computeUnits += CU_COMMIT;
  }
  for (const m of plan.memos ?? []) {
    instructions.push(memoIx(m));
    computeUnits += cuForMemo(m.length);
  }
  if (instructions.length === 0) throw new Error("nothing to do: no reveals, no seal");

  // Compute budget first, as the runtime expects, and with the measured value plus head room.
  const withBudget = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: Math.ceil(computeUnits * 1.2) }),
    ...(plan.priorityMicroLamports
      ? [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: plan.priorityMicroLamports })]
      : []),
    ...instructions,
  ];

  const size = sizeOf(withBudget, plan.wallet, blockhash);
  if (size > TX_SIZE_LIMIT) {
    throw new TooLarge(
      `daily transaction is ${size} bytes, limit is ${TX_SIZE_LIMIT}`,
      size,
      plan.reveals.length,
      (plan.memos ?? []).length,
    );
  }
  return { instructions: withBudget, computeUnits, size };
}

export class TooLarge extends Error {
  size: number;
  reveals: number;
  memos: number;
  constructor(message: string, size: number, reveals: number, memos: number) {
    super(message);
    this.name = "TooLarge";
    this.size = size;
    this.reveals = reveals;
    this.memos = memos;
  }
}

/** Serialised size of the signed transaction: one signature plus the message. */
export function sizeOf(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  blockhash: Blockhash = "11111111111111111111111111111111",
): number {
  const message = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions }).compileToLegacyMessage();
  const tx = new VersionedTransaction(message);
  // one signature, not yet signed: VersionedTransaction reserves the slots itself
  return tx.serialize().length;
}
