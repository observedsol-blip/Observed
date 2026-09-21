// Do the moves on event days look different? Proxy: the US jobs report always lands on the first
// Friday of a month at 12:30/13:30 UTC, i.e. inside our measured window 04:00 -> 16:00. That makes
// the last twelve first-Fridays a clean, bias-free sample of "event day" against "other weekday".
// Reads the file direction.mjs wrote. Small sample (n = 12) — read as a hint, not as a rate.
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(new URL("./direction_0416.json", import.meta.url), "utf8"));

const isFirstFriday = (unixDay) => {
  const d = new Date(unixDay * 1000);
  return d.getUTCDay() === 5 && d.getUTCDate() <= 7;
};

for (const [product, { days }] of Object.entries(data)) {
  const ev = days.filter((v) => isFirstFriday(v.d));
  const wk = days.filter((v) => v.dow >= 1 && v.dow <= 5 && !isFirstFriday(v.d));
  const pct = (arr, x) => (arr.filter((v) => Math.abs(v.bps) > x * 100).length / arr.length * 100).toFixed(0);
  const med = (arr) => {
    const a = arr.map((v) => Math.abs(v.bps)).sort((x, y) => x - y);
    return (a[Math.floor(a.length / 2)] / 100).toFixed(2);
  };
  console.log(`${product}`);
  console.log(`  jobs-report days (n=${ev.length}): median |move| ${med(ev)} %  ` +
    [1, 1.3, 1.5, 1.7, 2, 2.5].map((x) => `>${x}% ${pct(ev, x)}%`).join("  "));
  console.log(`  other weekdays  (n=${wk.length}): median |move| ${med(wk)} %  ` +
    [1, 1.3, 1.5, 1.7, 2, 2.5].map((x) => `>${x}% ${pct(wk, x)}%`).join("  "));
}
