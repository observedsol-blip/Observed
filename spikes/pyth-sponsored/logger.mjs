// Spike 4 logger: polls the sponsored Pyth push-feed accounts every 5 s (shards 0 and 1) and
// additionally subscribes to every account write over websocket. Append-only JSONL, one line per
// observed state change, plus a poll heartbeat every minute. Survives RPC errors.
import { appendFileSync, readFileSync } from "node:fs";
import { FEEDS, feedAccount, decode, web3 } from "./lib.mjs";
const { Connection } = web3;
const RPC = process.env.RPC ?? "https://api.mainnet-beta.solana.com";
const c = new Connection(RPC, { commitment: "confirmed", wsEndpoint: RPC.replace("https", "wss") });
const OUT = process.env.OUT ?? "log.jsonl";
const accts = [];
for (const shard of [0, 1]) for (const f of FEEDS) accts.push({ shard, name: f.name, key: feedAccount(f.id, shard), ws: true });
// 18.09.: every push-oracle account found by enumerate.mjs (all Hermes feed ids, shards 0-3), polled only
const have = new Set(accts.map(a => a.key.toBase58()));
for (const [file, prog] of [["sponsored.json", "old"], ["sponsored_upgraded.json", "new"]]) for (const x of JSON.parse(readFileSync(file, "utf8"))) {
  if (have.has(x.key)) continue;
  accts.push({ shard: x.shard, name: x.symbol, key: new web3.PublicKey(x.key), ws: false, prog });
}
const last = new Map();
const write = (o) => appendFileSync(OUT, JSON.stringify(o) + "\n");
function seen(a, data, src, slot) {
  const m = decode(data);
  const k = a.key.toBase58();
  if (last.get(k) === m.publish) return;
  last.set(k, m.publish);
  write({ t: Date.now(), src, slot, prog: a.prog ?? "old", shard: a.shard, feed: a.name, publish: m.publish, prev: m.prev, price: m.price, conf: m.conf, expo: m.expo, confBps: m.confBps, postedSlot: m.postedSlot, level: m.level });
}
let polls = 0, errors = 0;
async function poll() {
  try {
    for (let b = 0; b < accts.length; b += 100) {
      const part = accts.slice(b, b + 100);
      const r = await c.getMultipleAccountsInfoAndContext(part.map(a => a.key));
      r.value.forEach((info, i) => info && seen(part[i], info.data, "poll", r.context.slot));
    }
    polls++;
  } catch (e) { errors++; write({ t: Date.now(), err: String(e).slice(0, 200) }); }
}
function subscribe() {
  for (const a of accts.filter(a => a.ws)) {
    try { c.onAccountChange(a.key, (info, ctx) => seen(a, info.data, "ws", ctx.slot), { commitment: "confirmed" }); }
    catch (e) { write({ t: Date.now(), err: "ws " + String(e).slice(0, 200) }); }
  }
}
write({ t: Date.now(), start: true, rpc: RPC.replace(/api-key=[^&]+/, "api-key=***"), accounts: accts.map(a => ({ shard: a.shard, feed: a.name, key: a.key.toBase58() })) });
subscribe();
setInterval(poll, 5000); poll();
setInterval(() => { write({ t: Date.now(), hb: true, polls, errors }); }, 60000);
const END = Date.UTC(2026, 8, 21, 6, 0); // Mon 21.09. 06:00 UTC: covers Sun 16:00 and the Monday 04:00 reopen
setInterval(() => { if (Date.now() > END) { write({ t: Date.now(), end: true, polls, errors }); process.exit(0); } }, 30000);