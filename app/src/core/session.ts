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
import { REVEAL_WINDOW_SECS, RoundStatus } from "../chain/ids.ts";
import { findGenesisToken } from "../chain/sgt.ts";
import { roundPda } from "../chain/pda.ts";
import { pickSentences, verifiedSentences } from "./others.ts";
import type { Entry, Round } from "../chain/layout.ts";
import { sealMemo } from "./sentence.ts";
import { Sealing } from "./sealing.ts";
import { SeasonSecret } from "./secret.ts";
import { type ResultView, type TodayView, resultView, streakOf, todayView } from "./day.ts";
import { type RecordView, recordView } from "./record.ts";
import { type SettingsView, settingsView } from "./settings.ts";
import { revealableNow } from "./revealing.ts";
import { type SealRecord, sealKey } from "./records.ts";
import {
  NO_REMINDERS,
  REMINDER_KEY,
  type Notifier,
  type ReminderState,
  enableReminders,
  plan as planReminders,
  refreshAfterStart,
} from "./reminders.ts";
import { recoverAll } from "./recovery.ts";
import { type Store, getJson, setJson } from "./store.ts";
import type { Wallet } from "./wallet.ts";

export type SessionDeps = {
  chain: Chain;
  wallet: Wallet;
  store: Store;
  calendar: CalendarRound[];
  now: () => number;
  /** Asynchronous on purpose — see the note in core/secret.ts. */
  randomBytes: (n: number) => Promise<Uint8Array>;
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
  /** Set once `restore()` has run, so it does not walk the store on every refresh. */
  private restoreTried = false;

  constructor(deps: SessionDeps) {
    this.deps = deps;
  }

  /**
   * Picks the last session up again WITHOUT opening the wallet: the address from the store, the
   * Genesis Token from the chain (a read), the secret from the keystore.
   *
   * Everything the evening screen shows can be had this way — the wallet is only needed to
   * SIGN. Until 22.09.2026 the app asked for an authorisation before it drew anything at all,
   * so a cold start showed an empty screen and a button where yesterday's answer should be.
   *
   * It creates nothing. No stored secret means there is nothing of this player's on this
   * phone, and then the honest screen is the one that asks them to connect.
   */
  private async restore(): Promise<void> {
    if (this.walletKey || this.restoreTried) return;
    this.restoreTried = true;
    const stored = await this.deps.wallet.storedAddress?.();
    if (!stored) return;

    const secrets = new SeasonSecret({
      store: this.deps.store,
      now: this.deps.now,
      randomBytes: this.deps.randomBytes,
    });
    const kept = await secrets.stored();
    if (!kept || kept.wallet !== stored.toBase58()) return;

    const sgt = await findGenesisToken(
      { tokenAccountsOf: (o) => this.deps.chain.tokenAccountsOf(o), accountData: (k) => this.deps.chain.accountData(k) },
      stored,
    );
    if (!sgt.ok) return;

    this.walletKey = stored;
    this.sgtMint = sgt.mint;
    this.sgtToken = sgt.tokenAccount;
    this.secretBytes = hexToBytes(kept.secretHex);
    this.sealing = this.makeSealing();
  }

  /** Opens the wallet once, finds the Genesis Token, prepares the secret. */
  async connect(): Promise<{ ok: boolean; reason?: "no-sgt" }> {
    this.restoreTried = true; // an explicit connect replaces whatever was stored
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
    await this.restore();
    const now = this.deps.now();
    if (!this.walletKey) {
      return { today: this.emptyToday(now), result: null, openReveals: 0, wallet: null, sgtMint: null, blocked: "no-wallet" };
    }
    if (!this.sgtMint) {
      return { today: this.emptyToday(now), result: null, openReveals: 0, wallet: this.walletKey, sgtMint: null, blocked: "no-sgt" };
    }

    const openCalls = this.deps.calendar.filter(
      (r) => now >= r.commitOpen - 60 && now < r.outcomeTime + REVEAL_WINDOW_SECS,
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
        // Rent is only owed for an entry that does not exist yet.
        entryExists: sealable ? entries.has(sealable.roundId) : false,
      }),
      result: this.latestResult(rounds, entries, records),
      openReveals: revealables.length,
      wallet: this.walletKey,
      sgtMint: this.sgtMint,
      blocked: null,
    };
  }

  /**
   * The sentences of the others for one call, already checked against their seal memos, and
   * already narrowed to the two the screen shows (owner, 22.09.2026).
   *
   * Its own method because it costs a history walk: the screen asks for it after the result is
   * drawn, never inside `day()`. No handle and no address goes out with them — the sentence is
   * the whole point, who wrote it is not.
   */
  async othersFor(roundId: number, hidden?: Set<string>): Promise<string[]> {
    const transactions = await this.deps.chain.memoTransactionsOf(roundPda(roundId));
    const verified = verifiedSentences({ transactions, hidden, self: this.walletKey });
    return pickSentences(verified, roundId).map((o) => o.sentence);
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
      .filter((r) => now >= r.commitOpen - 60 && now < r.outcomeTime + REVEAL_WINDOW_SECS)
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
    const utf8 = (text: string) => new TextEncoder().encode(text);
    // Sealed: the hash of the sentence as hex TEXT, so it is fixed before the outcome and can be
    // read back. Revealed: the sentence itself. Raw hash bytes would fail the Memo program.
    if (args.sealRecord?.share && args.sealRecord.sentence) {
      memos.push(utf8(sealMemo(args.sealRecord.salt, args.sealRecord.sentence)));
    }
    for (const s of args.shareSentences ?? []) {
      if (s.record.sentence) memos.push(utf8(s.record.sentence));
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
   * The backup code (E2) — the word is "backup code", never "key" and never "recovery" (owner,
   * 21.09.2026). 64 hex characters, useless without this wallet: it opens nothing on its own, it
   * only rebuilds the salts that this phone would have derived anyway.
   */
  async exportSecret(): Promise<string | null> {
    return new SeasonSecret({
      store: this.deps.store,
      now: this.deps.now,
      randomBytes: this.deps.randomBytes,
    }).exportSecret();
  }

  /**
   * After a reinstall: paste the backup code back, then rebuild every open answer from the chain.
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
      (r) => now >= r.commitOpen && now < r.outcomeTime + REVEAL_WINDOW_SECS,
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

  /**
   * The Record, from what the chain stores plus the seal records on this phone.
   *
   * It asks for every call of the season at once — four RPC calls in total, and only when the
   * player opens the screen. Without a wallet there is nothing to ask, and the view says so with
   * zeros rather than with an invented empty state.
   */
  async record(): Promise<RecordView> {
    await this.restore();
    const now = this.deps.now();
    if (!this.sgtMint) {
      return recordView({
        now,
        calendar: this.deps.calendar,
        rounds: new Map(),
        entries: new Map(),
        records: [],
        player: null,
      });
    }
    const ids = this.deps.calendar.map((r) => r.roundId);
    const [rounds, entries, player] = await Promise.all([
      this.deps.chain.rounds(ids),
      this.deps.chain.entries(ids, this.sgtMint),
      this.deps.chain.player(this.sgtMint),
    ]);
    const records = this.sealing ? await this.sealing.all() : [];
    return recordView({ now, calendar: this.deps.calendar, rounds, entries, records, player });
  }

  /* ---------------------------------------------------------------- reminders (E3) */

  /** What the phone remembers: never asked, asked and refused, or on. */
  async reminderState(): Promise<ReminderState> {
    return (await getJson<ReminderState>(this.deps.store, REMINDER_KEY)) ?? NO_REMINDERS;
  }

  /**
   * The offer is made once, and only after the player has actually sealed something. Before the
   * first seal a reminder would be a notification about nothing — and the permission dialog would
   * arrive before the app has earned it (E3).
   */
  async shouldOfferReminders(): Promise<boolean> {
    const state = await this.reminderState();
    if (state.offered || state.enabled) return false;
    const records = this.sealing ? await this.sealing.all() : [];
    return records.some((r) => r.status === "confirmed");
  }

  /** What would be scheduled right now, from the calendar and the open reveals. */
  private async reminderPlan(): Promise<ReturnType<typeof planReminders>> {
    const now = this.deps.now();
    const records = this.sealing ? await this.sealing.all() : [];
    const ids = this.deps.calendar
      .filter((r) => now >= r.commitOpen - 60 && now < r.outcomeTime + REVEAL_WINDOW_SECS)
      .map((r) => r.roundId);
    const [rounds, entries] = this.sgtMint
      ? await Promise.all([
          this.deps.chain.rounds(ids),
          this.deps.chain.entries(ids, this.sgtMint),
        ])
      : [new Map<number, Round>(), new Map<number, Entry>()];
    const open = revealableNow({
      now,
      calendar: this.deps.calendar,
      records,
      roundState: (id) => rounds.get(id) ?? null,
      entryState: (id) => entries.get(id) ?? null,
    }).map((r) => ({
      roundId: r.round.roundId,
      revealCloseSeconds: rounds.get(r.round.roundId)?.revealClose ?? r.round.outcomeTime,
    }));
    return planReminders({
      now,
      calendar: this.deps.calendar,
      openReveals: open,
      hasSentence: records.some((r) => r.sentence !== undefined),
    });
  }

  /** The tap. The only path that may ever reach the permission dialog. */
  async turnRemindersOn(notifier: Notifier): Promise<{ granted: boolean; scheduled: number }> {
    const result = await enableReminders(notifier, await this.reminderPlan());
    await setJson(this.deps.store, REMINDER_KEY, {
      enabled: result.granted,
      offered: true,
    } satisfies ReminderState);
    return result;
  }

  /** The player said no. Remembered, so the offer does not come back by itself. */
  async declineReminders(): Promise<void> {
    await setJson(this.deps.store, REMINDER_KEY, {
      enabled: false,
      offered: true,
    } satisfies ReminderState);
  }

  /**
   * Cold start: rebuild the schedule if — and only if — reminders are already on. Nothing is
   * asked, nothing is even looked at otherwise.
   */
  async refreshReminders(notifier: Notifier): Promise<number> {
    const state = await this.reminderState();
    if (!state.enabled) return 0;
    return refreshAfterStart(notifier, await this.reminderPlan(), state);
  }

  /** Settings: the addresses that decide what this game is, each read from its own account. */
  async settings(): Promise<SettingsView> {
    await this.restore();
    const now = this.deps.now();
    const [config, upgradeAuthority] = await Promise.all([
      this.deps.chain.config(),
      this.deps.chain.upgradeAuthority(),
    ]);
    // The next call that still has a future — its times are the ones the reminders use.
    const next =
      this.deps.calendar.find((r) => r.outcomeTime > now) ??
      this.deps.calendar[this.deps.calendar.length - 1];
    return settingsView({
      wallet: this.walletKey,
      sgtMint: this.sgtMint,
      config,
      upgradeAuthority,
      outcomeTimeUtc: next?.outcomeTime ?? now,
      commitCloseUtc: next?.commitClose ?? now,
    });
  }
}
