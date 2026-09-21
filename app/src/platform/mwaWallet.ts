// The real wallet: Mobile Wallet Adapter, as used in the Spike 3 client.
//
// Everything above this file works against the `Wallet` interface, so the whole core is testable
// without a phone. This is the only place that knows MWA exists.
import { transact, type Web3MobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
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

export class MwaWallet implements Wallet {
  private cluster: Cluster;
  private getBlockhash: () => Promise<Blockhash>;
  private sendRaw: (tx: Uint8Array) => Promise<string>;
  private authToken?: string;
  private cachedPubkey?: PublicKey;
  private label?: string;

  constructor(args: {
    cluster: Cluster;
    getBlockhash: () => Promise<Blockhash>;
    sendRaw: (tx: Uint8Array) => Promise<string>;
  }) {
    this.cluster = args.cluster;
    this.getBlockhash = args.getBlockhash;
    this.sendRaw = args.sendRaw;
  }

  async connect(): Promise<WalletSession> {
    return transact(async (wallet: Web3MobileWallet) => {
      const result = this.authToken
        ? await wallet.reauthorize({ auth_token: this.authToken, identity: IDENTITY })
        : await wallet.authorize({ chain: this.cluster, identity: IDENTITY });
      this.authToken = result.auth_token;
      const account = result.accounts[0];
      this.cachedPubkey = toKey(account.address);
      this.label = account.label ?? result.wallet_uri_base ?? undefined;
      return { pubkey: this.cachedPubkey, label: this.label, authToken: this.authToken };
    }).catch((e) => {
      throw translate(e);
    });
  }

  /** Signs the transaction and sends it through our own RPC — not through the wallet, so a
   *  failure to land is our problem to retry and not a silent wallet error. */
  async signAndSend(instructions: TransactionInstruction[], payer: PublicKey): Promise<string> {
    const blockhash = await this.getBlockhash();
    const message = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToLegacyMessage();
    const unsigned = new VersionedTransaction(message);

    const signed = await transact(async (wallet: Web3MobileWallet) => {
      await this.reauthorize(wallet);
      const [tx] = await wallet.signTransactions({ transactions: [unsigned] });
      return tx;
    }).catch((e) => {
      throw translate(e);
    });
    return this.sendRaw(signed.serialize());
  }

  /** Whether Seed Vault can do this at all is what the diagnostics screen measures. */
  signMessage = async (message: string): Promise<Uint8Array> => {
    const payload = new TextEncoder().encode(message);
    return transact(async (wallet: Web3MobileWallet) => {
      const account = await this.reauthorize(wallet);
      const [signed] = await wallet.signMessages({
        addresses: [account],
        payloads: [payload],
      });
      // MWA returns the payload with the signature appended.
      return signed.slice(payload.length);
    }).catch((e) => {
      throw translate(e);
    });
  };

  async disconnect(): Promise<void> {
    const token = this.authToken;
    this.authToken = undefined;
    this.cachedPubkey = undefined;
    if (!token) return;
    await transact(async (wallet: Web3MobileWallet) => {
      await wallet.deauthorize({ auth_token: token });
    }).catch(() => {
      // a wallet that will not let go of a token we already forgot is not a problem
    });
  }

  private async reauthorize(wallet: Web3MobileWallet): Promise<string> {
    const result = this.authToken
      ? await wallet.reauthorize({ auth_token: this.authToken, identity: IDENTITY })
      : await wallet.authorize({ chain: this.cluster, identity: IDENTITY });
    this.authToken = result.auth_token;
    const account = result.accounts[0];
    this.cachedPubkey = toKey(account.address);
    return account.address;
  }
}

/** A stale auth token must reach the core as SessionExpired, everything else as itself. */
function translate(e: unknown): Error {
  const message = e instanceof Error ? e.message : String(e);
  if (/auth_token|authorization|reauthorize|not authorized/i.test(message)) {
    return new SessionExpired(message);
  }
  return e instanceof Error ? e : new Error(message);
}
