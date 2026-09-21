#!/usr/bin/env node
// Deterministic calendar generator for one season. Writes files for review; touches no chain.
//
//   node services/calendar/generate.mjs --season 1 --start 2026-09-24 --leaves 64
//
// Output (both overwritten, never appended):
//   tests/fixtures/calendar/season<N>.json   rules, terms_hash, merkle root and per-round proofs
//   docs/generated/CALENDAR-season<N>.md     the table to paste into CALENDAR.md
//
// The same input always produces the same root. Verify with:
//   node services/calendar/generate.mjs --season 1 --start 2026-09-24 --leaves 64 --check <root>
// and with the Rust test `calendar_fixture_matches_program` (the program recomputes every hash
// and checks every season-1 rule, including that each price account is the sponsored PDA).
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---- frozen generation rules (DECISIONS-2026-09-18, HANDOFF 19.09.2026) ------
// Sponsored accounts in the upgraded Pyth stack: PDA [0u16 LE, feed_id] under the push oracle
// pyt2F414BA6dPttK6RddPZUdHfapoBN24GL5wbrPCou (docs/sponsored-feeds.md). The Rust test derives
// the PDA itself and compares.
const FEEDS = {
  SOL: { name: "SOL/USD", id: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", account: "7AviUf9nL62mcxNbQGKm4nKDQnPjswo6c5MX4D57HmyE" },
  BTC: { name: "BTC/USD", id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", account: "APgzQGGdv2qCgBkX6aHVkrGePtBVDDg68GiqaM7rmtf5" },
  ETH: { name: "ETH/USD", id: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", account: "7odryi4WfoMFHtv2eubdMgP1pqQMmdiXSK1N2tqZ2nRH" },
};
/** "move more than x %, either way", measured 04:00 → 16:00 UTC on the outcome day.
 *  Calibrated on the last 30 days to ~45–50 % Yes (docs/spikes/baserate.md, HANDOFF 19.09.);
 *  never below 1.0 % = 4 × the measurement spread. BTC does not run on weekends. */
const WEEKDAY = [["SOL", 170], ["BTC", 130], ["ETH", 120]];
const WEEKEND = [["SOL", 110], ["ETH", 100]];
const VERSION = 3;
const KIND_MOVE = 1;
const SOURCE_PRICE_ACCOUNT = 1;
const MAX_CONF_BPS = 50;
/** Measurement band: how far the choice of measurement moment inside W could move the outcome.
 *  p90 of the measured spread per timestamp was 22.7 bps for SOL, 11.6 for BTC, 15.3 for ETH
 *  (docs/spikes/baserate.md); rounded up to 25 for every feed. A round whose margin is inside
 *  this band was decided within the measurement noise — the app says so, everyone can check. */
const BAND_BPS = 25;
const WINDOW_SECS = 60; // W
const MAX_AGE_SECS = 60; // A
/** Reference 04:02: two minutes after sealing closes, so every admissible reference (at most
 *  A = 60 s old) was published after 04:01. The program refuses anything closer. */
const REFERENCE_DELAY_SECS = 120;
/** Rolling close: an entry may be closed 30 days after its reveal window — but never before
 *  EARLIEST_CLOSE. Judging runs to 8 Nov; with 30 days alone the first entries would vanish on
 *  26 Oct, including the ones in the video and the evidence table (owner decision 21.09.2026). */
const CLOSE_AFTER_SECS = 30 * 24 * 3600;
const EARLIEST_CLOSE_UNIX = Date.parse("2026-11-09T00:00:00Z") / 1000;
const TERMS_DOMAIN = Buffer.from("observed/terms/v3", "utf8");
const LEAF_TAG = 0x00;
const NODE_TAG = 0x01;
const DEPTH = 6;
const LEAVES = 1 << DEPTH; // 64, fixed by the program

// ---- helpers ---------------------------------------------------------------
const sha256 = (...parts) => createHash("sha256").update(Buffer.concat(parts)).digest();
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(s) {
  let n = 0n;
  for (const c of s) { const v = B58.indexOf(c); if (v < 0) throw new Error(`base58: ${s}`); n = n * 58n + BigInt(v); }
  const hex = n.toString(16).padStart(64, "0");
  const out = Buffer.from(hex, "hex");
  if (out.length !== 32) throw new Error(`not a 32-byte key: ${s}`);
  return out;
}

/** Byte layout of RoundTerms::hash (programs/observed/src/lib.rs, terms_hash v3). */
function termsHash(t) {
  return sha256(
    TERMS_DOMAIN,
    u16(t.season),
    u32(t.roundId),
    Buffer.from([t.version, t.kind, t.sourceKind]),
    Buffer.from(t.feedId, "hex"),
    base58(t.priceAccount),
    i32(t.offsetBps),
    u16(t.maxConfBps),
    u16(t.bandBps),
    u16(t.windowSecs),
    u16(t.maxAgeSecs),
    u32(t.closeAfterSecs),
    i64(t.earliestCloseUnix),
    i64(t.commitOpen),
    i64(t.commitClose),
    i64(t.referenceTime),
    i64(t.outcomeTime),
  );
}

function tree(leaves) {
  const levels = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < prev.length; i += 2) next.push(sha256(Buffer.from([NODE_TAG]), prev[i], prev[i + 1]));
    levels.push(next);
  }
  return levels;
}
function proofFor(levels, index) {
  const proof = [];
  let idx = index;
  for (let l = 0; l < levels.length - 1; l++) {
    proof.push(levels[l][idx ^ 1].toString("hex"));
    idx >>= 1;
  }
  return proof;
}

// ---- args ------------------------------------------------------------------
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const season = Number(arg("season", 1));
const startDay = arg("start", "2026-09-24"); // day of the first commit window, which opens 16:00 UTC
const leafCount = Number(arg("leaves", LEAVES));
const firstRoundId = Number(arg("first-round", 0));
const expectRoot = arg("check", null);

if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) throw new Error("--start must be YYYY-MM-DD");
if (leafCount < 1 || leafCount > LEAVES) throw new Error("--leaves must be 1..64");

