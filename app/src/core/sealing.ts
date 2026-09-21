// Sealing and revealing, without any UI and without any wallet — both come in as adapters.
//
// The two rules this file exists to enforce:
//   1. The record is written BEFORE the wallet is asked. Every single time.
//   2. On "unknown" the chain is asked, never the player. Re-sealing blind would overwrite an
//      answer that may already be on chain, and the first one is the one that counts.
import { PublicKey } from "@solana/web3.js";
import { commitmentHash, saltFor } from "../chain/commitment.ts";
import { roundPda } from "../chain/pda.ts";
import { bytesToHex, hexToBytes } from "../chain/calendar.ts";
import type { CalendarRound } from "../chain/calendar.ts";
import type { Entry } from "../chain/layout.ts";
import { type SealRecord, type SealStatus, sealKey } from "./records.ts";
import { type Store, getJson, setJson } from "./store.ts";

/** What the machine needs from the outside world. All of it is faked in the tests. */
export type SealingDeps = {
  store: Store;
  /** Unix seconds. */
  now: () => number;
  /** The device identity: which SGT and which wallet the answer belongs to. */
  sgtMint: PublicKey;
  wallet: PublicKey;
  /** The season secret, 32 bytes. Salt per call is derived from it. */
  secret: Uint8Array;
  /** Reads the Entry for a call, or null. This is the truth; local state is only a memory. */
  readEntry: (roundId: number) => Promise<Entry | null>;
  /** Signs and sends. Resolves with a signature, throws if the player declined. */
  send: (record: SealRecord, round: CalendarRound) => Promise<string>;
  /** Waits for confirmation. `false` means "no answer yet", not "failed". */
  confirm: (signature: string) => Promise<boolean>;
};

export class Sealing {
  // No parameter property: node strips types only, it does not transform them.
  private deps: SealingDeps;
  constructor(deps: SealingDeps) {
    this.deps = deps;
  }

  private key = (roundId: number) => sealKey(roundId);

  async read(roundId: number): Promise<SealRecord | null> {
    return getJson<SealRecord>(this.deps.store, this.key(roundId));
  }

  async all(): Promise<SealRecord[]> {
    const keys = await this.deps.store.keys();
    const out: SealRecord[] = [];
    for (const k of keys.filter((x) => x.startsWith("seal:"))) {
      const r = await getJson<SealRecord>(this.deps.store, k);
      if (r) out.push(r);
    }
    return out.sort((a, b) => a.roundId - b.roundId);
  }

  private async write(record: SealRecord): Promise<SealRecord> {
    await setJson(this.deps.store, this.key(record.roundId), record);
    return record;
  }

  private async patch(roundId: number, change: Partial<SealRecord>): Promise<SealRecord> {
    const current = await this.read(roundId);
    if (!current) throw new Error(`no record for call ${roundId}`);
    return this.write({ ...current, ...change });
  }

  /**
   * Step one: write the answer down. No wallet, no network. After this returns, the answer
   * survives a crash — that is the whole point of doing it first.
   */
  async saveAnswer(args: {
    round: CalendarRound;
    pBps: number;
    sentence?: string;
    share?: boolean;
  }): Promise<SealRecord> {
    const { round, pBps } = args;
    const existing = await this.read(round.roundId);
    if (existing && existing.status === "confirmed") {
      throw new Error(`call ${round.roundId} is already sealed`);
    }
    const salt = saltFor(this.deps.secret, round.roundId);
    const commitment = commitmentHash({
      round: roundPda(round.roundId),
      termsHash: hexToBytes(round.termsHash),
      sgtMint: this.deps.sgtMint,
      beneficiary: this.deps.wallet,
      pBps,
      salt,
    });
    return this.write({
      roundId: round.roundId,
      pBps,
      salt: bytesToHex(salt),
      commitment: bytesToHex(commitment),
      sentence: args.sentence,
      share: args.share ?? false,
      status: "saved",
      savedAt: this.deps.now(),
    });
  }

  /**
   * Step two: ask the wallet, send, confirm. Every outcome is written down before it is
   * returned, so a crash anywhere in here leaves a record the next start can reason about.
   */
  async seal(round: CalendarRound): Promise<SealRecord> {
    const record = await this.read(round.roundId);
    if (!record) throw new Error(`nothing saved for call ${round.roundId}`);
    if (record.status === "confirmed") return record;
    if (record.status === "unknown") {
      // Never send again without asking the chain first.
      const reconciled = await this.reconcile(round);
      if (reconciled.status !== "failed") return reconciled;
    }

    let signature: string;
    try {
      signature = await this.deps.send(record, round);
    } catch (e) {
      // Declined, or the wallet never came back. Nothing was sent: the answer stays saved and
      // the player can try again while the window is open.
      return this.patch(round.roundId, {
        status: "saved",
        note: e instanceof Error ? e.message.slice(0, 120) : String(e),
      });
    }
    // A signature exists, so something may be on chain from here on.
    await this.patch(round.roundId, { status: "sent", signature, sentAt: this.deps.now() });

    let confirmed = false;
    try {
      confirmed = await this.deps.confirm(signature);
    } catch {
      confirmed = false;
    }
    if (confirmed) return this.patch(round.roundId, { status: "confirmed" });
    return this.patch(round.roundId, { status: "unknown" });
  }

  /**
   * Cold start and every "unknown": derive the truth from the chain, not from what the phone
   * thinks happened.
   */
  async reconcile(round: CalendarRound): Promise<SealRecord> {
    const record = await this.read(round.roundId);
    if (!record) throw new Error(`nothing saved for call ${round.roundId}`);
    const entry = await this.deps.readEntry(round.roundId);
    const now = this.deps.now();
    const windowOpen = now >= round.commitOpen && now < round.commitClose;

    if (entry) {
      const onChain = bytesToHex(entry.commitment);
      if (onChain === record.commitment) {
        return this.patch(round.roundId, { status: "confirmed", note: undefined });
      }
      // An Entry exists that we cannot open: the answer in it was sealed with a different salt
      // or a different number. It can never be revealed by this phone — say so, do not retry.
      return this.patch(round.roundId, {
        status: "missed",
        note: "an entry exists on chain that this phone cannot reveal",
      });
    }
    if (windowOpen) {
      return this.patch(round.roundId, { status: "failed", note: "nothing on chain yet" });
    }
    return this.patch(round.roundId, { status: "missed", note: "the window closed without a seal" });
  }

  /** Every call whose record still needs attention, for the cold start. */
  async unfinished(): Promise<SealRecord[]> {
    return (await this.all()).filter((r) => r.status !== "confirmed" && r.status !== "missed");
  }
}

export type { SealStatus };
