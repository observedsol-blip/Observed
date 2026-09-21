// The one object the screens talk to.
//
// It holds what a day needs — wallet, secret, records, chain, calendar — and hands the screens
// finished views plus two actions: save the answer, and send the evening transaction. The
// screens decide nothing; everything here is derived from the chain or from a record that was
// written before an approval.
import type { PublicKey } from "@solana/web3.js";
import type { Chain } from "../chain/rpc.ts";
import { type CalendarRound, hexToBytes, roundIsInTheCalendar } from "../chain/calendar.ts";
import { buildDaily } from "../chain/ix.ts";
import { RoundStatus } from "../chain/ids.ts";
import { findGenesisToken } from "../chain/sgt.ts";
import type { Entry, Round } from "../chain/layout.ts";
import { sha256Of } from "./sentence.ts";
import { Sealing } from "./sealing.ts";
import { SeasonSecret } from "./secret.ts";
import { type ResultView, type TodayView, resultView, sideRecord, streakOf, todayView } from "./day.ts";
import { revealableNow } from "./revealing.ts";
import { type SealRecord, sealKey } from "./records.ts";
import { recoverAll } from "./recovery.ts";
import { type Store, setJson } from "./store.ts";
import type { Wallet } from "./wallet.ts";

export type SessionDeps = {
  chain: Chain;
  wallet: Wallet;
  store: Store;
  calendar: CalendarRound[];
  now: () => number;
  randomBytes: (n: number) => Uint8Array;
};

export type DayState = {
  today: TodayView;
  /** The most recent call that has an outcome and our revealed answer, for the Result screen. */
  result: ResultView | null;
  /** What the evening transaction would reveal right now. */
  openReveals: number;
  /** null while no wallet is connected. */
  wallet: PublicKey | null;
  sgtMint: PublicKey | null;
  /** The honest reason the day cannot be played, if there is one. */
  blocked: "no-wallet" | "no-sgt" | null;
};

export class Session {
  private deps: SessionDeps;
  private walletKey: PublicKey | null = null;
  private sgtMint: PublicKey | null = null;
  private sgtToken: PublicKey | null = null;
  private secretBytes: Uint8Array | null = null;
  private sealing: Sealing | null = null;
  private draft: { roundId: number; pBps: number } | null = null;

  constructor(deps: SessionDeps) {
    this.deps = deps;
  }

  /** Opens the wallet once, finds the Genesis Token, prepares the secret. */
  async connect(): Promise<{ ok: boolean; reason?: "no-sgt" }> {
    const session = await this.deps.wallet.connect();
    this.walletKey = session.pubkey;

    const sgt = await findGenesisToken(
      { tokenAccountsOf: (o) => this.deps.chain.tokenAccountsOf(o), accountData: (k) => this.deps.chain.accountData(k) },
      session.pubkey,
    );
    if (!sgt.ok) return { ok: false, reason: "no-sgt" };
    this.sgtMint = sgt.mint;
    this.sgtToken = sgt.tokenAccount;

    const secret = new SeasonSecret({
      store: this.deps.store,
      now: this.deps.now,
      randomBytes: this.deps.randomBytes,
    });
    this.secretBytes = (await secret.get(session.pubkey)).secret;
    this.sealing = this.makeSealing();
    return { ok: true };
  }

  private makeSealing(): Sealing {
    const wallet = this.walletKey!;
    const sgtMint = this.sgtMint!;
    return new Sealing({
      store: this.deps.store,
      now: this.deps.now,
      sgtMint,
      wallet,
      secret: this.secretBytes!,
      readEntry: (roundId) => this.deps.chain.entry(roundId, sgtMint),
      // The evening transaction is sent by `evening()`; a seal on its own goes out here.
      send: async (record, round) => {
        const built = await this.buildEvening({ sealRound: round, sealRecord: record });
        return this.deps.wallet.signAndSend(built.instructions, wallet);
      },
      confirm: (signature) => this.deps.chain.confirm(signature),
    });
  }

