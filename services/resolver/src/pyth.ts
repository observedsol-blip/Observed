// Fetching the one valid Pyth update for a timestamp and posting it fully verified.
// The API key never leaves this module and is never logged.
import { Connection, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";

const HERMES = "https://hermes.pyth.network";

export class PythUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythUnavailable";
  }
}

/** The first update with publish_time >= t, as signed update data. */
export async function updateForTimestamp(apiKey: string, feedIdHex: string, t: number): Promise<string[]> {
  const res = await fetch(`${HERMES}/v2/updates/price/${t}?ids[]=${feedIdHex}&encoding=base64&parsed=true`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    // status only — the body can echo the key back in an error envelope
    throw new PythUnavailable(`Hermes returned HTTP ${res.status} for feed ${feedIdHex.slice(0, 8)}… at ${t}`);
  }
  const body = (await res.json()) as { binary: { data: string[] }; parsed: unknown[] };
  if (!body.binary?.data?.length) throw new PythUnavailable(`Hermes returned no update for ${t}`);
  return body.binary.data;
}

/**
 * Posts the update with VerificationLevel::Full and runs `consume` against the resulting price
 * update account in the same transaction group; the accounts are closed again afterwards, so no
 * rent stays locked (Spike 1: 2 transactions, ~21 400 lamports, 0 rent).
 */
export async function postAndConsume(
  connection: Connection,
  payer: Keypair,
  apiKey: string,
  feedIdHex: string,
  t: number,
  consume: (priceUpdate: PublicKey) => TransactionInstruction,
  computeUnitPriceMicroLamports: number,
): Promise<string[]> {
  const updateData = await updateForTimestamp(apiKey, feedIdHex, t);
  const wallet = {
    publicKey: payer.publicKey,
    payer,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
  const receiver = new PythSolanaReceiver({ connection, wallet: wallet as never });
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: true });
  await builder.addPostPriceUpdates(updateData);
  await builder.addPriceConsumerInstructions(async (get) => [
    { instruction: consume(get(`0x${feedIdHex}`)), signers: [] },
  ]);
  const built = await builder.buildVersionedTransactions({ computeUnitPriceMicroLamports });

  const signatures: string[] = [];
  for (const { tx, signers } of built) {
    tx.sign([payer, ...signers]);
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      { signature, blockhash: tx.message.recentBlockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed",
    );
    signatures.push(signature);
  }
  return signatures;
}
