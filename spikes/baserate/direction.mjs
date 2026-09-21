// One-off measurement for the direction question (E1): is the 16:00 UTC price higher than the
// 04:00 one? Same source and the same caveat as baserate.mjs: Coinbase public hourly candles,
// not the Pyth aggregate. Good enough for a rate over months, never for a single round.
// Also measures how often a round would be inside the 25 bps measurement band, because with
// threshold 0 "close" means something different than with a 1 % threshold.
const PRODUCTS = ["SOL-USD", "BTC-USD", "ETH-USD"];
const DAYS = Number(process.env.DAYS ?? 365);
const end = Math.floor(Date.UTC(2026, 8, 21) / 1000);
const start = end - DAYS * 86400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BANDS = [10, 25, 50, 100];
const out = {};

for (const p of PRODUCTS) {
  const c = new Map();
  let calls = 0;
  for (let s = start; s < end; s += 300 * 3600) {
    const e = Math.min(end, s + 300 * 3600);
    const url = `https://api.exchange.coinbase.com/products/${p}/candles?granularity=3600&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`;
    const r = await fetch(url, { headers: { "user-agent": "observed-spike" } });
    calls++;
    if (!r.ok) { console.log(p, r.status, await r.text()); process.exit(1); }
    for (const [t, lo, hi, op, cl] of await r.json()) c.set(t, { op, cl });
    await sleep(350);
  }

  const days = [];
  for (let d = Math.ceil(start / 86400) * 86400; d < end; d += 86400) {
    const a = c.get(d + 4 * 3600), b = c.get(d + 15 * 3600);
    if (!a || !b) continue;
    // signed move in basis points; the program decides strictly, equality counts as No
    days.push({ d, dow: new Date(d * 1000).getUTCDay(), bps: (b.cl / a.op - 1) * 10_000 });
  }

  const pct = (arr, f) => (arr.length ? (arr.filter(f).length / arr.length * 100).toFixed(1) : "—");
  const wk = (arr) => arr.filter((v) => v.dow >= 1 && v.dow <= 5);
  const we = (arr) => arr.filter((v) => v.dow === 0 || v.dow === 6);
  const up = (v) => v.bps > 0;
  const report = (label, arr) => {
    console.log(`  ${label}: n=${arr.length}  Yes(up) ${pct(arr, up)} %  ` +
      BANDS.map((b) => `|move|<=${b}bps ${pct(arr, (v) => Math.abs(v.bps) <= b)} %`).join("  "));
  };

  const last90 = days.slice(-90);
  console.log(`${p}: ${calls} requests, ${c.size} candles, ${days.length} days`);
  report("365 days      ", days);
  report("365 weekday   ", wk(days));
  report("365 weekend   ", we(days));
  report("last 90 days  ", last90);
  report("last 90 weekday", wk(last90));
  report("last 90 weekend", we(last90));
  const abs = days.map((v) => Math.abs(v.bps)).sort((a, b) => a - b);
  console.log(`  |move| median ${abs[Math.floor(abs.length / 2)].toFixed(0)} bps, ` +
    `p10 ${abs[Math.floor(abs.length * 0.1)].toFixed(0)} bps, p25 ${abs[Math.floor(abs.length * 0.25)].toFixed(0)} bps`);
  // longest run of one side: does the direction question have a cheap "always up" strategy?
  let run = 1, best = 1, side = null;
  for (let i = 1; i < days.length; i++) {
    if (up(days[i]) === up(days[i - 1])) { run++; best = Math.max(best, run); } else run = 1;
  }
  console.log(`  longest run of the same side: ${best} days`);
  out[p] = { days };
}
(await import("node:fs")).writeFileSync("direction_0416.json", JSON.stringify(out));