  /** What the two screens draw. One round trip to the chain. */
  async day(): Promise<DayState> {
    const now = this.deps.now();
    if (!this.walletKey) {
      return { today: this.emptyToday(now), result: null, openReveals: 0, wallet: null, sgtMint: null, blocked: "no-wallet" };
    }
    if (!this.sgtMint) {
      return { today: this.emptyToday(now), result: null, openReveals: 0, wallet: this.walletKey, sgtMint: null, blocked: "no-sgt" };
    }

    const openCalls = this.deps.calendar.filter(
      (r) => now >= r.commitOpen - 60 && now < r.outcomeTime + 72 * 3600,
    );
    const ids = openCalls.map((r) => r.roundId);
    const [rounds, entries, balance] = await Promise.all([
      this.deps.chain.rounds(ids),
      this.deps.chain.entries(ids, this.sgtMint),
      this.deps.chain.balance(this.walletKey),
    ]);
    const records = await this.sealing!.all();

    const revealables = revealableNow({
      now,
      calendar: this.deps.calendar,
      records,
      roundState: (id) => rounds.get(id) ?? null,
      entryState: (id) => entries.get(id) ?? null,
    });

    const sealable = this.deps.calendar.find((r) => now >= r.commitOpen && now < r.commitClose);
    const record = sealable ? (records.find((r) => r.roundId === sealable.roundId) ?? null) : null;

    return {
      today: todayView({
        now,
        calendar: this.deps.calendar,
        record,
        draftPBps: this.draft && sealable && this.draft.roundId === sealable.roundId ? this.draft.pBps : null,
        openReveals: revealables.length,
        hasGenesisToken: true,
        balanceLamports: balance,
      }),
      result: this.latestResult(rounds, entries, records),
      openReveals: revealables.length,
      wallet: this.walletKey,
      sgtMint: this.sgtMint,
      blocked: null,
    };
  }

  private latestResult(
    rounds: Map<number, Round>,
    entries: Map<number, Entry>,
    records: SealRecord[],
  ): ResultView | null {
    const revealed = [...entries.entries()]
      .filter(([, e]) => e.revealed)
      .sort((a, b) => b[0] - a[0]);
    const latest = revealed[0];
    if (!latest) return null;
    const [roundId, entry] = latest;
    const round = rounds.get(roundId);
    const calendar = this.deps.calendar.find((r) => r.roundId === roundId);
    if (!round || !calendar) return null;
    const revealedIds = new Set([...entries].filter(([, e]) => e.revealed).map(([id]) => id));
    return resultView({
      round,
      calendar,
      entry,
      record: records.find((r) => r.roundId === roundId) ?? null,
      // Only calls that actually reached an outcome can break or extend a streak.
      streak: streakOf(records, revealedIds, (id) => rounds.get(id)?.status === RoundStatus.Resolved),
    });
  }

  private emptyToday(now: number): TodayView {
    return todayView({
      now,
      calendar: this.deps.calendar,
      record: null,
      draftPBps: null,
      openReveals: 0,
      hasGenesisToken: this.sgtMint !== null,
      balanceLamports: Number.MAX_SAFE_INTEGER,
    });
  }

  /** The player moved the scale. Nothing leaves the phone. */
  setAnswer(roundId: number, pBps: number) {
    this.draft = { roundId, pBps };
  }

  /** Step one of sealing: write it down. No wallet, no network. */
  async saveAnswer(round: CalendarRound, pBps: number, sentence?: string, share?: boolean) {
    const config = await this.deps.chain.config();
    if (!config) throw new Error("this game does not exist on chain");
    if (!roundIsInTheCalendar(round, config.calendarRoot)) {
      throw new Error(`call ${round.roundId} is not in the calendar the chain published`);
    }
    this.setAnswer(round.roundId, pBps);
    return this.sealing!.saveAnswer({ round, pBps, sentence, share });
  }

  /** Step two: the one approval of the day. Reveals everything open and seals today. */
  async evening(): Promise<{ signature: string; revealed: number[]; sealed: number | null }> {
    const now = this.deps.now();
    const records = await this.sealing!.all();
    const ids = this.deps.calendar
      .filter((r) => now >= r.commitOpen - 60 && now < r.outcomeTime + 72 * 3600)
      .map((r) => r.roundId);
    const [rounds, entries] = await Promise.all([
      this.deps.chain.rounds(ids),
      this.deps.chain.entries(ids, this.sgtMint!),
    ]);
    const revealables = revealableNow({
      now,
      calendar: this.deps.calendar,
      records,
      roundState: (id) => rounds.get(id) ?? null,
      entryState: (id) => entries.get(id) ?? null,
    });
    const sealRound = this.deps.calendar.find((r) => now >= r.commitOpen && now < r.commitClose);
    const sealRecord = sealRound ? records.find((r) => r.roundId === sealRound.roundId) : undefined;
    const sealNow = sealRecord && sealRecord.status !== "confirmed" ? sealRecord : undefined;

    const built = await this.buildEvening({
      reveals: revealables.map((r) => ({
        roundId: r.round.roundId,
        pBps: r.record.pBps,
        salt: hexToBytes(r.record.salt),
      })),
      sealRound: sealNow ? sealRound : undefined,
      sealRecord: sealNow,
      shareSentences: revealables.filter((r) => r.record.share && r.record.sentence),
    });

    const signature = await this.deps.wallet.signAndSend(built.instructions, this.walletKey!);

    // Write down what happened before anything else asks. Without this the records stay on
    // "saved" although the entry is on chain — and then the streak counts zero evenings and the
    // next start tries to seal again. Found by the validator run on 21.09.2026.
    await this.deps.chain.confirm(signature).catch(() => false);
    const touched = [...revealables.map((r) => r.round), ...(sealNow && sealRound ? [sealRound] : [])];
    for (const round of touched) {
      await this.sealing!.reconcile(round).catch(() => undefined);
    }

    return {
      signature,
      revealed: revealables.map((r) => r.round.roundId),
      sealed: sealNow ? sealNow.roundId : null,
    };
  }

