#!/usr/bin/env node
/**
 * Verify a round yourself.
 *
 * Checks one round of Observed against the chain, without trusting the app, the resolver or this
 * repository. Everything it needs is public: the account bytes and a handful of hashes.
 *
 *   node scripts/verify-round.mjs --round 11
 *   node scripts/verify-round.mjs --round 11 --rpc https://your-endpoint
 *   node scripts/verify-round.mjs --round 11 --deep          # every revealed answer, not a sample
 *
 * A call number is enough: the RPC defaults to the public mainnet endpoint and the calendar to
 * the one in this repository. Nothing is written, nothing is signed, no key is read.
 *
 * What it proves, in order:
 *   1. The round on chain is the one the owner published before the season started
 *      (terms hash recomputed, Merkle proof checked against the root in the config account).
 *   2. The reference price could not have been seen by anyone who sealed
 *      (publish_time ≥ commit_close, and the reading is at most `max_age_secs` old).
 *      Both readings come from the price account named in the terms.
 *   3. The outcome follows from the two readings — recomputed here, exactly, without rounding.
 *   4. Every revealed entry opens its own commitment.
 *   5. Every shared sentence was fixed before the outcome existed.
 *
 * Exit code 0 means every check passed. Anything else is a finding, and the line says which.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..");

// ---- arguments -------------------------------------------------------------
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const ROUND_ID = Number(arg("round", "0"));
const RPC = arg("rpc", "https://api.mainnet-beta.solana.com");
const CALENDAR = arg("calendar", join(REPO, "tests/fixtures/calendar/season1.json"));
const PROGRAM_ID = arg("program", "48YybyMgkdzPQN5R3V1xsFHkUMxDvBDBDwW48cRTx2ni");
const GAME_ID = BigInt(arg("game", "1"));
/** How many revealed answers to open. `--deep` means all of them. */
const DEEP = process.argv.includes("--deep");
const SAMPLE = Number(arg("sample", "20"));

// ---- tiny helpers: base58, hashes, little-endian ---------------------------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s) {
  let n = 0n;
  for (const c of s) {
    const v = B58.indexOf(c);
    if (v < 0) throw new Error(`not base58: ${s}`);
    n = n * 58n + BigInt(v);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let bytes = Buffer.from(hex, "hex");
  for (const c of s) {
    if (c !== "1") break;
    bytes = Buffer.concat([Buffer.from([0]), bytes]);
  }
  return bytes;
}
function b58encode(buf) {
  let n = BigInt(`0x${Buffer.from(buf).toString("hex")}`);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}
const sha256 = (...parts) => createHash("sha256").update(Buffer.concat(parts)).digest();
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };

// ---- PDAs ------------------------------------------------------------------
// Derived with Solana's own library, not with hand-written curve maths. The first version did
// the ed25519 check by hand and produced a wrong address — for a script whose whole point is
// that you do not have to trust us, borrowing the official derivation is the honest choice.
// Every hash and every rule below is still computed here, in the open.
import { createRequire } from "node:module";
const require = createRequire(join(REPO, "app", "package.json"));
const { PublicKey } = require("@solana/web3.js");

const findPda = (seeds, programId) => {
  const [address, bump] = PublicKey.findProgramAddressSync(seeds, new PublicKey(programId));
  return { address: address.toBase58(), bump };
};

// ---- RPC -------------------------------------------------------------------
let rpcCalls = 0;
async function rpc(method, params) {
  rpcCalls += 1;
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcCalls, method, params }),
  });
  const json = await response.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}
/** Several calls in one HTTP request — walking a call's history would be 140 round trips else. */
async function rpcBatch(method, paramsList) {
  if (paramsList.length === 0) return [];
  rpcCalls += 1;
  const body = paramsList.map((params, i) => ({ jsonrpc: "2.0", id: i, method, params }));
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!Array.isArray(json)) throw new Error(`${method}: the endpoint refused a batch request`);
  return json.sort((a, b) => a.id - b.id).map((x) => x.result ?? null);
}

async function accountData(address) {
  const result = await rpc("getAccountInfo", [address, { encoding: "base64", commitment: "confirmed" }]);
  if (!result?.value) return null;
  return Buffer.from(result.value.data[0], "base64");
}

