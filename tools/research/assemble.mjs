// Merge research agents' record files into one incremental ocean-intelligence feed for staging.
// Usage: node tools/research/assemble.mjs --seas MED,BAL --out <feed.json> --live <live.json> <records files...>
//    or: node tools/research/assemble.mjs --topic "<label>" [--corrections <corrections.json>] ...
//    Live ids are dropped unless sent as an update (change_type other than new, revision above the live one).
//    e.g. --topic "BBNJ ratification" --out ... (global topical pass: no seas marked researched)
// Drops ids already live or repeated across files, validates the merged result against the live feed exactly
// as the Worker will, and prints quality warnings. Exits 1 on validation errors.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateFeed } from '../../src/validate.js';
import { normalize, checkRun } from '../../src/quality.js';
import { CATEGORY_SLUGS } from '../../src/model.js';
import { SEAS, seasOf } from '../../src/geo.js';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const topic = opt('--topic');
const correctionsPath = opt('--corrections');
const seas = (opt('--seas') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
const badSea = seas.find((s) => !SEAS[s]);
if (badSea) { console.error(`Unknown sea code ${badSea}. Seas: ${Object.keys(SEAS).join(', ')}`); process.exit(2); }
const out = opt('--out'), livePath = opt('--live'), files = args;
if ((!seas.length && !topic) || !out || !livePath || !files.length) { console.error('Usage: --seas MED,BAL | --topic "<label>" --out <feed.json> --live <live.json> <records files...>'); process.exit(2); }

const live = JSON.parse(readFileSync(livePath, 'utf8'));
const liveIds = new Set(live.records.map((r) => r.id));
const liveRev = new Map(live.records.map((r) => [r.id, r.revision || 1]));
const seen = new Map(), dropped = [];
for (const f of files) {
  let recs;
  try { recs = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.log('SKIP unreadable', f, e.message); continue; }
  for (const r of recs || []) {
    if (!r || !r.id) continue;
    if (liveIds.has(r.id) && !(r.change_type !== 'new' && (r.revision || 1) > liveRev.get(r.id))) { dropped.push(r.id + ' (already live)'); continue; }
    if (seen.has(r.id)) { dropped.push(r.id + ' (duplicate across files)'); continue; }
    seen.set(r.id, r);
  }
}
const records = [...seen.values()];
const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z'), today = now.slice(0, 10);
const start = new Date(Date.now() - 3 * 365.25 * 86400000).toISOString().slice(0, 10);
const feed = {
  feed_name: 'ocean-intelligence', schema_version: '1.0.0',
  generated_at: now, run_id: `run_${today}_${topic ? 'global' : seas.join('_').toLowerCase()}_claude`, mode: 'incremental',
  research_window: { start, end: today },
  records, tombstones: [], corrections: correctionsPath ? JSON.parse(readFileSync(correctionsPath, 'utf8')) : [],
  coverage: {
    searched_geography: topic ? ['World ocean'] : seas.map((s) => SEAS[s].name),
    date_window: { start, end: today },
    categories: topic ? [...new Set(records.map((r) => r.primary_category))] : CATEGORY_SLUGS,
    regions_researched: topic ? [] : seas,
    exhaustive: false,
    source_limitations: ['Researched by Claude Code agents from international and national agencies, scientific monitoring programmes, courts and news; documented issues, not a census.'],
    notes: [topic ? `Global topical pass (${topic}, Claude Code): ${records.length} new findings, added to existing findings.` : `In-depth pass for ${seas.map((s) => SEAS[s].name).join(', ')} (${seas.join(', ')}; Claude Code): ${records.length} new findings across all ${CATEGORY_SLUGS.length} categories, added to existing findings.`],
  },
  errors: [],
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(feed, null, 1));

const site = normalize(feed, live);
const errs = validateFeed(site);
console.log(`records ${records.length}; dropped ${dropped.length}${dropped.length ? ': ' + dropped.join(', ') : ''}`);
console.log(errs.length ? 'ERRORS:\n- ' + errs.join('\n- ') : `VALID (merged with live: ${site.records.length} records)`);
const w = checkRun(site, live, { touchedIds: new Set(records.map((r) => r.id)) });
console.log(w.map((x) => `- ${x.rule}: ${x.message}`).join('\n') || 'No quality warnings.');
const by = {};
records.forEach((r) => { const s = seasOf(r)[0] || (r.location || {}).basin || '?'; by[s] = by[s] || {}; by[s][r.primary_category] = (by[s][r.primary_category] || 0) + 1; });
for (const [s, c] of Object.entries(by)) console.log(s, Object.values(c).reduce((a, b) => a + b, 0), JSON.stringify(c));
console.log('size KB', Math.round(JSON.stringify(feed).length / 1024));
process.exit(errs.length ? 1 : 0);
