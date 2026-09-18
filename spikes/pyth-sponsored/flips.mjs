// Q2 follow-up: on how many of the last 90 days could the admissible spread flip a "move" question?
// Coinbase 1-min candles around 04:00 and 16:00 UTC (upper bound: whole minutes, high/low).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const PRODUCTS = ["SOL-USD", "BTC-USD", "ETH-USD"];
const END = Date.UTC(2026, 8, 18) / 1000, DAYS = 90;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let cache = existsSync("min_cache.json") ? JSON.parse(readFileSync("min_cache.json", "utf8")) : {};
async function candles(p, T) {
  const key = `${p}|${T}`; if (cache[key]) return cache[key];
  const url = `https://api.exchange.coinbase.com/products/${p}/candles?granularity=60&start=${new Date((T - 360) * 1000).toISOString()}&end=${new Date((T + 420) * 1000).toISOString()}`;
  for (let a = 0; a < 5; a++) { const r = await fetch(url); if (r.ok) { const m = {}; for (const [t, lo, hi, op, cl] of await r.json()) m[t] = [lo, hi, op, cl]; await sleep(250); return cache[key] = m; } await sleep(1500); }
  throw new Error("fetch " + url);
}
// thresholds from the one-year hourly file (first 274 days): rate closest to 45 %, weekday and weekend separately
const moves = JSON.parse(readFileSync("moves_0416.json", "utf8"));
const grid = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const thr = {};
for (const p of PRODUCTS) {
  const train = moves[p].moves.slice(0, -90); const wd = v => v.dow >= 1 && v.dow <= 5;
  const pick = (arr) => grid.reduce((b, x) => Math.abs(arr.filter(v => v.m > x).length / arr.length - 0.45) < Math.abs(arr.filter(v => v.m > b).length / arr.length - 0.45) ? x : b, 1);
  thr[p] = { wk: pick(train.filter(wd)), we: pick(train.filter(v => !wd(v))) };
}
console.log("thresholds (weekday/weekend, % move):", JSON.stringify(thr));
const COMBOS = [["W≤60s,A≤60s", 60, 60], ["W=120s,A=60s", 120, 60], ["W=300s,A=120s", 300, 120]];
const range = (m, T, W, A) => { let lo = Infinity, hi = -Infinity;
  for (let t = Math.floor((T - A) / 60) * 60; t <= T + W; t += 60) if (m[t]) { lo = Math.min(lo, m[t][0]); hi = Math.max(hi, m[t][1]); }
  return [lo, hi]; };
const atT = (m, T) => m[T] ? m[T][2] : (m[T - 60] ? m[T - 60][3] : null);
for (const p of PRODUCTS) {
  const res = COMBOS.map(() => ({ flips: 0, days: 0, flipDays: [] })); let yes = 0, n = 0;
  for (let d = END - DAYS * 86400; d < END; d += 86400) {
    const Tr = d + 4 * 3600, To = d + 16 * 3600;
    const mr = await candles(p, Tr), mo = await candles(p, To);
    const pr = atT(mr, Tr), po = atT(mo, To); if (!pr || !po) continue;
    const dow = new Date(d * 1000).getUTCDay(); const x = (dow >= 1 && dow <= 5 ? thr[p].wk : thr[p].we) / 100;
    const truth = Math.abs(po / pr - 1) > x; n++; if (truth) yes++;
    COMBOS.forEach(([name, W, A], i) => {
      const [rl, rh] = range(mr, Tr, W, A), [ol, oh] = range(mo, To, W, A);
      const rlo = ol / rh, rhi = oh / rl;                        // ratio range out/ref
      const minMove = rlo <= 1 && rhi >= 1 ? 0 : Math.min(Math.abs(rlo - 1), Math.abs(rhi - 1));
      const maxMove = Math.max(Math.abs(rlo - 1), Math.abs(rhi - 1));
      res[i].days++;
      if (minMove <= x && maxMove > x) { res[i].flips++; res[i].flipDays.push(`${new Date(d * 1000).toISOString().slice(5, 10)} (${(Math.abs(po / pr - 1) * 100).toFixed(2)}% vs ${(x * 100).toFixed(2)}%)`); }
    });
  }
  console.log(`\n${p}: ${n} days, Yes on ${yes} (${(yes / n * 100).toFixed(0)} %)`);
  COMBOS.forEach(([name], i) => console.log(`  ${name}: outcome flippable on ${res[i].flips}/${res[i].days} days${res[i].flips ? " — " + res[i].flipDays.join(", ") : ""}`));
}
writeFileSync("min_cache.json", JSON.stringify(cache));