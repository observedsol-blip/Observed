// Enumerate push-oracle feed accounts: derive the PDA for every Hermes feed id on shards 0..3,
// read them in batches of 100, keep the ones that exist.
import { readFileSync, writeFileSync } from "node:fs";
import { decode, web3 } from "./lib.mjs";
const PROGRAM = new web3.PublicKey(process.env.PROGRAM ?? "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT");
const OUTFILE = process.env.OUTFILE ?? "sponsored.json";
function feedAccount(idHex, shard) { const b = Buffer.alloc(2); b.writeUInt16LE(shard); return web3.PublicKey.findProgramAddressSync([b, Buffer.from(idHex, "hex")], PROGRAM)[0]; }
const c = new web3.Connection(process.env.RPC ?? "https://api.mainnet-beta.solana.com", "confirmed");
const feeds = JSON.parse(readFileSync("price_feeds.json", "utf8"));
const cand = [];
for (const f of feeds) for (const shard of [0, 1, 2, 3]) cand.push({ f, shard, key: feedAccount(f.id, shard) });
const found = [];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < cand.length; i += 100) {
  const batch = cand.slice(i, i + 100);
  let infos;
  for (let a = 0; ; a++) { try { infos = await c.getMultipleAccountsInfo(batch.map(b => b.key)); break; } catch (e) { if (a > 5) throw e; await sleep(2000 * (a + 1)); } }
  infos.forEach((info, j) => {
    if (!info) return;
    const b = batch[j]; const m = decode(info.data);
    found.push({ key: b.key.toBase58(), shard: b.shard, id: b.f.id, symbol: b.f.attributes.symbol, assetType: b.f.attributes.asset_type,
      schedule: b.f.attributes.schedule ?? "", owner: info.owner.toBase58(), ownerOk: true, program: PROGRAM.toBase58(), level: m.level, feedOk: m.feed === b.f.id,
      publish: m.publish, confBps: m.confBps });
  });
  await sleep(250);
}
writeFileSync(OUTFILE, JSON.stringify(found, null, 1));
const now = Date.now() / 1000;
console.log(`feeds ${feeds.length}, candidates ${cand.length}, existing ${found.length}`);
for (const s of [0, 1, 2, 3]) console.log(`shard ${s}: ${found.filter(x => x.shard === s).length}`);
const byType = {}; for (const x of found.filter(x => x.shard === 0)) byType[x.assetType] = (byType[x.assetType] ?? 0) + 1; console.log(byType);
console.log("owners", [...new Set(found.map(x => x.owner))]); for (const x of found.filter(x => now - x.publish < 3600)) console.log(x.shard, x.symbol.padEnd(28), x.assetType.padEnd(10), "age", Math.round(now - x.publish), "conf", x.confBps, x.level, x.ownerOk && x.feedOk ? "ok" : "MISMATCH");