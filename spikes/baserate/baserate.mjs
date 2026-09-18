// One-off: 04:00->16:00 UTC moves from Coinbase Exchange public hourly candles (no key).
const PRODUCTS = ["SOL-USD", "BTC-USD", "ETH-USD"];
const DAYS = Number(process.env.DAYS ?? 365);
const end = Math.floor(Date.UTC(2026, 8, 18) / 1000);
const start = end - DAYS * 86400;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const out = {};
for (const p of PRODUCTS) {
  const c = new Map(); let calls = 0;
  for (let s = start; s < end; s += 300 * 3600) {
    const e = Math.min(end, s + 300 * 3600);
    const url = `https://api.exchange.coinbase.com/products/${p}/candles?granularity=3600&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`;
    const r = await fetch(url, { headers: { "user-agent": "observed-spike" } }); calls++;
    if (!r.ok) { console.log(p, r.status, await r.text()); process.exit(1); }
    for (const [t, lo, hi, op, cl] of await r.json()) c.set(t, { op, cl });
    await sleep(350);
  }
  const moves = [];
  for (let d = Math.ceil(start / 86400) * 86400; d < end; d += 86400) {
    const a = c.get(d + 4 * 3600), b = c.get(d + 15 * 3600);
    if (!a || !b) continue;
    moves.push({ d, dow: new Date(d * 1000).getUTCDay(), m: Math.abs(b.cl / a.op - 1) * 100 });
  }
  out[p] = { calls, candles: c.size, days: moves.length, moves };
  const rate = (arr, x) => (arr.filter(v => v.m > x).length / arr.length * 100).toFixed(1);
  const wk = moves.filter(v => v.dow >= 1 && v.dow <= 5), we = moves.filter(v => v.dow === 0 || v.dow === 6);
  const med = [...moves.map(v => v.m)].sort((a, b) => a - b)[Math.floor(moves.length / 2)];
  console.log(`${p}: ${calls} requests, ${c.size} candles, ${moves.length} days; median |move| ${med.toFixed(2)} %`);
  for (const x of [1, 1.5, 2, 3, 4]) console.log(`  > ${x} %: all ${rate(moves, x)} %  (weekday ${rate(wk, x)} %, weekend ${rate(we, x)} %)`);
  // first vs second half: does a frozen rate drift?
  const h = Math.floor(moves.length / 2);
  console.log(`  > 2 % first half ${rate(moves.slice(0, h), 2)} %, second half ${rate(moves.slice(h), 2)} %; last 90 days ${rate(moves.slice(-90), 2)} %`);
}
(await import("node:fs")).writeFileSync("moves_0416.json", JSON.stringify(out));