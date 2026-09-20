#!/usr/bin/env node
// Builds the accounts and the schedule for one end-to-end round on a local validator.
//
// The validator has no Pyth sponsor, so the cloned mainnet account never updates. We therefore
// move its publish_time into the test window — the bytes are otherwise the real ones, signature
// fields included. Everything else (SGT mint, group, token account) comes from the repo fixtures,
// with the token account's owner set to the test player, exactly as the Rust tests do.
//
//   node prepare.mjs <out-dir> <player-pubkey> <sol-feed.json from `solana account -u m`>
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [outDir, playerPubkey, feedFile] = process.argv.slice(2);
if (!outDir || !playerPubkey || !feedFile) throw new Error("usage: prepare.mjs <out-dir> <player-pubkey> <feed-json>");

const REPO = join(import.meta.dirname, "..", "..");
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58decode = (s) => {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
  const out = Buffer.from(n.toString(16).padStart(64, "0"), "hex");
  if (out.length !== 32) throw new Error(`not a key: ${s}`);
  return out;
};

// ---- schedule -------------------------------------------------------------
// Constraints the program enforces (RoundTerms::validate):
//   reference_time − A > commit_close      (no reference can have been visible while sealing)
//   reference_time + W < outcome_time
// With a frozen price account both readings must also be within A of the same publish_time, so
// A is generous here (600 s) and the publish time sits after commit_close + W.
const t0 = Math.floor(Date.now() / 1000);
const WINDOW = 60;
const MAX_AGE = 300;
const commitOpen = t0 - 60;
const commitClose = t0 + 240; // room for validator start, deploy and the player's seal
const referenceTime = commitClose + MAX_AGE + 1;
const outcomeTime = referenceTime + WINDOW + 1;
const publishTime = commitClose + 90; // within A of both readings, and after sealing closed

// ---- accounts -------------------------------------------------------------
const toValidatorAccount = (pubkey, owner, lamports, data) => ({
  pubkey,
  account: { lamports, data: [data.toString("base64"), "base64"], owner, executable: false, rentEpoch: 0 },
});

const fixture = (name) => {
  const v = JSON.parse(readFileSync(join(REPO, "tests/fixtures", `${name}.json`), "utf8"));
  return { pubkey: v.pubkey, owner: v.owner, lamports: v.lamports, data: Buffer.from(v.data_base64, "base64") };
};

const accounts = [];
for (const name of ["sgt/sgt-group", "sgt/sgt-mint"]) {
  const f = fixture(name);
  accounts.push(toValidatorAccount(f.pubkey, f.owner, f.lamports, f.data));
}
const token = fixture("sgt/sgt-token-account");
b58decode(playerPubkey).copy(token.data, 32); // SPL token account: owner at bytes 32..64
accounts.push(toValidatorAccount(token.pubkey, token.owner, token.lamports, token.data));

// the cloned sponsored account, with its publish time moved into the test window
const feed = JSON.parse(readFileSync(feedFile, "utf8"));
const feedData = Buffer.from(feed.account.data[0], "base64");
const PUBLISH_AT = 93; // 8 disc + 32 write_authority + 1 Full + 32 feed_id + 8 price + 8 conf + 4 expo
feedData.writeBigInt64LE(BigInt(publishTime), PUBLISH_AT);
feedData.writeBigInt64LE(BigInt(publishTime - 1), PUBLISH_AT + 8);
accounts.push(toValidatorAccount(feed.pubkey, feed.account.owner, feed.account.lamports, feedData));

for (const a of accounts) writeFileSync(join(outDir, `${a.pubkey}.json`), `${JSON.stringify(a, null, 1)}\n`);

// ---- terms and calendar ---------------------------------------------------
const sha256 = (...parts) => createHash("sha256").update(Buffer.concat(parts)).digest();
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };

const SEASON = 1;
const terms = {
  version: 3,
  kind: 1, // MOVE
  sourceKind: 1,
  feedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  priceAccount: feed.pubkey,
  offsetBps: 200,
  maxConfBps: 5000, // the frozen reading is minutes old; its confidence must not gate the spike
  bandBps: 25,
  windowSecs: WINDOW,
  maxAgeSecs: MAX_AGE,
  commitOpen,
  commitClose,
  referenceTime,
  outcomeTime,
};
const termsHash = sha256(
  Buffer.from("observed/terms/v3", "utf8"),
  u16(SEASON), u32(0),
  Buffer.from([terms.version, terms.kind, terms.sourceKind]),
  Buffer.from(terms.feedId, "hex"),
  b58decode(terms.priceAccount),
  i32(terms.offsetBps), u16(terms.maxConfBps), u16(terms.bandBps), u16(terms.windowSecs), u16(terms.maxAgeSecs),
  i64(terms.commitOpen), i64(terms.commitClose), i64(terms.referenceTime), i64(terms.outcomeTime),
);

// 64 leaves, only the first is used — same shape as a real season
const emptyLeaf = sha256(Buffer.from([0]), Buffer.alloc(32));
let level = Array.from({ length: 64 }, (_, i) => (i === 0 ? sha256(Buffer.from([0]), termsHash) : emptyLeaf));
const proof = [];
let idx = 0;
while (level.length > 1) {
  proof.push(level[idx ^ 1].toString("hex"));
  const next = [];
  for (let i = 0; i < level.length; i += 2) next.push(sha256(Buffer.from([1]), level[i], level[i + 1]));
  level = next;
  idx >>= 1;
}

const plan = {
  season: SEASON,
  gameId: "1",
  terms,
  termsHash: termsHash.toString("hex"),
  merkleRoot: level[0].toString("hex"),
  proof,
  publishTime,
  accounts: accounts.map((a) => a.pubkey),
  sgtMint: accounts[1].pubkey,
  sgtToken: token.pubkey,
  player: playerPubkey,
  timeline: {
    now: t0,
    commitClose,
    referenceTime,
    outcomeTime,
    secondsUntilReference: referenceTime - t0,
    secondsUntilOutcome: outcomeTime - t0,
  },
};
writeFileSync(join(outDir, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify(plan.timeline));
console.log(`root ${plan.merkleRoot}`);
console.log(`accounts: ${plan.accounts.join(" ")}`);
