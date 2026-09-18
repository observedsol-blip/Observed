// Flip count = days where |move - threshold| < spread_ref + spread_out (bps), spreads from the logger (new stack, 5 s resolution).
import { readFileSync } from "node:fs";
const cache = JSON.parse(readFileSync("min_cache.json", "utf8"));
const THR = { "SOL-USD": [1.75, 1], "BTC-USD": [1.25, 0.5], "ETH-USD": [1.5, 0.75] };
// per-timestamp max spread (bps) from spread.mjs, new stack: [p50, p90, p99, max]
const S = {
  "SOL-USD": { "W10/A10": [3.3, 8.2, 18.8, 25.2], "W30/A15": [5.9, 13.3, 24.4, 32.3], "W60/A60": [11.6, 22.7, 36.5, 58.0], "W120/A60": [14.9, 27.2, 56.4, 72.8] },
  "BTC-USD": { "W10/A10": [1.7, 3.9, 7.7, 11.6], "W30/A15": [3.3, 6.8, 12.0, 18.2], "W60/A60": [6.5, 11.6, 18.2, 25.2], "W120/A60": [8.2, 14.3, 22.2, 25.2] },
  "ETH-USD": { "W30/A60": [3.0, 10.6, 20.1, 28.9], "W60/A60": [5.4, 15.3, 23.9, 28.9], "W120/A60": [9.2, 20.1, 30.1, 35.2] },
};
const END = Date.UTC(2026, 8, 18) / 1000;
for (const p of Object.keys(THR)) {
  const dist = [];
  for (let d = END - 90 * 86400; d < END; d += 86400) {
    const Tr = d + 4 * 3600, To = d + 16 * 3600, mr = cache[`${p}|${Tr}`], mo = cache[`${p}|${To}`];
    if (!mr?.[Tr] || !mo?.[To]) continue;
    const dow = new Date(d * 1000).getUTCDay(), x = (dow >= 1 && dow <= 5 ? THR[p][0] : THR[p][1]);
    dist.push(Math.abs(Math.abs(mo[To][2] / mr[Tr][2] - 1) * 100 - x) * 100); // bps distance of the move to the threshold
  }
  const within = (b) => dist.filter(v => v < b).length;
  console.log(`\n${p}: ${dist.length} days; days within 10/20/40/80 bps of the threshold: ${within(10)}/${within(20)}/${within(40)}/${within(80)}`);
  for (const [k, [p50, p90, p99, mx]] of Object.entries(S[p])) {
    console.log(`  ${k}: flippable days if both timestamps at p50 ${within(2 * p50)}, p90 ${within(2 * p90)}, p99 ${within(2 * p99)}, max ${within(2 * mx)}  → per 64-round season ≈ ${(within(2 * p90) / dist.length * 64).toFixed(1)} (p90)`);
  }
}