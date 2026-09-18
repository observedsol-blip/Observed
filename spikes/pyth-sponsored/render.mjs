// Renders docs/sponsored-feeds.md (+ generated JSON) from feeds_result.json, docs_mainnet.json, price_feeds.json.
import { readFileSync, writeFileSync } from "node:fs";
const R = JSON.parse(readFileSync(process.env.IN ?? "feeds_result.json", "utf8"));
const docs = JSON.parse(readFileSync("docs_mainnet.json", "utf8").replace(/^\uFEFF/, ""));
const docsByKey = new Map(docs.map(d => [d.address, d]));
const docsById = new Map(docs.map(d => [d.id, d]));
const upgradedDocs = new Set(readFileSync("docs_upgraded.txt", "utf8").split(/\s+/).filter(Boolean));
const THIRD = "FcEAifArzj9GaGorDyT4JjTfYbBWUHYjfqN6zrH6UVGR";
const hermes = new Map(JSON.parse(readFileSync("price_feeds.json", "utf8")).map(f => [f.id, f]));
const NOW = Number(process.env.NOW ?? Math.floor(Date.now() / 1000));
const FINAL = process.env.FINAL === "1";

// Pyth market-hours schedule: "TZ;Mon,Tue,Wed,Thu,Fri,Sat,Sun;holidays". Day = O | C | HHMM-HHMM[&...]
function isOpen(schedule, utcSec) {
  if (!schedule) return null;
  const [tz, days] = schedule.split(";");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(utcSec * 1000));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.find(p => p.type === "weekday").value);
  const hm = Number(parts.find(p => p.type === "hour").value) * 100 + Number(parts.find(p => p.type === "minute").value);
  const d = days.split(",")[wd];
  if (d === "O") return true; if (d === "C") return false;
  return d.split("&").some(r => { const [a, b] = r.split("-").map(Number); return hm >= a && hm < (b === 2400 ? 2400 : b); });
}
// market open at 04:00 and 16:00 UTC on each weekday (Mon..Sun) of a reference week
const REF_MONDAY = Date.UTC(2026, 9, 12) / 1000; // Mon 12 Oct 2026, inside judging
// both a summer-time week (12 Oct) and a winter-time week (2 Nov, after the US switch on 1 Nov) must pass
const REF_WEEKS = [REF_MONDAY, Date.UTC(2026, 10, 2) / 1000];
function marketPattern(schedule) {
  const r = []; for (let i = 0; i < 7; i++) r.push([
    REF_WEEKS.every(m => isOpen(schedule, m + i * 86400 + 4 * 3600)),
    REF_WEEKS.every(m => isOpen(schedule, m + i * 86400 + 16 * 3600))]);
  return r;
}
const hoursLabel = (s) => { if (!s) return "?"; const days = s.split(";")[1]; return days === "O,O,O,O,O,O,O" ? "24/7" : days.split(",").slice(0, 7).join(" "); };

const rows = R.feeds.map(f => {
  const h = hermes.get(f.id); const sched = h?.attributes?.schedule ?? f.schedule;
  const pat = marketPattern(sched);
  const doc = docsByKey.get(f.key);
  // the upgraded docs table derives its addresses in the browser: same 64 feed ids, PDA under pyt2F4…, shard 0
  const listed = !!doc || (f.prog === "new" && f.shard === 0 && docsById.has(f.id));
  const keeper = listed ? "Pyth (Liste)" : (f.prog === "old" && f.shard === 1 ? "Dritter" : "nicht belegt");
  const ageH = (NOW - f.lastPublish) / 3600;
  const live = ageH < 24;
  const clsAsset = f.assetType;
  let group, why;
  const openAll = pat.every(([a, b]) => a && b), openWk = pat.slice(0, 5).every(([a, b]) => a && b);
  const trivial = /Redemption Rate|NAV/.test(clsAsset) || /^Crypto\.(USDC|USDT|USDE|USD1|USDG|USDS|PYUSD|FDUSD|DAI|EURC|AUSD|USDTB|USDY|FRXUSD|JUPUSD|USX|CASH|SYRUPUSDC)\//.test(f.symbol);
  const obsGaps = f.gaps.length;
  if (!live) { group = "C"; why = `ruht seit ${ageH > 48 ? Math.round(ageH / 24) + " Tagen" : Math.round(ageH) + " h"}`; }
  else if (f.p50 === null || f.p50 > 120) { group = "C"; why = f.p50 === null ? "in 20 min kein zweites Update" : `Takt p50 ${f.p50} s, zu langsam für einen Stichzeitpunkt`; }
  else if (trivial) { group = "C"; why = /Redemption|NAV/.test(clsAsset) ? "Umtauschkurs/NAV, kein Marktpreis" : "Stablecoin, Ausgang praktisch fest"; }
  else if (openAll) { group = FINAL && obsGaps ? "B?" : "A"; why = "Handelszeit 24/7" + (FINAL && obsGaps ? `, aber ${obsGaps} Lücke(n) > 5 min` : ""); }
  else if (openWk) { group = "B"; why = "Mo–Fr um 04:00 und 16:00 UTC offen, Wochenende geschlossen"; }
  else { group = "C"; const wk = pat.slice(0, 5); why = `werktags ${wk.some(([a]) => !a) ? "04:00" : ""}${wk.some(([a]) => !a) && wk.some(([, b]) => !b) ? " und " : ""}${wk.some(([, b]) => !b) ? "16:00" : ""} UTC geschlossen`; }
  return { ...f, sched, hours: hoursLabel(sched), inDocs: listed, keeper, pro: (doc ?? (listed ? docsById.get(f.id) : null))?.pro ?? "—", docsHeartbeat: doc ? `${doc.heartbeat} s / ${doc.deviation} %` : "", live, group, why };
});
writeFileSync(process.env.JSON_OUT ?? "sponsored-feeds.json", JSON.stringify(rows.map(({ checks, ...r }) => ({ ...r, checks })), null, 1));