// ---- build -----------------------------------------------------------------
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const startTs = Date.parse(`${startDay}T16:00:00Z`) / 1000;
const rounds = [];
let weekdayN = 0;
let weekendN = 0;
for (let i = 0; i < leafCount; i++) {
  const roundId = firstRoundId + i;
  const commitOpen = startTs + i * 86_400; // 16:00 UTC
  const commitClose = commitOpen + 12 * 3600; // 04:00 UTC next day: sealing closes
  const referenceTime = commitClose + REFERENCE_DELAY_SECS; // 04:02 UTC: reference
  const outcomeTime = commitClose + 12 * 3600; // 16:00 UTC that day = outcome
  const measured = new Date(commitClose * 1000); // the day the move is measured on
  const weekend = measured.getUTCDay() === 0 || measured.getUTCDay() === 6;
  const [key, offsetBps] = weekend ? WEEKEND[weekendN++ % WEEKEND.length] : WEEKDAY[weekdayN++ % WEEKDAY.length];
  const feed = FEEDS[key];
  const terms = {
    season,
    roundId,
    version: VERSION,
    kind: KIND_MOVE,
    sourceKind: SOURCE_PRICE_ACCOUNT,
    feedId: feed.id,
    priceAccount: feed.account,
    offsetBps,
    maxConfBps: MAX_CONF_BPS,
    bandBps: BAND_BPS,
    closeAfterSecs: CLOSE_AFTER_SECS,
    earliestCloseUtc: new Date(EARLIEST_CLOSE_UNIX * 1000).toISOString(),
    windowSecs: WINDOW_SECS,
    maxAgeSecs: MAX_AGE_SECS,
    closeAfterSecs: CLOSE_AFTER_SECS,
    earliestCloseUnix: EARLIEST_CLOSE_UNIX,
    commitOpen,
    commitClose,
    referenceTime,
    outcomeTime,
  };
  rounds.push({
    ...terms,
    feed: feed.name,
    measuredDay: `${DAYS[measured.getUTCDay()]} ${measured.toISOString().slice(0, 10)}`,
    // Informational only; the client builds the sentence from docs/03-SCREEN-MAP.md.
    // "more than" is strict in the program: exactly x % is No.
    question: `Will ${key} move more than ${offsetBps / 100}% up or down between 04:02 and 16:00 UTC on ${measured.toISOString().slice(0, 10)}?`,
    termsHash: termsHash(terms).toString("hex"),
  });
}

const emptyLeaf = sha256(Buffer.from([LEAF_TAG]), Buffer.alloc(32));
const leaves = Array.from({ length: LEAVES }, (_, i) =>
  i < rounds.length ? sha256(Buffer.from([LEAF_TAG]), Buffer.from(rounds[i].termsHash, "hex")) : emptyLeaf,
);
const levels = tree(leaves);
const root = levels[levels.length - 1][0].toString("hex");
rounds.forEach((r, i) => (r.proof = proofFor(levels, i)));

