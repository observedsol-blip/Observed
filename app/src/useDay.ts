// The bridge between the session and the screens: one hook, one state, no decisions.
//
// It owns the three things a screen must never own — when to read the chain, what to do with an
// error, and what "busy" means — so that both screens stay pure drawings of a view.
import { useCallback, useEffect, useState } from "react";
import * as Crypto from "expo-crypto";
import { Chain } from "./chain/rpc.ts";
import { Session, type DayState } from "./core/session.ts";
import { SecureStoreAdapter } from "./platform/secureStore.ts";
import { MwaWallet, type Cluster } from "./platform/mwaWallet.ts";
import type { CalendarRound } from "./chain/calendar.ts";

export type LiveConfig = { endpoint: string; cluster: Cluster; calendar: CalendarRound[] };

export function useDay(config: LiveConfig | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [day, setDay] = useState<DayState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        randomBytes: (n) => Crypto.getRandomBytes(n),
      }),
    );
  }, [config]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      setDay(await session.day());
      setError(null);
    } catch (e) {
      // A network error is not a state of the game: say it, keep the last view.
      setError(message(e));
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  return { day, busy, error, connect, save, seal, refresh };
}

function message(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  if (/fetch|network|timeout|ECONN/i.test(text)) return "No connection. Your answer is saved on this phone.";
  return text.slice(0, 160);
}
