// CLI wrapper around src/quality.js.
//   node tools/quality-check.mjs runs/<folder> [--prev-run auto|<label>] [--site https://the site] [--out report.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL, API, siteModule } from './config.mjs';
const { isAgentFeed } = await siteModule('src/adapt.js');
const { normalize, checkRun, toMarkdown, annotate } = await siteModule('src/quality.js');
export { normalize, checkRun, toMarkdown, annotate };

// ---------- CLI ----------
async function fetchJson(u) { const r = await fetch(u, { headers: { 'cache-control': 'no-cache' } }); if (!r.ok) throw new Error(`${u} -> ${r.status}`); return r.json(); }
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const dir = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
  const site = (opt('--site', process.env.SITE || SITE_URL)).replace(/\/$/, '');
  const out = opt('--out');
  const label = basename(dir);
  const raw = JSON.parse(readFileSync(join(dir, 'feed.json'), 'utf8'));
  let prev = null, prevLabel = null;
  const pr = opt('--prev-run', 'auto');
  if (pr === 'auto') {
    const { runs } = await fetchJson(`${site}${API}/runs`);
    const i = runs.findIndex((x) => x.run === label);
    const older = i >= 0 ? runs[i + 1] : runs[0];
    if (older) { prev = await fetchJson(`${site}${API}/feed?run=${older.run}`); prevLabel = older.run; }
  } else if (pr !== 'none') { prev = await fetchJson(`${site}${API}/feed?run=${pr}`); prevLabel = pr; }
  const feed = normalize(raw, prev);
  const touched = isAgentFeed(raw) && raw.mode === 'incremental' ? new Set((raw.records || []).map((r) => r.id || r.finding_id)) : null;
  const warnings = checkRun(feed, prev, { touchedIds: touched });
  annotate(label, warnings);
  const md = toMarkdown(label, feed, warnings, prevLabel);
  if (out) writeFileSync(out, md);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n', { flag: 'a' });
  console.log(`${label}: ${warnings.length} quality warning(s) vs ${prevLabel || 'none'}`);
}
