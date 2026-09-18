// Q1/Q2 on logger data: gaps and admissible-value spread for "first valid submission in [T, T+W], value age <= A".
import { readFileSync } from "node:fs";
const lines = readFileSync("log.jsonl", "utf8").trim().split("\n").map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const want = { "new|0|Crypto.SOL/USD": "SOL neu/0", "new|0|Crypto.BTC/USD": "BTC neu/0", "new|0|Crypto.ETH/USD": "ETH neu/0",
  "old|0|Crypto.SOL/USD": "SOL alt/0", "old|0|Crypto.BTC/USD": "BTC alt/0", "old|0|Crypto.ETH/USD": "ETH alt/0" };
const norm = (f) => (/^[A-Z]+\/USD$/.test(f) ? "Crypto." + f : f);
const FROM = 1789746150;
const g = {};
for (const l of lines) {
  if (l.publish === undefined || l.t / 1000 < FROM) continue;
  const k = `${l.prog ?? "old"}|${l.shard}|${norm(l.feed)}`; if (!want[k]) continue;
  (g[k] ??= new Map()).has(l.publish) || g[k].set(l.publish, { pub: l.publish, seen: l.t / 1000, price: Number(l.price) });
}
const hb = lines.filter(l => l.hb && l.t / 1000 >= FROM).map(l => l.t / 1000);
console.log(`window ${new Date(FROM * 1000).toISOString()} → ${new Date(hb.at(-1) * 1000).toISOString()} (${((hb.at(-1) - FROM) / 3600).toFixed(1)} h)`);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const [k, name] of Object.entries(want)) {
  const u = [...(g[k]?.values() ?? [])].sort((a, b) => a.pub - b.pub);
  const gaps = u.slice(1).map((x, i) => x.pub - u[i].pub);
  const top = [...gaps.map((d, i) => [d, u[i].pub])].sort((a, b) => b[0] - a[0]).slice(0, 3).map(([d, t]) => `${d}s@${new Date(t * 1000).toISOString().slice(11, 19)}`);
  console.log(`\n${name}: ${u.length} updates, gap p50 ${q(gaps, .5)} s, p99 ${q(gaps, .99)} s, max ${Math.max(...gaps)} s  [${top.join(", ")}]`);
  for (const [W, A] of [[10, 10], [30, 15], [30, 60], [60, 60], [120, 60], [300, 120]]) {
    const dev = [];
    for (let T = Math.ceil(u[0].pub / 60) * 60 + 600; T < u.at(-1).pub - W; T += 60) {
      const base = u.filter(x => x.pub <= T).at(-1); if (!base) continue;
      const adm = u.filter(x => x.pub >= T - A && x.pub <= T + W);
      if (!adm.length) { dev.push(Infinity); continue; }
      dev.push(Math.max(...adm.map(x => Math.abs(x.price / base.price - 1) * 1e4)));
    }
    const none = dev.filter(d => d === Infinity).length;
    const fin = dev.filter(Number.isFinite);
    console.log(`  W=${W}s A=${A}s: max spread bps p50 ${q(fin, .5).toFixed(1)} p90 ${q(fin, .9).toFixed(1)} p99 ${q(fin, .99).toFixed(1)} max ${Math.max(...fin).toFixed(1)}; no admissible value ${none}/${dev.length}`);
  }
}