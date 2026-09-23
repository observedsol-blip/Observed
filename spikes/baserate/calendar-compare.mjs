#!/usr/bin/env node
// Two calendars side by side, with what a year of real prices says about each question in them.
//
//   node spikes/baserate/calendar-compare.mjs <a.json> <b.json> --prices windows365.json
//
// Writes nothing and publishes nothing. It reads two calendars that some generator already
// produced and answers three questions per question kind in each:
//
//   * how many rounds of that kind are in the calendar, and on which feed
//   * how often that question would have been YES over the measured year — the base rate
//   * how often it would have landed inside the measurement band — "Too close to call"
//
// The band matters as much as the base rate and is easier to forget. A round inside the band
// counts for nobody: no hit, no miss, no side record. A question kind that spends a quarter of
// its evenings there is a different thing from one that spends a tenth.
//
// Both numbers are computed ONLY over the weekdays that kind actually falls on in that
// calendar. A Friday question must be measured on Fridays.
//
// Prices: `windows365.json` from windows.mjs — Coinbase minute candles, window 04:02 → 16:00
// UTC, the same window the season measures. Not the Pyth aggregate; good for a rate over a
// year, never for a single round.
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const files = argv.filter((a) => !a.startsWith("--") && !argv[argv.indexOf(a) - 1]?.startsWith("--"));
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const PRICES = arg("prices", "windows365.json");
const BAND_BPS = Number(arg("band", 25));
if (files.length < 2) {
  console.error("usage: calendar-compare.mjs <a.json> <b.json> [--prices windows365.json] [--band 25]");
  process.exit(2);
}

const prices = JSON.parse(readFileSync(PRICES, "utf8"));
const KIND = { 0: "ABOVE", 1: "MOVE" };

/** Every measured day for one feed, with its UTC weekday. */
function daysOf(feedName) {
  const product = `${feedName.split("/")[0]}-USD`;
  const rows = prices.moves[product]?.A;
  if (!rows) throw new Error(`no measured prices for ${product}`);
  return rows.map((r) => ({ ...r, weekday: new Date(r.day * 1000).getUTCDay() }));
}

/**
 * The margin the program would write: how far the outcome cleared the threshold, in basis
 * points (lib.rs `margin_bps`). ABOVE: move − x. MOVE: |move| − x. Positive means Yes.
 */
const marginOf = (kind, offsetBps, bps) => (kind === 1 ? Math.abs(bps) : bps) - offsetBps;

/** One line per distinct question in a calendar. */
function profile(calendar) {
  const groups = new Map();
  for (const r of calendar.rounds) {
    const weekday = new Date(r.outcomeTime * 1000).getUTCDay();
    const key = `${r.kind}|${r.offsetBps}|${r.feed}`;
    const g = groups.get(key) ?? {
      kind: r.kind,
      offsetBps: r.offsetBps,
      feed: r.feed,
      count: 0,
      weekdays: new Set(),
    };
    g.count += 1;
    g.weekdays.add(weekday);
    groups.set(key, g);
  }

  const out = [];
  for (const g of groups.values()) {
    const rows = daysOf(g.feed).filter((d) => g.weekdays.has(d.weekday));
    const margins = rows.map((d) => marginOf(g.kind, g.offsetBps, d.bps));
    const yes = margins.filter((m) => m > 0).length;
    const close = margins.filter((m) => Math.abs(m) <= BAND_BPS).length;
    out.push({
      ...g,
      n: rows.length,
      baseRate: rows.length ? (100 * yes) / rows.length : null,
      tooClose: rows.length ? (100 * close) / rows.length : null,
    });
  }
  return out.sort((a, b) => b.count - a.count || a.feed.localeCompare(b.feed));
}

const DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const label = (g) =>
  g.kind === 1
    ? `Bewegung > ${g.offsetBps / 100} %`
    : g.offsetBps === 0
      ? "Richtung"
      : `> ${g.offsetBps > 0 ? "+" : ""}${g.offsetBps / 100} %`;

for (const file of files.slice(0, 2)) {
  const cal = JSON.parse(readFileSync(file, "utf8"));
  const first = new Date(Math.min(...cal.rounds.map((r) => r.commitOpen)) * 1000);
  console.log(`\n## ${file}`);
  console.log(`Wurzel: \`${cal.merkleRoot}\``);
  console.log(`Start: ${first.toISOString().slice(0, 16).replace("T", " ")} UTC · ${cal.rounds.length} Runden\n`);
  console.log("| Frageart | Feed | Runden | Wochentage | Basisrate (Ja) | Too close | n Tage |");
  console.log("|---|---|---|---|---|---|---|");
  for (const g of profile(cal)) {
    const wd = [...g.weekdays].sort().map((d) => DAYS[d]).join(" ");
    console.log(
      `| ${label(g)} | ${g.feed.split("/")[0]} | ${g.count} | ${wd} | ` +
        `${g.baseRate.toFixed(1)} % | ${g.tooClose.toFixed(1)} % | ${g.n} |`,
    );
  }
  const closeAll =
    profile(cal).reduce((sum, g) => sum + (g.tooClose * g.count) / 100, 0) / cal.rounds.length;
  console.log(`\nueber alle 64 Runden gewichtet: ${(100 * closeAll).toFixed(1)} % Too close to call`);
}
