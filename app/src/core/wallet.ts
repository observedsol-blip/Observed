// The wallet, as the core sees it: four methods and nothing about MWA.
//
// The real implementation (app/src/platform/mwaWallet.ts) talks to the Mobile Wallet Adapter;
// the tests use a fake. Everything above this interface can therefore be tested without a phone,
// which is the only reason the state machine has tests at all today.
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";

export type WalletSession = {
  pubkey: PublicKey;
  /** What the wallet calls itself, for the diagnosis screen. */
  label?: string;
  /** MWA re-uses this token so the second approval of the day is one tap, not two. */
  authToken?: string;
};

export interface Wallet {
  /** Opens the wallet, returns the session. Throws if the player declines. */
  connect(): Promise<WalletSession>;
  /** Signs and sends one transaction. Returns the signature. */
  signAndSend(instructions: TransactionInstruction[], payer: PublicKey): Promise<string>;
  /** Signs a message. Null if this wallet cannot — Seed Vault may not (open until Spike 3). */
  signMessage: ((message: string) => Promise<Uint8Array>) | null;
  /** Forgets the session. Called when the auth token is rejected. */
  disconnect(): Promise<void>;
}

/** Thrown when the wallet says the token is gone: reconnect once, then give up for this attempt. */
export class SessionExpired extends Error {
  constructor(message = "wallet session expired") {
    super(message);
    this.name = "SessionExpired";
  }
}

/**
 * Runs `what` and, if the wallet says the session is gone, reconnects once and runs it again.
 * A stale auth token is the most common wallet error and must never reach the player as an
 * error message.
 */
export async function withSession<T>(
  wallet: Wallet,
  what: (session: WalletSession) => Promise<T>,
  cached?: WalletSession,
): Promise<{ result: T; session: WalletSession }> {
  let session = cached ?? (await wallet.connect());
  try {
    return { result: await what(session), session };
  } catch (e) {
    if (!(e instanceof SessionExpired)) throw e;
    await wallet.disconnect();
    session = await wallet.connect();
    return { result: await what(session), session };
  }
}
