// Can an outsider rebuild the history of a sponsored account from the ledger alone?
// Take recent txs touching new-stack SOL/USD, find the push-oracle instruction, and look for publish_time bytes.
import { readFileSync } from "node:fs";
import { web3 } from "./lib.mjs";
const rpc = "https://api.mainnet-beta.solana.com";
const call = async (m, p) => { for (let a = 0; a < 6; a++) { const j = await (await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) })).json(); if (j.result !== undefined) return j.result; await new Promise(r => setTimeout(r, 1500 * (a + 1))); } return null; };
const ACC = "7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE", PUSH = "pyt2F414BA6dPttK6RddPZUdHfapoBN24GL5wbrPCou";
const bs58 = (s) => Buffer.from(web3.PublicKey.decode ? [] : []); // unused
const sigs = await call("getSignaturesForAddress", [ACC, { limit: 25 }]);
let upd = 0, other = 0;
for (const s of sigs) {
  await new Promise(r => setTimeout(r, 500));
  const tx = await call("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 1 }]);
  if (!tx) continue;
  const keys = [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const ixs = [...tx.transaction.message.instructions, ...(tx.meta.innerInstructions ?? []).flatMap(i => i.instructions)];
  const push = ixs.filter(ix => keys[ix.programIdIndex] === PUSH);
  if (!push.length) { other++; continue; }
  upd++;
  const logs = tx.meta.logMessages.filter(l => /Program log|Program data/.test(l)).slice(0, 3);
  const data = Buffer.from(web3.PublicKey ? require_bs58(push[0].data) : []);
  // publish_time is close to blockTime: scan the ix data for an i64 within ±120 s of blockTime
  const hits = [];
  for (let o = 0; o + 8 <= data.length; o++) { const v = Number(data.readBigInt64BE(o)); if (Math.abs(v - tx.blockTime) < 120) hits.push([o, v]); }
  const acct = tx.meta.postTokenBalances; if (upd <= 3) console.log(`update tx slot ${tx.slot} blockTime ${tx.blockTime}: push ix data ${data.length} B, publish_time-like i64 at ${JSON.stringify(hits.slice(0, 3))}; writable ACC? ${keys.indexOf(ACC) >= 0}; logs ${JSON.stringify(logs).slice(0, 160)}`);
}
console.log(`of ${sigs.length} txs touching the account: ${upd} push-oracle updates, ${other} other (readers)`);
function require_bs58(s) { const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; let n = 0n; for (const c of s) n = n * 58n + BigInt(A.indexOf(c)); let h = n.toString(16); if (h.length % 2) h = "0" + h; let b = n === 0n ? [] : [...Buffer.from(h, "hex")]; for (const c of s) { if (c === "1") b.unshift(0); else break; } return b; }