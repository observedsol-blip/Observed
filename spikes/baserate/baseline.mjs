import { readFileSync } from "node:fs";
const D = JSON.parse(readFileSync("moves_0416.json", "utf8"));
const r5 = (p) => Math.round(p * 20) / 20;
for (const [prod, x] of [["SOL-USD", 2], ["BTC-USD", 1], ["ETH-USD", 1.5]]) {
  const mv = D[prod].moves; const train = mv.slice(0, mv.length - 90), test = mv.slice(-90);
  const rate = (a) => a.filter(v => v.m > x).length / a.length;
  const pAll = r5(rate(train));
  const wd = (v) => v.dow >= 1 && v.dow <= 5;
  const pWk = r5(rate(train.filter(wd))), pWe = r5(rate(train.filter(v => !wd(v))));
  const brier = (f) => test.reduce((s, v) => { const y = v.m > x ? 1 : 0; return s + (f(v) - y) ** 2; }, 0) / test.length;
  const per = (f) => test.map(v => (f(v) - (v.m > x ? 1 : 0)) ** 2);
  const sd = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
  const b50 = brier(() => 0.5), bAll = brier(() => pAll), bCond = brier(v => wd(v) ? pWk : pWe);
  const se13 = sd(per(() => pAll)) / Math.sqrt(13), se64 = sd(per(() => pAll)) / Math.sqrt(64);
  console.log(`${prod} >${x}%: train rate ${(rate(train)*100).toFixed(1)}% -> frozen p ${pAll}; test (last 90 d) rate ${(rate(test)*100).toFixed(1)}%`);
  console.log(`  Brier on last 90 d: always-50 ${b50.toFixed(3)} | frozen base rate ${bAll.toFixed(3)} | weekday/weekend base rate (${pWk}/${pWe}) ${bCond.toFixed(3)}`);
  console.log(`  SE of a player's mean Brier: 13 rounds ±${se13.toFixed(3)}, 64 rounds ±${se64.toFixed(3)}`);
}