#!/usr/bin/env node
// Two rounds on a local validator, so the app can do the thing it does every evening: reveal
// yesterday and seal today in ONE transaction.
//
// Same idea as prepare.mjs (real mainnet bytes, publish_time moved into the window), but with a
// compressed two-round timeline and the current terms (close_after_secs, earliest_close_unix).
//
//   node prepare-app.mjs <out-dir> <player-pubkey> <sol-feed.json from `solana account -u m`>
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [outDir, playerPubkey, feedFile] = process.argv.slice(2);
if (!outDir || !playerPubkey || !feedFile) throw new Error("usage: prepare-app.mjs <out-dir> <player-pubkey> <feed-json>");

const REPO = join(import.meta.dirname, "..", "..");
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58decode = (s) => {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
  const out = Buffer.from(n.toString(16).padStart(64, "0"), "hex");
  if (out.length !== 32) throw new Error(`not a key: ${s}`);
  return out;
};

// ---- schedule --------------------------------------------------------------
// Constraints: reference_time − A > commit_close, reference_time + W < outcome_time, and the
// one frozen reading must be within A of both submissions.
const t0 = Math.floor(Date.now() / 1000);
const WINDOW = 60;
const MAX_AGE = 120;
const round0 = {
  commitOpen: t0 - 60,
  commitClose: t0 + 90, // validator start, deploy, setup, seal
};
round0.referenceTime = round0.commitClose + MAX_AGE + 1;
round0.outcomeTime = round0.referenceTime + WINDOW + 1;
// The evening transaction happens after round 0's outcome, while round 1 is open for sealing.
const round1 = {
  commitOpen: round0.outcomeTime - 30,
  commitClose: round0.outcomeTime + 600,
};
round1.referenceTime = round1.commitClose + MAX_AGE + 1;
round1.outcomeTime = round1.referenceTime + WINDOW + 1;
const publishTime = round0.outcomeTime - MAX_AGE + 8; // inside A of both of round 0's readings

// ---- accounts --------------------------------------------------------------
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
b58decode(playerPubkey).copy(token.data, 32);
accounts.push(toValidatorAccount(token.pubkey, token.owner, token.lamports, token.data));

const feed = JSON.parse(readFileSync(feedFile, "utf8"));
const feedData = Buffer.from(feed.account.data[0], "base64");
const PUBLISH_AT = 93;
feedData.writeBigInt64LE(BigInt(publishTime), PUBLISH_AT);
feedData.writeBigInt64LE(BigInt(publishTime - 1), PUBLISH_AT + 8);
accounts.push(toValidatorAccount(feed.pubkey, feed.account.owner, feed.account.lamports, feedData));
for (const a of accounts) writeFileSync(join(outDir, `${a.pubkey}.json`), `${JSON.stringify(a, null, 1)}\n`);

// ---- terms, hashes, calendar ----------------------------------------------
const sha256 = (...parts) => createHash("sha256").update(Buffer.concat(parts)).digest();
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };

const SEASON = 1;
const CLOSE_AFTER_SECS = 30 * 24 * 3600;
const EARLIEST_CLOSE_UNIX = t0 + 60 * 86_400;
const termsFor = (roundId, times, kind, offsetBps) => ({
  season: SEASON,
  roundId,
  version: 3,
  kind,
  sourceKind: 1,
  feedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  priceAccount: feed.pubkey,
  offsetBps,
  maxConfBps: 5000, // the frozen reading is minutes old; confidence must not gate the run
  bandBps: 25,
  windowSecs: WINDOW,
  maxAgeSecs: MAX_AGE,
  closeAfterSecs: CLOSE_AFTER_SECS,
  earliestCloseUnix: EARLIEST_CLOSE_UNIX,
  ...times,
});
const termsHash = (t) =>
  sha256(
    Buffer.from("observed/terms/v3", "utf8"),
    u16(t.season), u32(t.roundId),
    Buffer.from([t.version, t.kind, t.sourceKind]),
    Buffer.from(t.feedId, "hex"),
    b58decode(t.priceAccount),
    i32(t.offsetBps), u16(t.maxConfBps), u16(t.bandBps), u16(t.windowSecs), u16(t.maxAgeSecs),
    u32(t.closeAfterSecs), i64(t.earliestCloseUnix),
    i64(t.commitOpen), i64(t.commitClose), i64(t.referenceTime), i64(t.outcomeTime),
  );

// round 0 is a direction call (threshold 0), round 1 a movement call — both kinds in one run
const terms = [termsFor(0, round0, 0, 0), termsFor(1, round1, 1, 200)];
const hashes = terms.map(termsHash);

const emptyLeaf = sha256(Buffer.from([0]), Buffer.alloc(32));
const leaves = Array.from({ length: 64 }, (_, i) => (i < hashes.length ? sha256(Buffer.from([0]), hashes[i]) : emptyLeaf));
const levels = [leaves];
while (levels[levels.length - 1].length > 1) {
  const prev = levels[levels.length - 1];
  const next = [];
  for (let i = 0; i < prev.length; i += 2) next.push(sha256(Buffer.from([1]), prev[i], prev[i + 1]));
  levels.push(next);
}
const proofFor = (index) => {
  const proof = [];
  let idx = index;
  for (let l = 0; l < levels.length - 1; l++) {
    proof.push(levels[l][idx ^ 1].toString("hex"));
    idx >>= 1;
  }
  return proof;
};

const plan = {
  season: SEASON,
  gameId: "1",
  merkleRoot: levels[levels.length - 1][0].toString("hex"),
  publishTime,
  sgtMint: accounts[1].pubkey,
  sgtToken: token.pubkey,
  player: playerPubkey,
  accounts: accounts.map((a) => a.pubkey),
  rounds: terms.map((t, i) => ({
    ...t,
    termsHash: hashes[i].toString("hex"),
    proof: proofFor(i),
    // what the app's calendar module expects on top of the terms
    revealCloseUtc: new Date((t.outcomeTime + 72 * 3600) * 1000).toISOString(),
    feed: "SOL/USD",
    measuredDay: new Date(t.commitClose * 1000).toISOString().slice(0, 10),
    question: i === 0 ? "Will SOL be higher at the outcome than at the reference?" : "Will SOL move more than 2%?",
    context: null,
  })),
  timeline: {
    now: t0,
    sealBy: round0.commitClose,
    referenceAt: round0.referenceTime,
    outcomeAt: round0.outcomeTime,
    eveningAt: round0.outcomeTime + 5,
    secondsUntilReference: round0.referenceTime - t0,
    secondsUntilOutcome: round0.outcomeTime - t0,
  },
};
writeFileSync(join(outDir, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
console.log(`plan written: seal by +${round0.commitClose - t0}s, reference +${round0.referenceTime - t0}s, outcome +${round0.outcomeTime - t0}s`);