// ---- layouts (programs/observed/src/lib.rs) --------------------------------
const CONFIG = { calendarRoot: 88 };
const ROUND = {
  roundId: 8, termsHash: 12, version: 44, kind: 45, sourceKind: 46, feedId: 47, priceAccount: 79,
  offsetBps: 111, maxConfBps: 115, bandBps: 117, windowSecs: 119, maxAgeSecs: 121,
  closeAfterSecs: 123, earliestCloseUnix: 127, commitOpen: 135, commitClose: 143,
  referenceTime: 151, outcomeTime: 159, revealClose: 167, resolveDeadline: 175,
  status: 183, outcome: 184, reference: 185, evidence: 269, outcomeMarginBps: 369,
  commitCount: 373, revealCount: 377, size: 498,
};
const READING = { price: 0, conf: 8, expo: 16, publishTime: 20, postedSlot: 28, submittedSlot: 36, submittedAt: 44, submitter: 52 };
const ENTRY = { round: 8, sgtMint: 40, beneficiary: 72, commitment: 136, committedAt: 168, revealed: 176, pBps: 177, scored: 179, scoredAsMissing: 180, scoreBps: 181, size: 184 };

const readReading = (buf, at) => ({
  price: buf.readBigInt64LE(at + READING.price),
  conf: buf.readBigUInt64LE(at + READING.conf),
  expo: buf.readInt32LE(at + READING.expo),
  publishTime: Number(buf.readBigInt64LE(at + READING.publishTime)),
  postedSlot: Number(buf.readBigUInt64LE(at + READING.postedSlot)),
  submittedSlot: Number(buf.readBigUInt64LE(at + READING.submittedSlot)),
  submittedAt: Number(buf.readBigInt64LE(at + READING.submittedAt)),
  submitter: b58encode(buf.subarray(at + READING.submitter, at + READING.submitter + 32)),
});

// ---- checks ----------------------------------------------------------------
let failures = 0;
const ok = (line) => console.log(`  ok    ${line}`);
const bad = (line) => {
  failures += 1;
  console.log(`  FAIL  ${line}`);
};
const check = (condition, line) => (condition ? ok(line) : bad(line));

const config = findPda([Buffer.from("config", "utf8"), u64(GAME_ID)], PROGRAM_ID).address;
const round = findPda(
  [Buffer.from("round", "utf8"), b58decode(config), u32(ROUND_ID)],
  PROGRAM_ID,
).address;

console.log(`Observed — verifying call ${ROUND_ID}`);
console.log(`  program ${PROGRAM_ID}`);
console.log(`  config  ${config}`);
console.log(`  round   ${round}`);
console.log(`  rpc     ${RPC}\n`);

const configData = await accountData(config);
if (!configData) throw new Error("no config account — wrong program id, game id or cluster?");
const roundData = await accountData(round);
if (!roundData) throw new Error(`no account for call ${ROUND_ID}`);
if (roundData.length !== ROUND.size) throw new Error(`round is ${roundData.length} bytes, expected ${ROUND.size}`);

const r = {
  roundId: roundData.readUInt32LE(ROUND.roundId),
  termsHash: roundData.subarray(ROUND.termsHash, ROUND.termsHash + 32),
  version: roundData[ROUND.version],
  kind: roundData[ROUND.kind],
  sourceKind: roundData[ROUND.sourceKind],
  feedId: roundData.subarray(ROUND.feedId, ROUND.feedId + 32),
  priceAccount: b58encode(roundData.subarray(ROUND.priceAccount, ROUND.priceAccount + 32)),
  offsetBps: roundData.readInt32LE(ROUND.offsetBps),
  maxConfBps: roundData.readUInt16LE(ROUND.maxConfBps),
  bandBps: roundData.readUInt16LE(ROUND.bandBps),
  windowSecs: roundData.readUInt16LE(ROUND.windowSecs),
  maxAgeSecs: roundData.readUInt16LE(ROUND.maxAgeSecs),
  closeAfterSecs: roundData.readUInt32LE(ROUND.closeAfterSecs),
  earliestCloseUnix: Number(roundData.readBigInt64LE(ROUND.earliestCloseUnix)),
  commitOpen: Number(roundData.readBigInt64LE(ROUND.commitOpen)),
  commitClose: Number(roundData.readBigInt64LE(ROUND.commitClose)),
  referenceTime: Number(roundData.readBigInt64LE(ROUND.referenceTime)),
  outcomeTime: Number(roundData.readBigInt64LE(ROUND.outcomeTime)),
  revealClose: Number(roundData.readBigInt64LE(ROUND.revealClose)),
  status: roundData[ROUND.status],
  outcome: roundData[ROUND.outcome],
  reference: readReading(roundData, ROUND.reference),
  evidence: readReading(roundData, ROUND.evidence),
  marginBps: roundData.readInt32LE(ROUND.outcomeMarginBps),
  commitCount: roundData.readUInt32LE(ROUND.commitCount),
  revealCount: roundData.readUInt32LE(ROUND.revealCount),
};
const STATUS = ["Open", "Closed", "Referenced", "Resolved", "Cancelled"][r.status] ?? r.status;
const OUTCOME = ["Unset", "Yes", "No"][r.outcome] ?? r.outcome;

