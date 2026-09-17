#!/usr/bin/env node
// Deterministic calendar generator for one season. Writes files for review; touches no chain.
//
//   node services/calendar/generate.mjs --season 1 --start 2026-09-25 --leaves 64
//
// Output (both overwritten, never appended):
//   tests/fixtures/calendar/season<N>.json   rules, terms_hash, merkle root and per-round proofs
//   docs/generated/CALENDAR-season<N>.md     the table to paste into CALENDAR.md
//
// The same input always produces the same root. Verify with:
//   node services/calendar/generate.mjs --season 1 --start 2026-09-25 --leaves 64 --check <root>
// and with the Rust test `calendar_fixture_matches_program` (the program recomputes every hash).
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---- frozen generation rules (CALENDAR.md) ---------------------------------
const FEEDS = [
  { name: "SOL/USD", id: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" },
  { name: "BTC/USD", id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
  { name: "ETH/USD", id: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
];
/** rotating offsets in basis points; + = "more than x% above", − = "more than x% below" */
const OFFSETS_BPS = [100, -100, 150, -150, 50, -50, 200, -200];
const MAX_CONF_BPS = 50;
const TERMS_DOMAIN = Buffer.from("observed/terms/v2", "utf8");
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

/** Byte layout from docs/01-PROGRAM.md §3 create_round (terms_hash v2). */
function termsHash({ season, roundId, feedId, offsetBps, maxConfBps, commitOpen, commitClose, outcomeTime }) {
  return sha256(
    TERMS_DOMAIN,
    u16(season),
    u32(roundId),
    Buffer.from(feedId, "hex"),
    i32(offsetBps),
    u16(maxConfBps),
    i64(commitOpen),
    i64(commitClose),
    i64(outcomeTime),
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
const startDay = arg("start", "2026-09-25"); // first commit day, 00:00 UTC
const leafCount = Number(arg("leaves", LEAVES));
const firstRoundId = Number(arg("first-round", 0));
const expectRoot = arg("check", null);

if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) throw new Error("--start must be YYYY-MM-DD");
if (leafCount < 1 || leafCount > LEAVES) throw new Error("--leaves must be 1..64");

// ---- build -----------------------------------------------------------------
const startTs = Date.parse(`${startDay}T00:00:00Z`) / 1000;
const rounds = [];
for (let i = 0; i < leafCount; i++) {
  const roundId = firstRoundId + i;
  const commitOpen = startTs + i * 86_400;
  const commitClose = commitOpen + 12 * 3600;
  const outcomeTime = commitOpen + 24 * 3600;
  const feed = FEEDS[i % FEEDS.length];
  const offsetBps = OFFSETS_BPS[i % OFFSETS_BPS.length];
  const terms = {
    season,
    roundId,
    feedId: feed.id,
    offsetBps,
    maxConfBps: MAX_CONF_BPS,
    commitOpen,
    commitClose,
    outcomeTime,
  };
  const hash = termsHash(terms);
  rounds.push({
    ...terms,
    feed: feed.name,
    date: new Date(commitOpen * 1000).toISOString().slice(0, 10),
    // the client builds the sentence; it is deliberately not part of the hash
    question:
      offsetBps > 0
        ? `Will ${feed.name.split("/")[0]} be more than ${offsetBps / 100}% above its 12:00 UTC price at 00:00 UTC?`
        : `Will ${feed.name.split("/")[0]} be more than ${Math.abs(offsetBps) / 100}% below its 12:00 UTC price at 00:00 UTC?`,
    termsHash: hash.toString("hex"),
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
  maxConfBps: MAX_CONF_BPS,
  feeds: FEEDS.map((f) => f.name),
  offsetsBps: OFFSETS_BPS,
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
  `Rules: feeds ${FEEDS.map((f) => f.name).join(", ")} rotating; offsets ${OFFSETS_BPS.join(", ")} bps rotating; max_conf_bps ${MAX_CONF_BPS}; commit 00:00–12:00 UTC, outcome 24:00 UTC.`,
  `Unused leaves: sha256(0x00 || [0;32]) = ${out.emptyLeaf}`,
  "",
  `**Merkle root (= Config.calendar_root):** \`${root}\``,
  `**Last outcome:** ${out.lastOutcomeUtc}`,
  "",
  "| round | date (UTC) | feed | offset_bps | max_conf_bps | terms_hash |",
  "|---|---|---|---|---|---|",
  ...rounds.map((r) => `| ${r.roundId} | ${r.date} | ${r.feed} | ${r.offsetBps >= 0 ? "+" : ""}${r.offsetBps} | ${r.maxConfBps} | \`${r.termsHash}\` |`),
  "",
].join("\n");
const mdPath = join(ROOT, `docs/generated/CALENDAR-season${season}.md`);
writeFileSync(mdPath, md);

console.log(`season ${season}: ${leafCount} rounds, ${startDay} → ${out.lastOutcomeUtc.slice(0, 10)}`);
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
