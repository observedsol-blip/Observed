// The season secret: one per wallet, the source of every salt.
//
// It is random and it lives on this phone. Not derived from a wallet signature — Seed Vault
// Wallet cannot sign messages (Seeker, 21.09.2026, five attempts), and the workaround would have
// been to make players sign a transaction that is never sent. That is the pattern wallets warn
// about, and an app must not teach it (owner decision, 21.09.2026).
//
// The consequence is stated honestly instead of hidden: uninstalling the app forfeits answers
// that are still open — at most three days' worth, since the reveal window is 72 h. Against that
// there is an export: the player can copy the secret out and paste it back in after a reinstall,
// and `recoverAnswer` then rebuilds the sealed answers from the chain.
import type { PublicKey } from "@solana/web3.js";
import { bytesToHex, hexToBytes } from "../chain/calendar.ts";
import { type Store, getJson, setJson } from "./store.ts";

export type StoredSecret = { secretHex: string; wallet: string; createdAt: number };

const KEY = "secret";

export type SecretDeps = {
  store: Store;
  now: () => number;
  /** 32 random bytes — expo-crypto on the phone. */
  randomBytes: (n: number) => Uint8Array;
};

export class SeasonSecret {
  private deps: SecretDeps;
  constructor(deps: SecretDeps) {
    this.deps = deps;
  }

  async stored(): Promise<StoredSecret | null> {
    return getJson<StoredSecret>(this.deps.store, KEY);
  }

  /** The secret for this wallet, created on first use. */
  async get(wallet: PublicKey): Promise<{ secret: Uint8Array; fresh: boolean }> {
    const existing = await this.stored();
    if (existing && existing.wallet === wallet.toBase58()) {
      return { secret: hexToBytes(existing.secretHex), fresh: false };
    }
    const secret = this.deps.randomBytes(32);
    if (secret.length !== 32) throw new Error(`need 32 random bytes, got ${secret.length}`);
    await this.write(secret, wallet);
    return { secret, fresh: true };
  }

  /**
   * What the player can write down or put in a password manager. 64 hex characters, no wallet
   * address, nothing that identifies anybody — and useless on its own: without the wallet that
   * sealed the answers, it opens nothing.
   */
  async exportSecret(): Promise<string | null> {
    const stored = await this.stored();
    return stored ? stored.secretHex : null;
  }

  /**
   * After a reinstall: paste the secret back. Rejects anything that is not exactly 32 bytes of
   * hex, so a half-copied string fails here and not silently three days later.
   */
  async importSecret(hex: string, wallet: PublicKey): Promise<Uint8Array> {
    const cleaned = hex.trim().toLowerCase().replace(/\s+/g, "");
    if (!/^[0-9a-f]{64}$/.test(cleaned)) {
      throw new Error("that is not a secret: 64 hex characters expected");
    }
    const secret = hexToBytes(cleaned);
    await this.write(secret, wallet);
    return secret;
  }

  private write(secret: Uint8Array, wallet: PublicKey) {
    return setJson(this.deps.store, KEY, {
      secretHex: bytesToHex(secret),
      wallet: wallet.toBase58(),
      createdAt: this.deps.now(),
    } satisfies StoredSecret);
  }
}