// ---- 1. the call is the one that was published in advance -------------------
console.log("1. the question was fixed before the season started");
const termsHash = sha256(
  Buffer.from("observed/terms/v3", "utf8"),
  u16(1), u32(r.roundId),
  Buffer.from([r.version, r.kind, r.sourceKind]),
  r.feedId,
  b58decode(r.priceAccount),
  i32(r.offsetBps), u16(r.maxConfBps), u16(r.bandBps), u16(r.windowSecs), u16(r.maxAgeSecs),
  u32(r.closeAfterSecs), i64(r.earliestCloseUnix),
  i64(r.commitOpen), i64(r.commitClose), i64(r.referenceTime), i64(r.outcomeTime),
);
check(termsHash.equals(r.termsHash), `terms hash recomputed from the account: ${termsHash.toString("hex").slice(0, 16)}…`);

const root = configData.subarray(CONFIG.calendarRoot, CONFIG.calendarRoot + 32);
let calendar = null;
try {
  calendar = JSON.parse(readFileSync(CALENDAR, "utf8"));
} catch {
  console.log("  note  no calendar file — the Merkle proof is skipped (pass --calendar)");
}
if (calendar) {
  const leaf = calendar.rounds.find((x) => x.roundId === r.roundId);
  if (!leaf) bad(`the calendar file has no call ${r.roundId}`);
  else {
    check(leaf.termsHash === termsHash.toString("hex"), "the calendar file names the same terms");
    let node = sha256(Buffer.from([0]), termsHash);
    let index = r.roundId;
    for (const sibling of leaf.proof) {
      const other = Buffer.from(sibling, "hex");
      node = index % 2 === 0
        ? sha256(Buffer.from([1]), node, other)
        : sha256(Buffer.from([1]), other, node);
      index = Math.floor(index / 2);
    }
    check(node.equals(root), `the proof leads to the root on chain: ${root.toString("hex").slice(0, 16)}…`);
  }
}

// ---- 2. nobody who sealed could have seen the reference ---------------------
console.log("\n2. the reference was taken after sealing closed");
// A call that has not been read yet carries zeroed readings. Checking them would report three
// failures for a call that is simply still open — the wrong signal from a tool whose job is to
// say whether something is wrong (found in the end-to-end run, 22.09.2026).
if (r.status === 4) {
  console.log("  note  this call was cancelled (NO_RESOLVE) — nothing was scored");
} else if (r.status === 0) {
  const closes = new Date(r.commitClose * 1000).toISOString().replace(".000Z", "Z");
  console.log(`  note  no reference yet — this call is still Open, sealing closes ${closes}`);
} else {
  check(r.reference.publishTime >= r.commitClose,
    `reference published ${r.reference.publishTime - r.commitClose}s after sealing closed`);
  check(r.reference.submittedAt >= r.referenceTime && r.reference.submittedAt <= r.referenceTime + r.windowSecs,
    `submitted ${r.reference.submittedAt - r.referenceTime}s into the ${r.windowSecs}s window`);
  check(r.reference.submittedAt - r.reference.publishTime <= r.maxAgeSecs,
    `the reading was ${r.reference.submittedAt - r.reference.publishTime}s old when it was submitted (limit ${r.maxAgeSecs}s)`);
  if (r.status === 3) {
    check(r.evidence.submittedAt >= r.outcomeTime && r.evidence.submittedAt <= r.outcomeTime + r.windowSecs,
      `the outcome reading landed ${r.evidence.submittedAt - r.outcomeTime}s into its window`);
  } else {
    console.log("  note  no outcome reading yet — this call has its reference and waits for 16:00");
  }
  const confBps = (r.reference.conf * 10_000n) / (r.reference.price > 0n ? r.reference.price : 1n);
  check(confBps <= BigInt(r.maxConfBps), `reference confidence ${confBps} bps (limit ${r.maxConfBps})`);
  console.log(`  note  both readings come from ${r.priceAccount}`);
  const readings = r.status === 3
    ? [["reference", r.reference], ["outcome", r.evidence]]
    : [["reference", r.reference]];
  for (const [name, reading] of readings) {
    const when = new Date(reading.publishTime * 1000).toISOString().replace(".000Z", "Z");
    console.log(
      `  note  ${name}: price ${reading.price} × 10^${reading.expo} ± ${reading.conf}` +
        `, publish_time ${when} (${reading.publishTime})`,
    );
    console.log(
      `        posted in slot ${reading.postedSlot}, submitted in slot ${reading.submittedSlot}` +
        ` by ${reading.submitter}`,
    );
  }
}

