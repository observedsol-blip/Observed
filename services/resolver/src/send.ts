// Sending transactions that survive congestion: dynamic priority fee, explicit compute budget,
// rebuild-and-resend on an expired blockhash, hard retry cap, then a clean failure.
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export class SendFailed extends Error {
  constructor(
    readonly reason: "retries-exhausted" | "rejected",
    message: string,
  ) {
    super(message);
    this.name = "SendFailed";
  }
}

const MIN_PRIORITY_MICROLAMPORTS = 1_000;
const MAX_PRIORITY_MICROLAMPORTS = 1_000_000;

/**
 * Median of the recent per-account priority fees, clamped. Falls back to the minimum when the
 * RPC has no data — a missing fee estimate must never stop a round from resolving.
 */
export async function priorityFee(connection: Connection, accounts: PublicKey[]): Promise<number> {
  try {
    const recent = await connection.getRecentPrioritizationFees({ lockedWritableAccounts: accounts.slice(0, 5) });
    const fees = recent.map((f) => f.prioritizationFee).filter((f) => f > 0).sort((a, b) => a - b);
    if (fees.length === 0) return MIN_PRIORITY_MICROLAMPORTS;
    const median = fees[Math.floor(fees.length / 2)];
    return Math.min(MAX_PRIORITY_MICROLAMPORTS, Math.max(MIN_PRIORITY_MICROLAMPORTS, Math.ceil(median * 1.5)));
  } catch {
    return MIN_PRIORITY_MICROLAMPORTS;
  }
}

export type SendOptions = {
  computeUnits: number;
  maxAttempts?: number;
  label: string;
};

/**
 * Builds the transaction fresh on every attempt, so an expired blockhash is simply a new build.
 * Returns the signature, or throws SendFailed after the cap.
 */
export async function sendWithRetry(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  { computeUnits, maxAttempts = 4, label }: SendOptions,
): Promise<string> {
  const writable = instructions.flatMap((i) => i.keys.filter((k) => k.isWritable).map((k) => k.pubkey));
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const microLamports = await priorityFee(connection, writable);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight }).add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
        ...instructions,
      );
      tx.sign(payer);
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 0, // we own the retry loop, so a stale blockhash is rebuilt rather than replayed
      });
      const result = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      if (result.value.err) throw new Error(`on-chain error: ${JSON.stringify(result.value.err)}`);
      return signature;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      // An instruction that the program rejects will not get better by retrying.
      if (/custom program error|AnchorError|already in use/i.test(lastError)) {
        throw new SendFailed("rejected", `${label}: ${lastError}`);
      }
      if (attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw new SendFailed("retries-exhausted", `${label}: ${maxAttempts} attempts failed, last error: ${lastError}`);
}
