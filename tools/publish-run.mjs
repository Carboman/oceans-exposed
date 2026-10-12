// Publishes one or more run folders (runs/<YYYY-MM-DD...>/) to the oceans.exposed API.
// Each folder holds feed.json and optionally one PDF report.
// Usage: PUBLISH_TOKEN=... [SITE=https://oceans.exposed] node tools/publish-run.mjs runs/2026-11-09 [...]
//
// Per folder: quality check vs the live feed -> upload PDF -> dry-run publish -> real publish -> confirm live.
// Env:
//   REPORT_DIR    where to write <label>.quality.md / <label>.failed.md and results.json (for the issue step)
//   ALLOW_OLDER=1 republish a run dated earlier than the live one (rollback)
//   QUALITY_ONLY=1 run the quality check against the run published before this one; publish nothing
// Exits 1 if any folder fails to publish. Quality warnings never fail the job.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { normalize, checkRun, toMarkdown, annotate } from './quality-check.mjs';
import { isAgentFeed } from '../src/adapt.js';

const SITE = (process.env.SITE || 'https://oceans.exposed').replace(/\/$/, '');
const TOKEN = process.env.PUBLISH_TOKEN;
const REPORT_DIR = process.env.REPORT_DIR || '';
const ALLOW_OLDER = process.env.ALLOW_OLDER === '1';
const QUALITY_ONLY = process.env.QUALITY_ONLY === '1';
const PDF_NAME = /^[A-Za-z0-9._-]+\.pdf$/;
if (!TOKEN && !QUALITY_ONLY) { console.log('::error::PUBLISH_TOKEN is not set'); process.exit(1); }
const auth = TOKEN ? { authorization: `Bearer ${TOKEN}` } : {};
if (REPORT_DIR) mkdirSync(REPORT_DIR, { recursive: true });
const results = [];

async function call(method, path, body, headers = {}) {
  const res = await fetch(SITE + path, { method, body, headers: { ...auth, ...headers } });
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}
async function getJson(path) {
  const r = await fetch(SITE + path, { headers: { 'cache-control': 'no-cache' } });
  return r.ok ? r.json() : null;
}
function report(name, text) { if (REPORT_DIR) writeFileSync(join(REPORT_DIR, name), text); }

function failRun(label, errors) {
  errors.forEach((m) => console.log(`::error title=${label}::${m}`));
  report(`${label}.failed.md`, `## Publish failed: run \`${label}\`\n\nNothing from this run went live; the site still shows the previous run.\n\n` +
    errors.map((m) => `- ${m}`).join('\n') + '\n\n**Fix:** correct `runs/' + label + '/feed.json` (GET its sha, then PUT the corrected file to the same path). ' +
    'The publish check re-runs automatically on that commit. Field rules: `docs/FEED_SPEC.md` and `tools/research/BRIEF.template.md`.\n');
  results.push({ label, status: 'failed', errors });
  return false;
}

