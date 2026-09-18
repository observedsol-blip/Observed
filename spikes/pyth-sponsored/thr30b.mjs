import { readFileSync } from "node:fs";
const D = JSON.parse(readFileSync("moves_0416.json", "utf8"));
const wd = v => v.dow >= 1 && v.dow <= 5;
const grid = Array.from({ length: 40 }, (_, i) => Math.round((0.2 + i * 0.05) * 100) / 100);
for (const p of ["SOL-USD", "BTC-USD", "ETH-USD"]) for (const [part, f] of [["Mo–Fr", wd], ["Sa/So", v => !wd(v)]]) {
  const a30 = D[p].moves.slice(-30).filter(f), a60 = D[p].moves.slice(-60).filter(f), a90 = D[p].moves.slice(-90).filter(f);
  const r = (a, x) => a.filter(v => v.m > x).length / a.length;
  // primary: last 30 d (as asked); tie-break / guard: 60 d must stay inside 30–70 %
  const ok = grid.filter(x => r(a60, x) >= 0.3 && r(a60, x) <= 0.7);
  const best = (ok.length ? ok : grid).reduce((b, x) => Math.abs(r(a30, x) - 0.45) < Math.abs(r(a30, b) - 0.45) ? x : b);
  console.log(`${p} ${part}: ${best.toFixed(2)} %  → 30 d ${(r(a30, best) * 100).toFixed(0)} % (n=${a30.length}), 60 d ${(r(a60, best) * 100).toFixed(0)} % (n=${a60.length}), 90 d ${(r(a90, best) * 100).toFixed(0)} %`);
}