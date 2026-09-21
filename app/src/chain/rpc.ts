// Reading the chain, for the app.
//
// One place, one Connection, and every read returns a decoded value or null — a missing account
// is a normal state here (no entry yet, no round today), not an error. Errors are network
// errors, and those the caller has to be able to see.
import { Connection, PublicKey, type Blockhash } from "@solana/web3.js";
import { TOKEN_2022_ID } from "./ids.ts";
import {
  type Config,
  type Entry,
  type Player,
  type Round,
  decodeConfig,
  decodeEntry,
  decodePlayer,
  decodeRound,
} from "./layout.ts";
import { configPda, entryPda, playerPda, roundPda } from "./pda.ts";

export class Chain {
  readonly connection: Connection;
  constructor(endpoint: string | Connection) {
    this.connection = typeof endpoint === "string" ? new Connection(endpoint, "confirmed") : endpoint;
  }

  private async data(key: PublicKey): Promise<Uint8Array | null> {
    const info = await this.connection.getAccountInfo(key, "confirmed");
    return info ? Uint8Array.from(info.data) : null;
  }

  async config(): Promise<Config | null> {
    const data = await this.data(configPda());
    return data ? decodeConfig(data) : null;
  }

  async round(roundId: number): Promise<Round | null> {
    const key = roundPda(roundId);
    const data = await this.data(key);
    return data ? decodeRound(key, data) : null;
  }

  /** Several rounds in one call — the evening needs up to four. */
  async rounds(roundIds: number[]): Promise<Map<number, Round>> {
    const keys = roundIds.map((id) => roundPda(id));
    const infos = await this.connection.getMultipleAccountsInfo(keys, "confirmed");
    const out = new Map<number, Round>();
    infos.forEach((info, i) => {
      if (info) out.set(roundIds[i], decodeRound(keys[i], Uint8Array.from(info.data)));
    });
    return out;
  }

  async entry(roundId: number, sgtMint: PublicKey): Promise<Entry | null> {
    const key = entryPda(roundPda(roundId), sgtMint);
    const data = await this.data(key);
    return data ? decodeEntry(key, data) : null;
  }

  async entries(roundIds: number[], sgtMint: PublicKey): Promise<Map<number, Entry>> {
    const keys = roundIds.map((id) => entryPda(roundPda(id), sgtMint));
    const infos = await this.connection.getMultipleAccountsInfo(keys, "confirmed");
    const out = new Map<number, Entry>();
    infos.forEach((info, i) => {
      if (info) out.set(roundIds[i], decodeEntry(keys[i], Uint8Array.from(info.data)));
    });
    return out;
  }

  async player(sgtMint: PublicKey): Promise<Player | null> {
    const data = await this.data(playerPda(sgtMint));
    return data ? decodePlayer(data) : null;
  }

  async balance(owner: PublicKey): Promise<number> {
    return this.connection.getBalance(owner, "confirmed");
  }

  async blockhash(): Promise<Blockhash> {
    return (await this.connection.getLatestBlockhash("finalized")).blockhash;
  }

  async sendRaw(raw: Uint8Array): Promise<string> {
    return this.connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
  }

  /** Confirms without waiting for the blockhash to expire: poll, then give up and say so. */
  async confirm(signature: string, timeoutMs = 30_000): Promise<boolean> {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const status = await this.connection.getSignatureStatus(signature);
      const value = status.value;
      if (value?.err) throw new Error(`the transaction failed on chain: ${JSON.stringify(value.err)}`);
      if (value?.confirmationStatus === "confirmed" || value?.confirmationStatus === "finalized") {
        return true;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    return false;
  }

  /** The Token-2022 accounts of a wallet — the search for the Genesis Token starts here. */
  async tokenAccountsOf(owner: PublicKey): Promise<{ pubkey: PublicKey; data: Uint8Array }[]> {
    const result = await this.connection.getTokenAccountsByOwner(owner, { programId: TOKEN_2022_ID });
    return result.value.map((a) => ({ pubkey: a.pubkey, data: Uint8Array.from(a.account.data) }));
  }

  accountData = (key: PublicKey) => this.data(key);
}
