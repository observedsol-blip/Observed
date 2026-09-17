// Spike 1: for the last N days, is the first update at/after 12:00 and 00:00 UTC inside the
// 60 s window, and how wide is the confidence? Read-only Hermes queries, nothing posted.
// One request per timestamp for all feeds, paced, retries on HTTP 429.
// Usage: npx tsx density.ts [days=30] [delayMs=4000]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FEEDS: Record<string, string> = {
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const days = Number(process.argv[2] ?? 30);
  const delayMs = Number(process.argv[3] ?? 4000);
  const apiKey = readFileSync(join(homedir(), ".config/observed/pyth_api_key"), "utf8").trim();
  const now = new Date();
  const today0 = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
  const ids = Object.values(FEEDS).map((id) => `ids[]=${id}`).join("&");

  const rows: Array<Record<string, unknown>> = [];
  let throttled = 0;
  for (let d = days; d >= 1; d--) {
    for (const offset of [-12 * 3600, 0]) {
      const t = today0 - (d - 1) * 86400 + offset;
      let res: Response | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        res = await fetch(`https://hermes.pyth.network/v2/updates/price/${t}?${ids}&parsed=true&encoding=base64`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.status !== 429) break;
        throttled++;
        await sleep(15000 * (attempt + 1));
      }
      if (!res || !res.ok) {
        for (const name of Object.keys(FEEDS)) rows.push({ feed: name, t, tIso: new Date(t * 1000).toISOString(), http: res?.status });
      } else {
        const j = await res.json();
        for (const [name, id] of Object.entries(FEEDS)) {
          const p = j.parsed.find((x: { id: string }) => x.id === id);
          const pt = Number(p.price.publish_time);
          const prev = Number(p.metadata?.prev_publish_time);
          const price = Number(p.price.price);
          const conf = Number(p.price.conf);
          rows.push({
            feed: name,
            t,
            tIso: new Date(t * 1000).toISOString(),
            http: 200,
            lagSecs: pt - t,
            prevBeforeT: prev < t,
            inWindow: prev < t && t <= pt && pt <= t + 60,
            confBps: price > 0 ? Math.floor((conf * 10000) / price) : null,
          });
        }
      }
      process.stdout.write(".");
      await sleep(delayMs);
    }
  }
  console.log();

  const summary: Record<string, unknown> = { throttledResponses: throttled };
  for (const name of Object.keys(FEEDS)) {
    const r = rows.filter((x) => x.feed === name);
    const ok = r.filter((x) => x.http === 200);
    const confs = ok.map((x) => Number(x.confBps)).sort((a, b) => a - b);
    summary[name] = {
      samples: r.length,
      http200: ok.length,
      inWindow: ok.filter((x) => x.inWindow).length,
      maxLagSecs: Math.max(...ok.map((x) => Number(x.lagSecs))),
      medianConfBps: confs[Math.floor(confs.length / 2)],
      maxConfBps: confs[confs.length - 1],
      firstDate: r[0]?.tIso,
      nonOk: r.filter((x) => x.http !== 200).map((x) => `${x.tIso}:${x.http}`),
    };
  }
  mkdirSync("../results", { recursive: true });
  writeFileSync(`../results/density-${days}d.json`, JSON.stringify({ summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log("misses:", JSON.stringify(rows.filter((x) => x.http === 200 && !x.inWindow)));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