// ---- 3. the outcome follows from the two readings ---------------------------
console.log("\n3. the outcome follows from the numbers");
if (r.status === 3) {
  const expo = Math.min(r.reference.expo, r.evidence.expo);
  const scale = (value, from) => value * 10n ** BigInt(from - expo);
  const reference = scale(r.reference.price, r.reference.expo);
  const outcomePrice = scale(r.evidence.price, r.evidence.expo);
  const x = BigInt(r.offsetBps);
  const lhs = outcomePrice * 10_000n;
  const up = reference * (10_000n + x);
  const yes = r.kind === 0 ? lhs > up : lhs > up || lhs < reference * (10_000n - x);
  check((yes ? 1 : 2) === r.outcome, `recomputed outcome: ${yes ? "Yes" : "No"}, on chain: ${OUTCOME}`);

  const moveBps = ((outcomePrice - reference) * 10_000n) / reference;
  const signed = r.kind === 1 ? (moveBps < 0n ? -moveBps : moveBps) : moveBps;
  check(Number(signed - x) === r.marginBps, `margin ${r.marginBps} bps recomputed`);
  const close = Math.abs(r.marginBps) <= r.bandBps;
  console.log(`  note  ${close ? "INSIDE" : "outside"} the ${r.bandBps} bps measurement band`);
  console.log(`  note  reference ${r.reference.price} · outcome ${r.evidence.price} (exponent ${expo})`);
} else {
  console.log(`  note  status is ${STATUS}, nothing to recompute`);
}

// ---- 4. every revealed answer opens its own seal ---------------------------
console.log("\n4. the revealed answers open their own seals");
const accounts = await rpc("getProgramAccounts", [
  PROGRAM_ID,
  {
    encoding: "base64",
    commitment: "confirmed",
    filters: [{ dataSize: ENTRY.size }, { memcmp: { offset: ENTRY.round, bytes: round } }],
  },
]);
const entries = new Map();
for (const a of accounts ?? []) {
  const data = Buffer.from(a.account.data[0], "base64");
  entries.set(a.pubkey, {
    pubkey: a.pubkey,
    sgtMint: data.subarray(ENTRY.sgtMint, ENTRY.sgtMint + 32),
    beneficiary: data.subarray(ENTRY.beneficiary, ENTRY.beneficiary + 32),
    commitment: data.subarray(ENTRY.commitment, ENTRY.commitment + 32),
    revealed: data[ENTRY.revealed] === 1,
    pBps: data.readUInt16LE(ENTRY.pBps),
  });
}
console.log(`  note  ${entries.size} entries on chain, ${r.commitCount} counted by the program, ${r.revealCount} revealed`);
check(entries.size === r.commitCount, "the number of entries matches the counter in the call");

// The salt of a revealed answer is public: it rides in the reveal transaction. So every seal can
// be opened here — sha256 over the same bytes the program hashes — without asking anyone.
const REVEAL_DISC = Buffer.from([9, 35, 59, 190, 167, 249, 76, 115]);
const COMMIT_DISC = Buffer.from([223, 140, 142, 165, 229, 208, 156, 74]);
const MEMO_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