const stack = (r) => (r.prog === "old" ? "alt" : "neu") + "/" + r.shard;
const liveRows = rows.filter(r => r.live).sort((a, b) => a.group.localeCompare(b.group) || a.assetType.localeCompare(b.assetType) || a.symbol.localeCompare(b.symbol) || a.prog.localeCompare(b.prog) || a.shard - b.shard);
const dormant = rows.filter(r => !r.live).sort((a, b) => a.symbol.localeCompare(b.symbol));
const takt = (r) => r.p50 === null ? "–" : `${r.p50} / ${r.p90} / ${r.max}`;
const chk = (r, h) => { const c = r.checks.filter(c => c.at.endsWith("T" + String(h).padStart(2, "0"))); return c.length ? c.map(c => c.ageAtT === null ? "–" : c.ageAtT + " s").join(", ") : "offen"; };
let md = "";
md += `| Gruppe | Feed | Klasse | Stack/Shard | gepflegt von | Konto | Feed-ID | Pyth-Liste | Pro-compatible | Stufe | Konfidenz (bps, Median) | letzter publish_time (UTC) | Takt p50/p90/max (s) | Handelszeit laut Pyth (Mo…So) | ${FINAL ? "Wochenende | Alter 04:00 | Alter 16:00 | Lücken > 5 min | " : ""}Begründung |\n`;
md += `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|${FINAL ? "---|---|---|---|" : ""}---|\n`;
for (const r of liveRows) {
  md += `| ${r.group} | ${r.symbol} | ${r.assetType} | ${stack(r)} | ${r.keeper} | \`${r.key}\` | \`${r.id.slice(0, 8)}…\` | ${r.inDocs ? "ja" : "nein"} | ${r.pro} | ${r.level} | ${r.confMedian} | ${new Date(r.lastPublish * 1000).toISOString().slice(0, 16).replace("T", " ")} | ${takt(r)} | ${r.hours} | `;
  if (FINAL) md += `${r.weekendUps ? r.weekendUps + " Updates" : "keine"} | ${chk(r, 4)} | ${chk(r, 16)} | ${r.gaps.length ? r.gaps.join("<br>") : "keine"} | `;
  md += `${r.why} |\n`;
}
let dm = `| Feed | Klasse | Stack/Shard | Konto | letzter publish_time (UTC) | Pyth-Liste |\n|---|---|---|---|---|---|\n`;
for (const r of dormant) dm += `| ${r.symbol} | ${r.assetType} | ${stack(r)} | \`${r.key}\` | ${new Date(r.lastPublish * 1000).toISOString().slice(0, 10)} | ${r.inDocs ? "ja" : "nein"} |\n`;
writeFileSync("table_live.md", md); writeFileSync("table_dormant.md", dm);
const count = (pred) => rows.filter(pred).length;
console.log(JSON.stringify({ all: rows.length, live: liveRows.length, dormant: dormant.length,
  A: count(r => r.live && r.group === "A"), B: count(r => r.live && r.group === "B"), C_live: count(r => r.live && r.group === "C"),
  liveByClass: Object.fromEntries([...new Set(liveRows.map(r => r.assetType))].map(c => [c, liveRows.filter(r => r.assetType === c).length])),
  docsLiveOld: count(r => r.live && r.inDocs), keepers: Object.fromEntries(["Pyth (Liste)", "Dritter", "nicht belegt"].map(k => [k, liveRows.filter(r => r.keeper === k).length])), unlistedOld0: liveRows.filter(r => r.keeper === "nicht belegt").map(r => r.symbol + " " + stack(r)).join(", "), nonCrypto: liveRows.filter(r => !/^Crypto/.test(r.assetType)).map(r => `${r.symbol} ${stack(r)} ${r.group}`) }, null, 1));