// Per-feed cadence, weekend/night activity and gaps. FROM/TO in unix seconds (optional).
import { readFileSync, writeFileSync } from "node:fs";
const FROM = Number(process.env.FROM ?? 0), TO = Number(process.env.TO ?? 9e12);
const lines = readFileSync("log.jsonl", "utf8").trim().split("\n").map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const meta = new Map();
for (const [file, prog] of [["sponsored.json", "old"], ["sponsored_upgraded.json", "new"]])
  for (const x of JSON.parse(readFileSync(file, "utf8"))) meta.set(`${prog}|${x.shard}|${x.symbol}`, { ...x, prog });
// coverage from all log lines (logger alive)
const ts = lines.map(l => l.t / 1000).filter(t => t >= FROM && t <= TO).sort((a, b) => a - b);
const cover = []; let a = ts[0], p = ts[0];
for (const t of ts.slice(1)) { if (t - p > 120) { cover.push([a, p]); a = t; } p = t; }
cover.push([a, p]);
const alive = (t) => cover.some(([x, y]) => t >= x && t <= y);
const coveredSecs = cover.reduce((s, [x, y]) => s + y - x, 0);
const norm = (f) => (/^[A-Z]+\/USD$/.test(f) ? "Crypto." + f : f);
const g = new Map();
for (const l of lines) {
  if (!l.feed || l.publish === undefined) continue;
  const tSeen = l.t / 1000; if (tSeen < FROM || tSeen > TO) continue;
  const k = `${l.prog ?? "old"}|${l.shard}|${norm(l.feed)}`;
  if (!g.has(k)) g.set(k, new Map());
  const m = g.get(k); if (!m.has(l.publish)) m.set(l.publish, { publish: l.publish, seen: tSeen, confBps: l.confBps });
}
const out = [];
for (const [k, key] of meta) {
  const ups = [...(g.get(k)?.values() ?? [])].sort((x, y) => x.publish - y.publish);
  const iv = ups.slice(1).map((u, i) => u.seen - ups[i].seen);
  const sorted = [...iv].sort((x, y) => x - y);
  const pct = (q) => sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]) : null;
  // gaps > 300 s while the logger was alive (including before first / after last update)
  const pts = [cover[0][0], ...ups.map(u => u.seen), cover.at(-1)[1]];
  const gaps = [];
  for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > 300) {
    // only the part where the logger was alive counts
    let aliveSecs = 0; for (let t = pts[i - 1]; t < pts[i]; t += 30) if (alive(t)) aliveSecs += 30;
    if (aliveSecs > 300) gaps.push([pts[i - 1], pts[i]]);
  }
  const dow = (t) => new Date(t * 1000).getUTCDay();
  const weekendUps = ups.filter(u => [0, 6].includes(dow(u.seen))).length;
  // freshness at 04:00 and 16:00 UTC: age of the newest publish at that instant
  const checks = [];
  for (let d = Math.floor(cover[0][0] / 86400) * 86400; d < cover.at(-1)[1]; d += 86400) for (const h of [4, 16]) {
    const T = d + h * 3600; if (!alive(T)) continue;
    const before = ups.filter(u => u.seen <= T).at(-1);
    const after = ups.find(u => u.publish >= T);
    checks.push({ at: new Date(T * 1000).toISOString().slice(0, 13), ageAtT: before ? Math.round(T - before.publish) : null, firstAfter: after ? Math.round(after.publish - T) : null });
  }
  out.push({ prog: key.prog, shard: key.shard, symbol: key.symbol, assetType: key.assetType, schedule: key.schedule, key: key.key, id: key.id,
    level: key.level, updates: ups.length, p50: pct(0.5), p90: pct(0.9), max: pct(1), weekendUps,
    lastPublish: ups.at(-1)?.publish ?? key.publish, confMedian: ups.length ? [...ups.map(u => u.confBps)].sort((x, y) => x - y)[Math.floor(ups.length / 2)] : key.confBps,
    gaps: gaps.map(([x, y]) => `${new Date(x * 1000).toISOString().slice(5, 16)}→${new Date(y * 1000).toISOString().slice(5, 16)} (${Math.round((y - x) / 60)} min)`), checks });
}
writeFileSync(process.env.OUT ?? "feeds_result.json", JSON.stringify({ cover, coveredHours: coveredSecs / 3600, feeds: out }, null, 1));
const live = out.filter(f => f.updates > 0);
console.log(`covered ${(coveredSecs / 60).toFixed(0)} min in ${cover.length} segment(s); accounts ${out.length}, with updates ${live.length}`);
for (const f of live.sort((x, y) => (x.prog + x.symbol).localeCompare(y.prog + y.symbol)))
  console.log(`${f.prog} s${f.shard} ${f.symbol.padEnd(26)} n=${String(f.updates).padStart(4)} p50=${f.p50} p90=${f.p90} max=${f.max} conf~${f.confMedian} gaps=${f.gaps.length}`);