async function publish(dir) {
  const label = basename(dir);
  const feedPath = join(dir, 'feed.json');
  if (!existsSync(feedPath)) { console.log(`${dir}: no feed.json, skipping (a PDF-only commit is fine; publish happens when feed.json arrives).`); results.push({ label, status: 'skipped' }); return true; }
  let feed;
  try { feed = JSON.parse(readFileSync(feedPath, 'utf8')); } catch (e) { return failRun(label, [`feed.json is not valid JSON: ${e.message}`]); }

  // ---- quality check (never blocks) ----
  let prev = null, prevLabel = null;
  if (QUALITY_ONLY) {
    const runs = ((await getJson('/api/ocean/runs')) || {}).runs || [];
    const i = runs.findIndex((x) => x.run === label);
    const older = i >= 0 ? runs[i + 1] : runs[0];
    if (older) { prev = await getJson(`/api/ocean/feed?run=${older.run}`); prevLabel = older.run; }
  } else {
    prev = await getJson('/api/ocean/feed');
    const runs = ((await getJson('/api/ocean/runs')) || {}).runs || [];
    prevLabel = runs[0] ? runs[0].run : 'the live feed';
  }
  let warnings = [];
  try {
    const norm = normalize(feed, prev);
    const touched = isAgentFeed(feed) && feed.mode === 'incremental' ? new Set((feed.records || []).map((r) => r.id || r.finding_id)) : null;
    warnings = checkRun(norm, prev, { touchedIds: touched });
    annotate(label, warnings);
    const md = toMarkdown(label, norm, warnings, prevLabel);
    report(`${label}.quality.md`, md);
    if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n', { flag: 'a' });
    console.log(`${dir}: ${warnings.length} quality warning(s) vs ${prevLabel}`);
  } catch (e) {
    console.log(`::warning title=${label}::Quality check could not run: ${e.message}`);
  }
  if (QUALITY_ONLY) { results.push({ label, status: 'quality-only', warnings: warnings.length }); return true; }

  // ---- PDF ----
  const pdfs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (pdfs.length > 1) return failRun(label, [`expected at most one PDF, found ${pdfs.length}`]);
  if (pdfs.length) {
    // Keep the agent's filename only if it is URL-safe and ends with the run-folder name, so runs never overwrite each other in R2.
    const name = PDF_NAME.test(pdfs[0]) && pdfs[0].replace(/\.pdf$/i, '').endsWith(label) ? pdfs[0] : `Global-Ocean-Issues-Dossier-${label}.pdf`;
    const up = await call('PUT', `/internal/ocean/reports/${name}`, readFileSync(join(dir, pdfs[0])), { 'content-type': 'application/pdf' });
    if (up.status !== 200) return failRun(label, [`PDF upload failed (${up.status}): ${JSON.stringify(up.data)}`]);
    console.log(`${dir}: uploaded ${name} (${up.data.bytes} bytes)`);
    if (!feed.source_report || !feed.source_report.file) feed.source_report = { ...(feed.source_report || {}), file: name, title: (feed.source_report && feed.source_report.title) || `Global Ocean Issues Dossier — ${label.slice(0, 10)}` };
  }

  // ---- publish ----
  const older = ALLOW_OLDER ? 'allow_older=1' : '';
  const body = JSON.stringify(feed);
  const json = { 'content-type': 'application/json' };
  const dry = await call('POST', `/internal/ocean/publish?dry_run=1${older ? '&' + older : ''}`, body, json);
  if (dry.status !== 200) return failRun(label, ((dry.data && dry.data.errors) || [{ message: `HTTP ${dry.status}` }]).map((e) => e.message));
  console.log(`${dir}: dry run ok (${dry.data.records} records, run ${dry.data.run_date})`);

  const real = await call('POST', `/internal/ocean/publish${older ? '?' + older : ''}`, body, json);
  if (real.status !== 200) return failRun(label, [`publish failed (${real.status}): ${JSON.stringify(real.data)}`]);
  console.log(`${dir}: published run ${real.data.run_date} rev ${real.data.revision} (${real.data.records} records)`);

  const live = await getJson('/api/ocean/summary');
  const liveRev = live && live.run && live.run.revision;
  if (!live || live.run.run_date !== real.data.run_date || (real.data.revision && liveRev !== real.data.revision)) return failRun(label, [`after publishing, the live feed shows run ${live && live.run.run_date} rev ${liveRev}; expected ${real.data.run_date} rev ${real.data.revision}`]);
  console.log(`${dir}: confirmed live at ${SITE} (${live.summary.total} findings, rev ${liveRev})`);
  results.push({ label, status: 'published', warnings: warnings.length, records: real.data.records, revision: real.data.revision });
  return true;
}

const dirs = process.argv.slice(2).sort();
if (!dirs.length) { console.log('No run folders given; nothing to publish.'); process.exit(0); }
let ok = true;
for (const d of dirs) ok = (await publish(d)) && ok;
if (REPORT_DIR) writeFileSync(join(REPORT_DIR, 'results.json'), JSON.stringify(results, null, 2));
process.exit(ok ? 0 : 1);
