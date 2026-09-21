// The season secret: one per wallet, the source of every salt.
//
// Why it is derived from a signature and not from randomness: expo-secure-store is wiped when
// the app is uninstalled. A random secret would be gone with it, and every open answer would
// become unrevealable — a full miss for something the player did right. A signature over a
// domain-specific message can be produced again by the same wallet, on the same phone or a new
// one, and yields the same secret.
//
// The fallback (random) exists only for the case that the wallet cannot sign messages at all.
// It is recorded as such, because with it a reinstall really does lose open answers, and the
// app has to say so instead of pretending.
import { sha256 } from "@noble/hashes/sha256";
import type { PublicKey } from "@solana/web3.js";
import { SECRET_MESSAGE_PREFIX } from "../chain/ids.ts";
import { bytesToHex, hexToBytes } from "../chain/calendar.ts";
import { type Store, getJson, setJson } from "./store.ts";

export type SecretOrigin = "signature" | "random";
export type StoredSecret = { secretHex: string; origin: SecretOrigin; wallet: string; createdAt: number };

const KEY = "secret";

/** The message the wallet signs. Domain-specific on purpose: a signature over this string must
 *  be useless anywhere else, and a signature made elsewhere must be useless here. */
export const secretMessage = (wallet: PublicKey) => `${SECRET_MESSAGE_PREFIX}${wallet.toBase58()}`;

/** secret = sha256(signature over the message). The signature itself never leaves the moment. */
export const secretFromSignature = (signature: Uint8Array) => sha256(signature);

export type SecretDeps = {
  store: Store;
  now: () => number;
  /** 32 random bytes — expo-crypto on the phone. Only used for the fallback. */
  randomBytes: (n: number) => Uint8Array;
  /** The wallet's message signature, or null if this wallet cannot sign messages. */
  signMessage: ((message: string) => Promise<Uint8Array>) | null;
};

export class SeasonSecret {
  private deps: SecretDeps;
  constructor(deps: SecretDeps) {
    this.deps = deps;
  }

  async stored(): Promise<StoredSecret | null> {
    return getJson<StoredSecret>(this.deps.store, KEY);
  }

  /**
   * The secret for this wallet. Derives it on first use — preferably from a signature, which is
   * the only version a reinstalled app can get back.
   */
  async get(wallet: PublicKey): Promise<{ secret: Uint8Array; origin: SecretOrigin; fresh: boolean }> {
    const existing = await this.stored();
    if (existing && existing.wallet === wallet.toBase58()) {
      return { secret: hexToBytes(existing.secretHex), origin: existing.origin, fresh: false };
    }
    // A different wallet means a different record; the old secret stays where it is.
    const derived = await this.derive(wallet);
    await setJson(this.deps.store, KEY, {
      secretHex: bytesToHex(derived.secret),
      origin: derived.origin,
      wallet: wallet.toBase58(),
      createdAt: this.deps.now(),
    } satisfies StoredSecret);
    return { ...derived, fresh: true };
  }

  /**
   * After a reinstall: sign the message again and get the same secret back. Returns null if the
   * wallet cannot sign messages — then nothing can be recovered and the app must say so.
   */
  async recover(wallet: PublicKey): Promise<Uint8Array | null> {
    if (!this.deps.signMessage) return null;
    const signature = await this.deps.signMessage(secretMessage(wallet));
    const secret = secretFromSignature(signature);
    await setJson(this.deps.store, KEY, {
      secretHex: bytesToHex(secret),
      origin: "signature",
      wallet: wallet.toBase58(),
      createdAt: this.deps.now(),
    } satisfies StoredSecret);
    return secret;
  }

  private async derive(wallet: PublicKey): Promise<{ secret: Uint8Array; origin: SecretOrigin }> {
    if (this.deps.signMessage) {
      try {
        const signature = await this.deps.signMessage(secretMessage(wallet));
        return { secret: secretFromSignature(signature), origin: "signature" };
      } catch {
        // fall through: a wallet that refuses once must not block sealing today
      }
    }
    return { secret: this.deps.randomBytes(32), origin: "random" };
  }
}

/** What the app may promise the player, given where the secret came from. */
export function canSurviveReinstall(origin: SecretOrigin): boolean {
  return origin === "signature";
}
