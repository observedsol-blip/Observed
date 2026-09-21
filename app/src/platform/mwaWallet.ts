// The real wallet: Mobile Wallet Adapter, as used in the Spike 3 client.
//
// Everything above this file works against the `Wallet` interface, so the whole core is testable
// without a phone. This is the only place that knows MWA exists.
//
// Three things measured on the Seeker on 21.09.2026 shaped this file:
//   * A VersionedTransaction and an invalid blockhash both make the wallet close the session
//     without showing anything ("Local association cancelled by user" after ~3 s). So: legacy
//     transaction, real blockhash.
//   * `signMessages` is not supported at all — five attempts, same failure. It is gone from here.
//   * Every `transact()` is its own association and its own trip to the wallet. Connecting first
//     and signing afterwards therefore costs two trips; signing alone costs one.
import { transact, type Web3MobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  PublicKey,
  Transaction,
  type Blockhash,
  type TransactionInstruction,
} from "@solana/web3.js";
import { SessionExpired, type Wallet, type WalletSession } from "../core/wallet.ts";

export type Cluster = "solana:mainnet" | "solana:devnet" | "solana:testnet";

const IDENTITY = {
  name: "Observed",
  uri: "https://observed.day",
  icon: "favicon.ico",
};

/** MWA hands back base64; web3.js wants bytes. */
const toKey = (address: string) => new PublicKey(Buffer.from(address, "base64"));

/** Where the auth token survives a cold start. Without it, every morning costs a full
 *  authorization — the difference between one approval a day and two. */
export type TokenStore = {
  load: () => Promise<string | null>;
  save: (token: string | null) => Promise<void>;
  /** The address belonging to the token. Without it the app has to open the wallet after every
   *  cold start just to learn who it is signing for — which costs the very approval the whole
   *  design is trying to save. */
  loadAddress?: () => Promise<string | null>;
  saveAddress?: (address: string | null) => Promise<void>;
};

export class MwaWallet implements Wallet {
  private cluster: Cluster;
  private getBlockhash: () => Promise<Blockhash>;
  private sendRaw: (tx: Uint8Array) => Promise<string>;
  private tokens?: TokenStore;
  private authToken?: string;
  private loaded = false;
  private cachedPubkey?: PublicKey;
  private label?: string;

  constructor(args: {
    cluster: Cluster;
    getBlockhash: () => Promise<Blockhash>;
    sendRaw: (tx: Uint8Array) => Promise<string>;
    /** Optional only so tests can leave it out. The app always passes one. */
    tokens?: TokenStore;
  }) {
    this.cluster = args.cluster;
    this.getBlockhash = args.getBlockhash;
    this.sendRaw = args.sendRaw;
    this.tokens = args.tokens;
  }

  /** The token from the last run, read once per process. */
  private async token(): Promise<string | undefined> {
    if (!this.loaded) {
      this.loaded = true;
      this.authToken = (await this.tokens?.load()) ?? undefined;
    }
    return this.authToken;
  }

  async connect(): Promise<WalletSession> {
    return transact(async (wallet: Web3MobileWallet) => this.authorize(wallet)).catch((e) => {
      throw translate(e);
    });
  }

  /** Signs and sends. ONE association: the wallet is opened exactly once, whether or not
   *  anybody connected before. */
  async signAndSend(instructions: TransactionInstruction[], payer: PublicKey): Promise<string> {
    const blockhash = await this.getBlockhash();
    const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash }).add(...instructions);

    const signed = await transact(async (wallet: Web3MobileWallet) => {
      await this.authorize(wallet);
      const [result] = await wallet.signTransactions({ transactions: [tx] });
      return result;
    }).catch((e) => {
      throw translate(e);
    });
    return this.sendRaw(signed.serialize());
  }

  async disconnect(): Promise<void> {
    const token = await this.token();
    this.authToken = undefined;
    this.cachedPubkey = undefined;
    this.loaded = true;
    await this.tokens?.save(null);
    await this.tokens?.saveAddress?.(null);
    if (!token) return;
    await transact(async (wallet: Web3MobileWallet) => {
      await wallet.deauthorize({ auth_token: token });
    }).catch(() => {
      // a wallet that will not let go of a token we already forgot is not a problem
    });
  }

  /** What the app knows without opening the wallet: is there a stored session at all? */
  async hasStoredSession(): Promise<boolean> {
    return (await this.token()) !== undefined;
  }

  /** The address from the last session, without touching the wallet. */
  async storedAddress(): Promise<PublicKey | null> {
    if (this.cachedPubkey) return this.cachedPubkey;
    const stored = await this.tokens?.loadAddress?.();
    if (!stored) return null;
    this.cachedPubkey = new PublicKey(stored);
    return this.cachedPubkey;
  }

  /**
   * Authorizes inside an open association: re-uses the stored token when there is one, and falls
   * back to a fresh authorization when the wallet rejects it. Without that fallback, a token the
   * wallet forgot would break every seal until the app is reinstalled.
   */
  private async authorize(wallet: Web3MobileWallet): Promise<WalletSession> {
    const stored = await this.token();
    let result;
    if (stored) {
      try {
        result = await wallet.reauthorize({ auth_token: stored, identity: IDENTITY });
      } catch (e) {
        // ONLY a token the wallet no longer knows earns a second attempt. If the player just
        // declined, a fresh authorization would put a second sheet in their face — which is the
        // opposite of what declining means.
        if (!looksLikeStaleToken(e)) throw e;
        this.authToken = undefined;
        await this.tokens?.save(null);
        result = await wallet.authorize({ chain: this.cluster, identity: IDENTITY });
      }
    } else {
      result = await wallet.authorize({ chain: this.cluster, identity: IDENTITY });
    }
    this.authToken = result.auth_token;
    await this.tokens?.save(result.auth_token);
    const account = result.accounts[0];
    this.cachedPubkey = toKey(account.address);
    await this.tokens?.saveAddress?.(this.cachedPubkey.toBase58());
    this.label = account.label ?? this.label;
    return { pubkey: this.cachedPubkey, label: this.label, authToken: result.auth_token };
  }
}

/** The wallet forgot the token — as opposed to the player saying no. */
function looksLikeStaleToken(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (/cancel|declin|reject|denied/i.test(message)) return false;
  return /auth_token|authorization|reauthorize|not authorized|invalid/i.test(message);
}

/** A stale auth token must reach the core as SessionExpired, everything else as itself. */
function translate(e: unknown): Error {
  const message = e instanceof Error ? e.message : String(e);
  if (/auth_token|authorization|reauthorize|not authorized/i.test(message)) {
    return new SessionExpired(message);
  }
  return e instanceof Error ? e : new Error(message);
}
