#!/usr/bin/env node
// Per-feed hit rate for rule O1, measured on a logger mitschnitt. Reads a file, touches no chain.
//
//   node spikes/pyth-sponsored/o1.mjs <log.jsonl> [--stack new|old|both] [--md]
//
// The input is the append-only JSONL that `logger.mjs` writes: one line per observed change of
// a sponsored Pyth account, with `publish` (publish_time), `confBps`, `level`, `prog` and
// `shard`. The log is not in the repo — it is ~150 MB. docs/feeds-measured.md says which run
// the published numbers come from and how to make a new one.
//
// What is being decided, read off programs/observed/src/lib.rs:538-575 (`accept_reading`):
//   * the submission moment `now` must lie in [T, T + window_secs]      (W = 60 s)
//   * the reading must satisfy publish_time >= now - max_age_secs       (A = 60 s)
//   * verification_level must be Full
//   * conf / price must be <= max_conf_bps / 10 000                     (50 bps)
//
// W bounds the SUBMISSION, not publish_time. So a reading can be had at T exactly when some
// acceptable update has publish_time in [T - A, T + W]:
//   * one at or after T      -> submit at that moment, age 0
//   * one up to A before T   -> submit at T, age <= A
// A moment T therefore fails only inside a gap longer than W + A = 120 s, and then only for
// (gap - 120) seconds of it. Hit rate = 1 - sum(max(0, gap - 120)) / watched time.
//
// The logger dies and gets restarted; a hole in its heartbeat is not a feed outage. Stretches
// are cut at any hole longer than OUTAGE_MIN, and no gap is allowed to straddle a cut. Without
// that, a two-day logger crash shows up as a two-day outage in every single feed.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const W = 60;
const A = 60;
const MAX_CONF_BPS = 50;
const OUTAGE_MIN = 300;

const argv = process.argv.slice(2);
const LOG = argv.find((a) => !a.startsWith("--"));
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const STACK = arg("stack", "new");
const AS_MD = argv.includes("--md");
if (!LOG) {
  console.error("usage: node o1.mjs <log.jsonl> [--stack new|old|both] [--md]");
  process.exit(2);
}

const beats = [];
const records = [];
const rl = createInterface({ input: createReadStream(LOG), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line) continue;
  let o;
  try {
    o = JSON.parse(line);
  } catch {
    continue;
  }
  if (typeof o.t !== "number") continue;
  const t = o.t / 1000;
  beats.push(t);
  if (typeof o.publish === "number") {
    records.push([o.prog ?? "old", o.shard, o.feed, o.publish, o.level, o.confBps ?? 0]);
  }
}
beats.sort((a, b) => a - b);

/** The contiguous stretches the logger actually watched. */
const covered = [];
let start = beats[0];
let prev = beats[0];
for (const t of beats) {
  if (t - prev > OUTAGE_MIN) {
    covered.push([start, prev]);
    start = t;
  }
  prev = t;
}
covered.push([start, prev]);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace("T", " ");
let watched = 0;
for (const [a, b] of covered) watched += b - a;

const accepted = new Map();
const raw = new Map();
const rejected = new Map();
const push = (m, k, v) => m.set(k, (m.get(k) ?? []).concat(v));
for (const [prog, shard, feed, p, level, conf] of records) {
  const key = `${prog}\u0000${shard}\u0000${feed}`;
  push(raw, key, p);
  if (level === "Full" && conf <= MAX_CONF_BPS) push(accepted, key, p);
  else rejected.set(key, (rejected.get(key) ?? 0) + 1);
}

/** O1 hit rate and the gap profile, counted only inside the watched stretches. */
function stats(times) {
  const ts = [...new Set(times)].sort((a, b) => a - b);
  if (ts.length < 3) return null;
  let span = 0;
  let lost = 0;
  const gaps = [];
  for (const [lo, hi] of covered) {
    const inside = ts.filter((t) => t >= lo && t <= hi);
    if (inside.length < 2) continue;
    span += inside[inside.length - 1] - inside[0];
    for (let i = 1; i < inside.length; i += 1) {
      const g = inside[i] - inside[i - 1];
      gaps.push(g);
      lost += Math.max(0, g - (W + A));
    }
  }
  if (!gaps.length || span <= 0) return null;
  gaps.sort((a, b) => a - b);
  return {
    n: ts.length,
    p50: gaps[Math.floor(gaps.length / 2)],
    p90: gaps[Math.floor(gaps.length * 0.9)],
    max: gaps[gaps.length - 1],
    over: gaps.filter((g) => g > W + A).length,
    hit: 1 - lost / span,
  };
}

const rows = [];
for (const [key, times] of accepted) {
  const s = stats(times);
  if (!s) continue;
  const [prog, shard, feed] = key.split("\u0000");
  if (STACK !== "both" && prog !== STACK) continue;
  rows.push({ prog, shard: Number(shard), feed, ...s, rejected: rejected.get(key) ?? 0 });
}
rows.sort((a, b) => b.hit - a.hit || a.feed.localeCompare(b.feed));

console.log(`# watched ${(watched / 3600).toFixed(1)} h in ${covered.length} stretch(es):`);
for (const [a, b] of covered) console.log(`#   ${iso(a)} -> ${iso(b)}  (${((b - a) / 3600).toFixed(1)} h)`);
console.log(`# stack=${STACK}, ${rows.length} accounts, W=${W} A=${A} maxConf=${MAX_CONF_BPS} bps`);

if (AS_MD) {
  console.log("\n| Feed | Takt p50/p90/max (s) | Lücken > 120 s | verworfen | O1-Trefferquote |");
  console.log("|---|---|---|---|---|");
  for (const r of rows) {
    console.log(`| ${r.feed} | ${r.p50} / ${r.p90} / ${r.max} | ${r.over} | ${r.rejected} | ${(100 * r.hit).toFixed(4)} % |`);
  }
} else {
  console.log("\nfeed                       shard      n   p50   p90    max  >120s   hit %  rejected");
  for (const r of rows) {
    console.log(
      `${r.feed.padEnd(26)} ${String(r.shard).padStart(5)} ${String(r.n).padStart(6)} ` +
        `${String(r.p50).padStart(5)} ${String(r.p90).padStart(5)} ${String(r.max).padStart(6)} ` +
        `${String(r.over).padStart(6)} ${(100 * r.hit).toFixed(4).padStart(8)} ${String(r.rejected).padStart(9)}`,
    );
  }
}
