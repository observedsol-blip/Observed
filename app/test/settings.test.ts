// Settings names the addresses that could change the rules. None of them may be invented.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { COST_LINE, localHhMm, settingsView, shortAddress } from "../src/core/settings.ts";
import type { Config } from "../src/chain/layout.ts";

const key = (n: number) => new PublicKey(Uint8Array.from(Array(32).fill(n)));
const config = (over: Partial<Config> = {}): Config =>
  ({
    version: 1,
    gameId: 1,
    calendarAuthority: key(1),
    pauseAuthority: key(2),
    paused: false,
    nextRoundId: 12,
    season: 1,
    calendarRoot: new Uint8Array(32),
    firstRoundId: 0,
    maxRoundId: 63,
    ...over,
  }) as Config;

const OUTCOME = Date.UTC(2026, 9, 6, 16, 0, 0) / 1000;
const CLOSE = Date.UTC(2026, 9, 6, 4, 0, 0) / 1000;
const utc = (unix: number) => new Date(unix * 1000).toISOString().slice(11, 16);

test("without a chain nothing is claimed", () => {
  const view = settingsView({
    wallet: null,
    sgtMint: null,
    config: null,
    upgradeAuthority: null,
    outcomeTimeUtc: OUTCOME,
    commitCloseUtc: CLOSE,
    toLocalHhMm: utc,
  });
  assert.equal(view.wallet, null);
  assert.equal(view.genesis, null, "no token, no 'Genesis · verified'");
  assert.deepEqual(view.authorities, { calendar: null, pause: null, upgrade: null });
});

test("every address comes from its own account", () => {
  const view = settingsView({
    wallet: key(7),
    sgtMint: key(8),
    config: config(),
    upgradeAuthority: key(3),
    outcomeTimeUtc: OUTCOME,
    commitCloseUtc: CLOSE,
    toLocalHhMm: utc,
  });
  assert.equal(view.wallet, key(7).toBase58());
  assert.equal(view.sgtMint, key(8).toBase58());
  assert.equal(view.genesis, "Genesis · verified");
  assert.equal(view.authorities.calendar, key(1).toBase58());
  assert.equal(view.authorities.pause, key(2).toBase58());
  assert.equal(view.authorities.upgrade, key(3).toBase58());
  assert.equal(view.cost, COST_LINE);
});

test("an immutable program says so by having no upgrade authority", () => {
  const view = settingsView({
    wallet: key(7),
    sgtMint: key(8),
    config: config(),
    upgradeAuthority: null,
    outcomeTimeUtc: OUTCOME,
    commitCloseUtc: CLOSE,
    toLocalHhMm: utc,
  });
  assert.equal(view.authorities.upgrade, null, "the screen shows '—', not a made-up address");
});

test("the push times are the reminder moments, one hour before the close", () => {
  const view = settingsView({
    wallet: key(7),
    sgtMint: key(8),
    config: config(),
    upgradeAuthority: key(3),
    outcomeTimeUtc: OUTCOME,
    commitCloseUtc: CLOSE,
    toLocalHhMm: utc,
  });
  assert.equal(view.push.outcome, "16:00");
  assert.equal(view.push.lastHour, "03:00", "one hour before sealing closes at 04:00");
});

test("times are formatted as HH:MM and addresses are shortened, not truncated", () => {
  assert.equal(localHhMm(Date.UTC(2026, 0, 1, 5, 7) / 1000).length, 5);
  assert.equal(shortAddress("9xQe1111111111111111111111117bTk"), "9xQe…7bTk");
  assert.equal(shortAddress("short"), "short");
});