  /** One place that builds the daily transaction, so seal-only and evening cannot drift apart. */
  private async buildEvening(args: {
    reveals?: { roundId: number; pBps: number; salt: Uint8Array }[];
    sealRound?: CalendarRound;
    sealRecord?: SealRecord;
    shareSentences?: { record: SealRecord }[];
  }) {
    const memos: Uint8Array[] = [];
    // Sealed: the hash of the sentence, so it is fixed before the outcome. Revealed: the text.
    if (args.sealRecord?.share && args.sealRecord.sentence) {
      memos.push(sha256Of(args.sealRecord.salt, args.sealRecord.sentence));
    }
    for (const s of args.shareSentences ?? []) {
      if (s.record.sentence) memos.push(new TextEncoder().encode(s.record.sentence));
    }
    return buildDaily(
      {
        wallet: this.walletKey!,
        sgtMint: this.sgtMint!,
        sgtTokenAccount: this.sgtToken!,
        reveals: args.reveals ?? [],
        seal:
          args.sealRound && args.sealRecord
            ? { roundId: args.sealRound.roundId, commitment: hexToBytes(args.sealRecord.commitment) }
            : undefined,
        memos: memos.length > 0 ? memos : undefined,
      },
      await this.deps.chain.blockhash(),
    );
  }

  /**
   * The backup key (E2). 64 hex characters, useless without this wallet — it opens nothing on
   * its own, it only rebuilds the salts that this phone would have derived anyway.
   */
  async exportSecret(): Promise<string | null> {
    return new SeasonSecret({
      store: this.deps.store,
      now: this.deps.now,
      randomBytes: this.deps.randomBytes,
    }).exportSecret();
  }

  /**
   * After a reinstall: paste the key back, then rebuild every open answer from the chain.
   * Returns how many came back and which ones could not — a call that cannot be opened is named,
   * never silently dropped.
   */
  async importSecret(hex: string): Promise<{ recovered: number[]; lost: number[] }> {
    if (!this.walletKey) throw new Error("connect the wallet first");
    const secrets = new SeasonSecret({
      store: this.deps.store,
      now: this.deps.now,
      randomBytes: this.deps.randomBytes,
    });
    this.secretBytes = await secrets.importSecret(hex, this.walletKey);
    this.sealing = this.makeSealing();

    const now = this.deps.now();
    const open = this.deps.calendar.filter(
      (r) => now >= r.commitOpen && now < r.outcomeTime + 72 * 3600,
    );
    const entries = await this.deps.chain.entries(open.map((r) => r.roundId), this.sgtMint!);
    const pairs = open
      .filter((r) => entries.has(r.roundId))
      .map((round) => ({ round, entry: entries.get(round.roundId)! }));
    const { recovered, lost } = recoverAll({
      secret: this.secretBytes,
      calendar: this.deps.calendar,
      entries: pairs,
      wallet: this.walletKey,
      sgtMint: this.sgtMint!,
    });
    for (const record of recovered) {
      await setJson(this.deps.store, sealKey(record.roundId), record);
    }
    return { recovered: recovered.map((r) => r.roundId), lost };
  }

  /** The two numbers of the record, from what the chain stores. */
  async record(): Promise<{ hits: number; calls: number; player: Awaited<ReturnType<Chain["player"]>> }> {
    const ids = this.deps.calendar.map((r) => r.roundId);
    const [rounds, entries] = await Promise.all([
      this.deps.chain.rounds(ids),
      this.deps.chain.entries(ids, this.sgtMint!),
    ]);
    const items = [...entries.entries()]
      .map(([id, entry]) => ({ entry, round: rounds.get(id)! }))
      .filter((x) => x.round);
    return { ...sideRecord(items), player: await this.deps.chain.player(this.sgtMint!) };
  }
}