if (expectRoot && expectRoot !== root) {
  console.error(`root mismatch: expected ${expectRoot}, got ${root}`);
  process.exit(1);
}

// ---- write -----------------------------------------------------------------
const out = {
  generatedBy: "services/calendar/generate.mjs",
  note: "Review this file before anything goes on chain. publish_calendar takes season, root and leafCount only.",
  season,
  startDay,
  leafCount,
  firstRoundId,
  rules: {
    version: VERSION,
    kind: "move (KIND_MOVE = 1): |outcome/reference − 1| > x, strict",
    source: "sponsored Pyth account, upgraded stack (SOURCE_PRICE_ACCOUNT = 1)",
    windowSecs: WINDOW_SECS,
    maxAgeSecs: MAX_AGE_SECS,
    maxConfBps: MAX_CONF_BPS,
    bandBps: BAND_BPS,
    weekday: WEEKDAY.map(([k, x]) => `${k} ${x / 100}%`),
    weekend: WEEKEND.map(([k, x]) => `${k} ${x / 100}%`),
    times: "commit 16:00–04:00 UTC, reference 04:02, outcome 16:00, reveal 16:00–04:00 next day",
  },
  merkleRoot: root,
  emptyLeaf: emptyLeaf.toString("hex"),
  lastOutcomeUtc: new Date(rounds[rounds.length - 1].outcomeTime * 1000).toISOString(),
  rounds,
};
mkdirSync(join(ROOT, "tests/fixtures/calendar"), { recursive: true });
mkdirSync(join(ROOT, "docs/generated"), { recursive: true });
const jsonPath = join(ROOT, `tests/fixtures/calendar/season${season}.json`);
writeFileSync(jsonPath, `${JSON.stringify(out, null, 2)}\n`);

const md = [
  `# Calendar season ${season} — generated, review before publishing`,
  "",
  `Generator: \`node services/calendar/generate.mjs --season ${season} --start ${startDay} --leaves ${leafCount}\``,
  `Rules: terms v${VERSION}; question kind "move", strict; source: sponsored Pyth account (upgraded stack), W = ${WINDOW_SECS} s, A = ${MAX_AGE_SECS} s, max_conf_bps ${MAX_CONF_BPS}, measurement band ${BAND_BPS} bps.`,
  `Mon–Fri rotate ${WEEKDAY.map(([k, x]) => `${k} ${x / 100} %`).join(", ")}; Sat/Sun rotate ${WEEKEND.map(([k, x]) => `${k} ${x / 100} %`).join(", ")} (no BTC on weekends).`,
  "Times (UTC): commit 16:00–04:00, reference 04:02 (two minutes after sealing closes), outcome 16:00, reveal 16:00–04:00 the next day.",
  `Unused leaves: sha256(0x00 || [0;32]) = ${out.emptyLeaf}`,
  "",
  `**Merkle root (= Config.calendar_root):** \`${root}\``,
  `**Last outcome:** ${out.lastOutcomeUtc}`,
  "",
  "| round | measured on (UTC) | feed | more than ± | price account | terms_hash |",
  "|---|---|---|---|---|---|",
  ...rounds.map((r) => `| ${r.roundId} | ${r.measuredDay} | ${r.feed} | ${r.offsetBps / 100} % | \`${r.priceAccount}\` | \`${r.termsHash}\` |`),
  "",
].join("\n");
const mdPath = join(ROOT, `docs/generated/CALENDAR-season${season}.md`);
writeFileSync(mdPath, md);

console.log(`season ${season}: ${leafCount} rounds, first window ${startDay} 16:00 UTC → last outcome ${out.lastOutcomeUtc}`);
console.log(`merkle root: ${root}`);
console.log(`wrote ${jsonPath}`);
console.log(`wrote ${mdPath}`);
console.log("nothing was sent to a chain. publish_calendar is a manual step.");

// sanity: the file we just wrote must reproduce the same root
const reread = JSON.parse(readFileSync(jsonPath, "utf8"));
const rebuilt = tree(
  Array.from({ length: LEAVES }, (_, i) =>
    i < reread.rounds.length ? sha256(Buffer.from([LEAF_TAG]), Buffer.from(reread.rounds[i].termsHash, "hex")) : emptyLeaf,
  ),
);
if (rebuilt[rebuilt.length - 1][0].toString("hex") !== root) throw new Error("self-check failed");
