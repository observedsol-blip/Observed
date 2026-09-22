#!/usr/bin/env node
// Base rates per question kind, and the two candidate measuring windows, over the last 90 days.
//
//   node spikes/baserate/windows.mjs [--days 90] [--out windows.json]
//
// Source: Coinbase public minute candles (no key). Same caveat as baserate.mjs and
// direction.mjs — this is the Coinbase price, not the Pyth aggregate, and not our exact
// measurement moment. Good for a rate over months, never for a single round.
//
// Windows, both in UTC on the same calendar day:
//   A = 04:02 -> 16:00   the season's window today
//   B = 13:30 -> 20:00   the candidate: US data releases and the US session inside it
//
// Question kinds, exactly as the program decides them (lib.rs `decide`, strict both ways):
//   ABOVE x   outcome > reference × (1 + x/10 000)          x may be negative
//   MOVE  x   |outcome/reference − 1| > x/10 000
const PRODUCTS = ["SOL-USD", "BTC-USD", "ETH-USD"];
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i === -1 ? d : process.argv[i + 1];
};
const DAYS = Number(arg("days", 90));
const OUT = arg("out", null);
// The last full UTC day before today, so no half day is counted.
const endDay = Math.floor(Date.now() / 86_400_000) * 86_400;
const startDay = endDay - DAYS * 86_400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ABOVE = [100, 150, 200, 300, -100, -150, -200];
const MOVE = [150, 200, 300];
const WINDOWS = {
  A: { from: 4 * 3600 + 120, to: 16 * 3600, label: "04:02 → 16:00 UTC" },
  B: { from: 13 * 3600 + 1800, to: 20 * 3600, label: "13:30 → 20:00 UTC" },
};

/** Minute candles for one product, as a map minute-timestamp -> open price. */
async function minutes(product) {
  const open = new Map();
  let calls = 0;
  for (let s = startDay; s < endDay; s += 300 * 60) {
    const e = Math.min(endDay, s + 300 * 60);
    const url =
      `https://api.exchange.coinbase.com/products/${product}/candles` +
      `?granularity=60&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`;
    let rows = null;
    // A year of minute candles is ~5 000 requests; over that many, a socket WILL die. The
    // retry has to survive a thrown fetch, not only a non-ok answer — the first run of this
    // ended after eighteen minutes on `SocketError: other side closed` (22.09.2026).
    for (let attempt = 0; attempt < 6 && rows === null; attempt += 1) {
      try {
        const r = await fetch(url, { headers: { "user-agent": "observed-spike" } });
        calls += 1;
        if (r.ok) rows = await r.json();
        else await sleep(1000 * (attempt + 1));
      } catch {
        await sleep(1000 * (attempt + 1));
      }
    }
    if (rows === null) throw new Error(`${product}: giving up at ${new Date(s * 1000).toISOString()}`);
    // [ time, low, high, open, close, volume ]
    for (const [t, , , op] of rows) open.set(t, op);
    await sleep(140);
  }
  console.error(`# ${product}: ${open.size} minutes in ${calls} calls`);
  return open;
}

/** The price at that exact minute, or the last one within five minutes before it. */
function priceAt(open, t) {
  for (let back = 0; back <= 5 * 60; back += 60) {
    const v = open.get(t - back);
    if (v !== undefined) return v;
  }
  return null;
}

const data = {};
for (const p of PRODUCTS) data[p] = await minutes(p);

/** One row per day and window: the reference, the outcome and the move in basis points. */
const moves = {};
for (const p of PRODUCTS) {
  moves[p] = {};
  for (const [w, def] of Object.entries(WINDOWS)) {
    const rows = [];
    for (let d = startDay; d < endDay; d += 86_400) {
      const ref = priceAt(data[p], d + def.from);
      const out = priceAt(data[p], d + def.to);
      if (ref === null || out === null || ref <= 0) continue;
      const day = new Date(d * 1000).getUTCDay();
      rows.push({
        day: d,
        weekend: day === 0 || day === 6,
        bps: ((out - ref) / ref) * 10_000,
      });
    }
    moves[p][w] = rows;
  }
}

const pct = (hits, n) => (n === 0 ? "—" : `${((100 * hits) / n).toFixed(1)} %`);

console.log(`# ${DAYS} days, ${new Date(startDay * 1000).toISOString().slice(0, 10)} → ${new Date(endDay * 1000).toISOString().slice(0, 10)}`);
console.log("# source: Coinbase minute candles (open of the minute), not the Pyth aggregate\n");

for (const [w, def] of Object.entries(WINDOWS)) {
  console.log(`## Window ${w}: ${def.label}\n`);
  console.log("| Frage | " + PRODUCTS.map((p) => `${p.split("-")[0]} alle`).join(" | ") + " | SOL Wo-tag | SOL Wo-ende |");
  console.log("|---" + "|---".repeat(PRODUCTS.length + 2) + "|");
  const line = (name, test) => {
    const cells = PRODUCTS.map((p) => {
      const rows = moves[p][w];
      return `${pct(rows.filter(test).length, rows.length)} (n=${rows.length})`;
    });
    const sol = moves["SOL-USD"][w];
    const wd = sol.filter((r) => !r.weekend);
    const we = sol.filter((r) => r.weekend);
    cells.push(`${pct(wd.filter(test).length, wd.length)} (n=${wd.length})`);
    cells.push(`${pct(we.filter(test).length, we.length)} (n=${we.length})`);
    console.log(`| ${name} | ${cells.join(" | ")} |`);
  };
  line("ABOVE 0 (Richtung)", (r) => r.bps > 0);
  for (const x of ABOVE) line(`ABOVE ${x > 0 ? "+" : ""}${x} bps`, (r) => r.bps > x);
  for (const x of MOVE) line(`MOVE ${x} bps`, (r) => Math.abs(r.bps) > x);
  line("|Δ| > 200 bps", (r) => Math.abs(r.bps) > 200);
  console.log("");
}

// ---- the window question: how much of SOL is just BTC? ----------------------------------------
function r2(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return (sxy * sxy) / (sxx * syy);
}

console.log("## SOL gegen BTC, je Fenster\n");
console.log("| Fenster | R² SOL~BTC | Anteil \\|Δ\\| > 2 % SOL | BTC | ETH | n |");
console.log("|---|---|---|---|---|---|");
for (const [w, def] of Object.entries(WINDOWS)) {
  const sol = moves["SOL-USD"][w];
  const btc = moves["BTC-USD"][w];
  const eth = moves["ETH-USD"][w];
  const days = sol.filter((r) => btc.some((b) => b.day === r.day));
  const xs = days.map((r) => btc.find((b) => b.day === r.day).bps);
  const ys = days.map((r) => r.bps);
  const big = (rows) => pct(rows.filter((r) => Math.abs(r.bps) > 200).length, rows.length);
  console.log(
    `| ${def.label} | ${r2(xs, ys).toFixed(3)} | ${big(sol)} | ${big(btc)} | ${big(eth)} | ${days.length} |`,
  );
}

if (OUT) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(OUT, JSON.stringify({ days: DAYS, startDay, endDay, moves }, null, 1));
  console.error(`# written: ${OUT}`);
}