// "confirmed", not the default: on a fresh chain the newest transactions are not finalised yet,
// and a verifier that quietly sees an empty history is worse than one that says so.
const signatures = await rpc("getSignaturesForAddress", [round, { limit: 1000, commitment: "confirmed" }]);
console.log(`  note  ${signatures.length} transactions touched this call`);
const wanted = DEEP ? signatures : signatures.slice(0, Math.max(SAMPLE * 2, 40));
const transactions = [];
for (let i = 0; i < wanted.length; i += 20) {
  const slice = wanted.slice(i, i + 20).map((x) => [
    x.signature,
    { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
  ]);
  transactions.push(...(await rpcBatch("getTransaction", slice)));
}

/** The reveals and the seal memos in this call's history, as far as we fetched. */
const reveals = [];
const sealMemos = new Map(); // payer -> the 64-hex memos in its commit transaction
for (const tx of transactions) {
  if (!tx || tx.meta?.err) continue; // a failed transaction proves nothing
  const message = tx.transaction.message;
  const payer = message.accountKeys[0]?.pubkey;
  const memos = [];
  let revealed = null;
  let committed = false;
  for (const ix of message.instructions) {
    if (ix.programId === MEMO_ID) {
      memos.push(typeof ix.parsed === "string" ? ix.parsed : Buffer.from(b58decode(ix.data)).toString("utf8"));
      continue;
    }
    if (ix.programId !== PROGRAM_ID || typeof ix.data !== "string") continue;
    const data = b58decode(ix.data);
    if (data.length >= 8 && data.subarray(0, 8).equals(COMMIT_DISC)) {
      if ((ix.accounts ?? []).includes(round)) committed = true;
      continue;
    }
    if (data.length >= 42 && data.subarray(0, 8).equals(REVEAL_DISC)) {
      const entry = (ix.accounts ?? [])[3];
      if (entries.has(entry)) {
        revealed = { entry, pBps: data.readUInt16LE(8), salt: data.subarray(10, 42) };
      }
    }
  }
  if (committed) {
    sealMemos.set(payer, memos.map((m) => m.trim().toLowerCase()).filter((m) => /^[0-9a-f]{64}$/.test(m)));
  }
  if (revealed) reveals.push({ ...revealed, payer, memos, signature: tx.transaction.signatures[0] });
}

const toCheck = DEEP ? reveals : reveals.slice(0, SAMPLE);
let opened = 0;
for (const reveal of toCheck) {
  const entry = entries.get(reveal.entry);
  const commitment = sha256(
    Buffer.from("observed/commit/v1", "utf8"),
    b58decode(PROGRAM_ID),
    b58decode(round),
    r.termsHash,
    entry.sgtMint,
    entry.beneficiary,
    u16(reveal.pBps),
    reveal.salt,
  );
  if (commitment.equals(entry.commitment) && entry.pBps === reveal.pBps) opened += 1;
  else bad(`the answer in ${reveal.signature.slice(0, 12)}… does not open the seal it claims`);
}
if (toCheck.length > 0) {
  check(opened === toCheck.length, `${opened} of ${toCheck.length} revealed answers open their own seal`);
} else if (r.revealCount > 0) {
  bad(`the call counts ${r.revealCount} reveals, but none was found in ${transactions.length} fetched transactions`);
} else {
  console.log("  note  nothing revealed yet — nothing to open");
}
if (!DEEP && reveals.length > toCheck.length) {
  console.log(`  note  checked ${toCheck.length} of ${reveals.length} fetched reveals — pass --deep for all`);
}

// ---- 5. shared sentences were fixed before the outcome ----------------------
console.log("\n5. shared sentences were written before the outcome");
// The rule the app uses, recomputed here: a sentence counts only if its hash was the single
// 64-hex memo in the very transaction that carried that wallet's commit. A commit cannot happen
// outside the sealing window, so such a memo is necessarily older than the outcome.
let sentencesChecked = 0;
let sentencesBad = 0;
for (const reveal of toCheck) {
  const sealed = sealMemos.get(reveal.payer);
  for (const memo of reveal.memos) {
    const text = memo.trim();
    if (text.length === 0 || /^[0-9a-f]{64}$/.test(text)) continue;
    sentencesChecked += 1;
    const hash = sha256(reveal.salt, Buffer.from(text, "utf8")).toString("hex");
    if (!sealed || sealed.length !== 1 || sealed[0] !== hash) {
      sentencesBad += 1;
      bad(`a sentence in ${reveal.signature.slice(0, 12)}… was not the one sealed with the commit`);
    }
  }
}
if (sentencesChecked === 0) {
  console.log("  note  no shared sentence in the checked reveals");
} else {
  check(sentencesBad === 0, `${sentencesChecked - sentencesBad} of ${sentencesChecked} shared sentences match their seal memo`);
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`} · ${rpcCalls} RPC calls`);
process.exit(failures === 0 ? 0 : 1);
