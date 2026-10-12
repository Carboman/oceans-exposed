// Research cost report: totals runs/*/RUN.json (written by the Daily research workflow) by month.
// Usage: node tools/cost-report.mjs [--json]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const runs = [];
for (const d of (existsSync('runs') ? readdirSync('runs') : []).sort()) {
  const p = join('runs', d, 'RUN.json');
  if (!existsSync(p)) continue;
  try { runs.push({ folder: d, ...JSON.parse(readFileSync(p, 'utf8')) }); } catch (e) { console.error(`${p}: ${e.message}`); }
}
const months = {};
for (const r of runs) {
  const m = (r.date || r.folder).slice(0, 7);
  const x = (months[m] = months[m] || { month: m, runs: 0, failed: 0, records: 0, turns: 0, web_searches: 0, minutes: 0, cost_usd_list: 0 });
  x.runs++; if (r.error) x.failed++;
  x.records += r.records || 0; x.turns += r.turns || 0; x.web_searches += r.web_searches || 0;
  x.minutes += r.duration_min || 0; x.cost_usd_list += r.cost_usd_list || 0;
}
const rows = Object.values(months);
if (process.argv.includes('--json')) { console.log(JSON.stringify({ months: rows, runs }, null, 1)); process.exit(0); }
if (!rows.length) { console.log('No runs/*/RUN.json yet.'); process.exit(0); }
const f = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);
console.log('month    runs failed records  turns searches  minutes   cost(list)  per run');
for (const x of rows) console.log(`${x.month}  ${String(x.runs).padStart(4)} ${String(x.failed).padStart(6)} ${String(x.records).padStart(7)} ${String(x.turns).padStart(6)} ${String(x.web_searches).padStart(8)} ${f(x.minutes, 0).padStart(8)}  $${f(x.cost_usd_list).padStart(9)}  $${f(x.cost_usd_list / x.runs)}`);
const total = rows.reduce((a, x) => a + x.cost_usd_list, 0);
console.log(`total: ${runs.length} run(s), $${f(total)} at list price; last run ${runs[runs.length - 1].folder} $${f(runs[runs.length - 1].cost_usd_list || 0)}`);
