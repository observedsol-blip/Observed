// The bridge between the session and the screens: one hook, one state, no decisions.
//
// It owns the three things a screen must never own — when to read the chain, what to do with an
// error, and what "busy" means — so that both screens stay pure drawings of a view.
import { useCallback, useEffect, useState } from "react";
import * as Crypto from "expo-crypto";
import { Chain } from "./chain/rpc.ts";
import { Session, type DayState } from "./core/session.ts";
import type { MemoryLogRow } from "./core/memory.ts";
import type { RecordView } from "./core/record.ts";
import type { SettingsView } from "./core/settings.ts";
import { SecureStoreAdapter } from "./platform/secureStore.ts";
import { ExpoNotifier } from "./platform/notifier.ts";
import { MwaWallet, type Cluster } from "./platform/mwaWallet.ts";
import type { CalendarRound } from "./chain/calendar.ts";

export type LiveConfig = { endpoint: string; cluster: Cluster; calendar: CalendarRound[] };

export function useDay(config: LiveConfig | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [day, setDay] = useState<DayState | null>(null);
  const [record, setRecord] = useState<RecordView | null>(null);
  const [offerReminders, setOfferReminders] = useState(false);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [others, setOthers] = useState<string[]>([]);
  const [memoryLog, setMemoryLog] = useState<MemoryLogRow[]>([]);
  /** null while it is being read: the example must not flash on a start that has seen it. */
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);

  // The session is built once, from the config. No wallet is opened here.
  useEffect(() => {
    if (!config) return;
    const store = new SecureStoreAdapter();
    const chain = new Chain(config.endpoint);
    const wallet = new MwaWallet({
      cluster: config.cluster,
      getBlockhash: () => chain.blockhash(),
      sendRaw: (raw) => chain.sendRaw(raw),
      tokens: {
        load: () => store.get("mwa-auth-token"),
        save: async (t) => (t === null ? store.delete("mwa-auth-token") : store.set("mwa-auth-token", t)),
        loadAddress: () => store.get("mwa-address"),
        saveAddress: async (a) => (a === null ? store.delete("mwa-address") : store.set("mwa-address", a)),
      },
    });
    setSession(
      new Session({
        chain,
        wallet,
        store,
        calendar: config.calendar,
        now: () => Math.floor(Date.now() / 1000),
        // Never the synchronous getRandomBytes: it falls back to Math.random under a
        // remote debugger, and that secret would then be kept for the season.
        randomBytes: (n) => Crypto.getRandomBytesAsync(n),
      }),
    );
  }, [config]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      setDay(await session.day());
      setOfferReminders(await session.shouldOfferReminders());
      setError(null);
    } catch (e) {
      // A network error is not a state of the game: say it, keep the last view.
      setError(message(e));
    }
  }, [session]);

  /** Record and Settings are read when their screen is opened, not on every refresh. */
  const loadRecord = useCallback(async () => {
    if (!session) return;
    try {
      setRecord(await session.record());
    } catch (e) {
      setError(message(e));
    }
  }, [session]);

  const loadSettings = useCallback(async () => {
    if (!session) return;
    try {
      setSettings(await session.settings());
    } catch (e) {
      setError(message(e));
    }
    // The memory log rides along with Settings: it is only ever looked at there, and it costs
    // one account read per answered call.
    try {
      setMemoryLog(await session.memoryLog());
    } catch {
      setMemoryLog([]);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!session) return;
    void session.introSeen().then(setIntroSeen);
  }, [session]);

  const dismissIntro = useCallback(async () => {
    if (!session) return;
    setIntroSeen(true);
    await session.markIntroSeen();
  }, [session]);

  const connect = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      const result = await session.connect();
      if (!result.ok) setError("No Genesis Token found in this wallet.");
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }, [session, refresh]);

  const save = useCallback(
    async (pBps: number, sentence?: string, share?: boolean) => {
      if (!session || !day || day.today.phase !== "open") return;
      const roundId = day.today.roundId;
      const current = config?.calendar.find((r) => r.roundId === roundId);
      if (!current) return;
      setError(null);
      try {
        await session.saveAnswer(current, pBps, sentence, share);
        await refresh();
      } catch (e) {
        setError(message(e));
      }
    },
    [session, day, config, refresh],
  );

  /** Reveal yesterday without sealing tonight — the same transaction minus the seal. */
  const revealOnly = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await session.revealOnly();
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }, [session, refresh]);

  const seal = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await session.evening();
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }, [session, refresh]);

  /**
   * The sentences of the others, fetched AFTER the result is drawn — it costs a walk through the
   * call's transaction history, and the evening must not wait for it. They only exist once this
   * player has revealed: `day.result` is null until then (session.latestResult).
   */
  const resultRoundId = day?.result?.roundId ?? null;
  useEffect(() => {
    if (!session || resultRoundId === null) {
      setOthers([]);
      return;
    }
    let live = true;
    void session
      .othersFor(resultRoundId)
      .then((list) => {
        if (live) setOthers(list);
      })
      // A history walk that fails is not a state of the game: the screen simply stays empty.
      .catch(() => {
        if (live) setOthers([]);
      });
    return () => {
      live = false;
    };
  }, [session, resultRoundId]);

  /**
   * Reminders (E3). The notifier is built here, but nothing touches the permission: on start the
   * session only rebuilds a schedule that already exists, and `request()` lives behind the tap.
   */
  useEffect(() => {
    if (!session) return;
    void session.refreshReminders(new ExpoNotifier());
  }, [session]);

  const reminders = session
    ? {
        offer: offerReminders,
        onEnable: async () => {
          const result = await session.turnRemindersOn(new ExpoNotifier());
          setOfferReminders(false);
          return result;
        },
        onDecline: async () => {
          await session.declineReminders();
          setOfferReminders(false);
        },
      }
    : null;

  /** The memory question's answer. It is written to this phone and to nothing else. */
  const remember = useCallback(
    async (roundId: number, confidence: number | null) => {
      if (!session) return;
      await session.remember(roundId, confidence);
      await refresh();
    },
    [session, refresh],
  );

  const backup = session
    ? {
        onExport: () => session.exportSecret(),
        onImport: async (hex: string) => {
          const result = await session.importSecret(hex);
          await refresh();
          return result;
        },
      }
    : null;

  // The result carries the sentences it was drawn without: one view, filled in two steps.
  const dayWithOthers =
    day && day.result ? { ...day, result: { ...day.result, others } } : day;

  return {
    day: dayWithOthers, record, settings, memoryLog, busy, error, reminders,
    introSeen, dismissIntro,
    connect, save, seal, revealOnly, refresh, loadRecord, loadSettings, backup, remember,
  };
}

function message(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  if (/fetch|network|timeout|ECONN/i.test(text)) return "No connection. Your answer is saved on this phone.";
  return text.slice(0, 160);
}
