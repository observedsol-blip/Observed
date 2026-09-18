import { readFileSync } from "node:fs";
const up = JSON.parse(readFileSync("sponsored_upgraded.json", "utf8"));
const rpc = "https://api.mainnet-beta.solana.com";
const call = async (method, params) => (await (await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
for (const sym of ["Crypto.SOL/USD", "Crypto.BTC/USD", "Crypto.ETH/USD"]) {
  const a = up.find(x => x.symbol === sym && x.shard === 0);
  const sigs = await call("getSignaturesForAddress", [a.key, { limit: 40 }]);
  const payers = {};
  for (const s of sigs.filter((_, i) => i % 4 === 0)) {
    await sleep(600);
    const tx = await call("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 1 }]);
    const k = tx?.transaction?.message?.accountKeys?.[0] ?? "?"; payers[k] = (payers[k] ?? 0) + 1;
  }
  const times = sigs.map(s => s.blockTime).filter(Boolean);
  console.log(sym, a.key, "last 40 tx span", times[0] - times.at(-1), "s; payers (sample of 10):", JSON.stringify(payers));
  await sleep(1000);
}