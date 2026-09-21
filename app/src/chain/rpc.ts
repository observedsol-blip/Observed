// Reading the chain, for the app.
//
// One place, one Connection, and every read returns a decoded value or null — a missing account
// is a normal state here (no entry yet, no round today), not an error. Errors are network
// errors, and those the caller has to be able to see.
import { Connection, PublicKey, type Blockhash } from "@solana/web3.js";
import bs58 from "bs58";
import { BPF_LOADER_UPGRADEABLE_ID, IX, MEMO_ID, PROGRAM_ID, TOKEN_2022_ID } from "./ids.ts";
import type { MemoTransaction } from "../core/others.ts";
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

  /**
   * Who may replace the program, read from its own ProgramData account.
   *
   * Settings names this address, and naming it is the point: whoever holds it can change the
   * rules. Layout of a ProgramData account: enum(4) · slot(8) · Option tag(1) · pubkey(32).
   * A tag of 0 means the program is immutable — then there is no address, and `null` says so.
   */
  async upgradeAuthority(): Promise<PublicKey | null> {
    const [programData] = PublicKey.findProgramAddressSync(
      [PROGRAM_ID.toBuffer()],
      BPF_LOADER_UPGRADEABLE_ID,
    );
    const data = await this.data(programData);
    if (!data || data.length < 45) return null;
    if (data[12] !== 1) return null; // no authority: the program cannot be changed any more
    return new PublicKey(data.subarray(13, 45));
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

  /**
   * Every transaction that touched a round account, reduced to what "What others wrote" needs:
   * who paid, which memos were in it, and — for a reveal — the salt and the probability out of
   * the instruction data.
   *
   * This is the only place in the app that walks history. It is bounded (`limit`) because a
   * popular call could have hundreds of entries and the screen shows a handful.
   */
  async memoTransactionsOf(round: PublicKey, limit = 200): Promise<MemoTransaction[]> {
    const signatures = await this.connection.getSignaturesForAddress(round, { limit }, "confirmed");
    if (signatures.length === 0) return [];
    const parsed = await this.connection.getParsedTransactions(
      signatures.map((s) => s.signature),
      { maxSupportedTransactionVersion: 0, commitment: "confirmed" },
    );

    const out: MemoTransaction[] = [];
    parsed.forEach((tx, i) => {
      if (!tx || tx.meta?.err) return; // a failed transaction proves nothing
      const message = tx.transaction.message;
      const payer = message.accountKeys[0]?.pubkey.toBase58();
      if (!payer) return;

      const memos: string[] = [];
      let committed = false;
      let revealed = false;
      let saltHex: string | undefined;
      let pBps: number | undefined;

      for (const ix of message.instructions) {
        const programId = ix.programId.toBase58();
        if (programId === MEMO_ID.toBase58()) {
          // the parsed form carries the memo as a string; the raw form as base58 data
          const parsedMemo = (ix as { parsed?: unknown }).parsed;
          if (typeof parsedMemo === "string") memos.push(parsedMemo);
          else if ("data" in ix && typeof ix.data === "string") {
            memos.push(new TextDecoder().decode(bs58.decode(ix.data)));
          }
          continue;
        }
        if (programId !== PROGRAM_ID.toBase58()) continue;
        if (!("data" in ix) || typeof ix.data !== "string") continue;
        const data = bs58.decode(ix.data);
        if (data.length < 8) continue;

        // A commit — but only one that names THIS round. A transaction may carry more than one
        // instruction, and a seal memo is worth something only next to the commit it belongs to.
        if (sameBytes(data.subarray(0, 8), IX.commit)) {
          const accounts = (ix as { accounts?: PublicKey[] }).accounts ?? [];
          if (accounts.some((a) => a.equals(round))) committed = true;
          continue;
        }

        if (!sameBytes(data.subarray(0, 8), IX.reveal)) continue;
        // reveal: disc(8) + p_bps(2) + salt(32). A truncated one is not ours: ignore it rather
        // than read past the end of the buffer.
        if (data.length < 42) continue;
        revealed = true;
        pBps = new DataView(data.buffer, data.byteOffset + 8, 2).getUint16(0, true);
        saltHex = [...data.subarray(10, 42)].map((b) => b.toString(16).padStart(2, "0")).join("");
      }

      out.push({
        signature: signatures[i].signature,
        blockTime: tx.blockTime ?? null,
        payer,
        memos,
        committed,
        revealed,
        saltHex,
        pBps,
      });
    });
    // oldest first: a seal memo has to be found before the reveal that verifies against it
    return out.sort((a, b) => (a.blockTime ?? 0) - (b.blockTime ?? 0));
  }
}

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);
