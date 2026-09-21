// What Settings shows, derived from the chain — not from a fixture.
//
// Every address on this screen is read from an account: the wallet from the session, the mint
// from the token this device holds, calendar and pause authority from `Config`, the upgrade
// authority from the program's own ProgramData account. If a value cannot be read it stays
// `null` and the screen says nothing about it, because an authority nobody can name is exactly
// the thing a player should not be reassured about.
import type { PublicKey } from "@solana/web3.js";
import type { Config } from "../chain/layout.ts";
import { copy } from "../copy.ts";

export type SettingsView = {
  wallet: string | null;
  sgtMint: string | null;
  /** `Genesis · verified` — only when this device really holds the token. */
  genesis: string | null;
  authorities: { calendar: string | null; pause: string | null; upgrade: string | null };
  paused: boolean;
  /** The two local times the reminders fire at, as `HH:MM`. */
  push: { outcome: string; lastHour: string };
  cost: string;
};

/** `Genesis · verified`, as in §2 and §7. */
const GENESIS_VERIFIED = "Genesis · verified";

/**
 * The cost line, word for word the one on Today (03 §2 and Spec §11) — one sentence, two places,
 * one constant.
 */
export const COST_LINE =
  "No app fees. Network ≈ 0.0001 SOL per day · ≈ 0.002 SOL deposit, refunded when the call closes.";

export function settingsView(args: {
  wallet: PublicKey | null;
  sgtMint: PublicKey | null;
  config: Config | null;
  upgradeAuthority: PublicKey | null;
  /** UTC seconds of the two reminder moments, taken from the calendar, not from a habit. */
  outcomeTimeUtc: number;
  commitCloseUtc: number;
  /** Injected so the test does not depend on the machine's timezone. */
  toLocalHhMm?: (unixSeconds: number) => string;
}): SettingsView {
  const local = args.toLocalHhMm ?? localHhMm;
  return {
    wallet: args.wallet?.toBase58() ?? null,
    sgtMint: args.sgtMint?.toBase58() ?? null,
    genesis: args.sgtMint ? GENESIS_VERIFIED : null,
    authorities: {
      calendar: args.config?.calendarAuthority.toBase58() ?? null,
      pause: args.config?.pauseAuthority.toBase58() ?? null,
      upgrade: args.upgradeAuthority?.toBase58() ?? null,
    },
    paused: args.config?.paused ?? false,
    push: {
      outcome: local(args.outcomeTimeUtc),
      // One hour before sealing closes — the same rule core/reminders.ts schedules by.
      lastHour: local(args.commitCloseUtc - 3_600),
    },
    cost: COST_LINE,
  };
}

/** `HH:MM` in the device's own timezone. */
export function localHhMm(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** `9xQe…7bTk` — long enough to compare, short enough to read. */
export function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export const settingsCopy = {
  ownership: "The answer belongs to the wallet that sealed it.",
  noCharge: "Observed does not charge you.",
  backup: copy.backup,
} as const;
