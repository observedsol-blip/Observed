import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const web3 = require("/home/observed/observed-resolver/node_modules/@solana/web3.js");
const { PublicKey } = web3;
export const PUSH_ORACLE = new PublicKey("pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT");
export const RECEIVER = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
export const FEEDS = [
  { name: "SOL/USD", id: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" },
  { name: "BTC/USD", id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
  { name: "ETH/USD", id: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
];
export function feedAccount(idHex, shard = 0) {
  const s = Buffer.alloc(2); s.writeUInt16LE(shard);
  return PublicKey.findProgramAddressSync([s, Buffer.from(idHex, "hex")], PUSH_ORACLE)[0];
}
export function decode(d) {
  let o = 8; const writeAuth = new PublicKey(d.subarray(o, o + 32)).toBase58(); o += 32;
  const tag = d[o]; let level; if (tag === 0) { level = `Partial(${d[o + 1]})`; o += 2; } else { level = "Full"; o += 1; }
  const feed = d.subarray(o, o + 32).toString("hex"); o += 32;
  const price = d.readBigInt64LE(o); o += 8; const conf = d.readBigUInt64LE(o); o += 8;
  const expo = d.readInt32LE(o); o += 4; const publish = Number(d.readBigInt64LE(o)); o += 8;
  const prev = Number(d.readBigInt64LE(o)); o += 8; o += 16; const postedSlot = Number(d.readBigUInt64LE(o));
  const confBps = Number((conf * 10000n * 1000n) / (price < 0n ? -price : price)) / 1000;
  return { writeAuth, level, feed, price: price.toString(), conf: conf.toString(), expo, publish, prev, postedSlot, confBps };
}
