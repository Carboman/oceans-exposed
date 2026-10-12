// Validates run folders against the live site's POST /api/<slug>/validate (same checks as publishing).
// Used by the "Stage runs" workflow, whose runners validate every staged run against the live site.
// Usage: [SITE=https://the site] node tools/validate-remote.mjs runs/<folder> [...]
// Writes $OUT_DIR/validation.json and $OUT_DIR/validation.md. Exit 0 = all valid, 2 = some invalid, 1 = could not check.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { cfg, API, SITE_URL } from './config.mjs';

const SITE = (process.env.SITE || SITE_URL).replace(/\/$/, '');
const OUT = process.env.OUT_DIR || '.';
mkdirSync(OUT, { recursive: true });
const dirs = process.argv.slice(2).sort();
const results = [];
let fatal = false;

for (const dir of dirs) {
  const label = basename(dir), feedPath = join(dir, 'feed.json');
  if (!existsSync(feedPath)) { results.push({ folder: label, status: 'waiting', message: 'No feed.json yet (PDF-only commit). Validation runs when feed.json arrives.' }); continue; }
  const body = readFileSync(feedPath);
  let res, data;
  try {
    res = await fetch(SITE + API + '/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    data = await res.json();
  } catch (e) { fatal = true; results.push({ folder: label, status: 'error', message: `Could not reach the validator: ${e.message}` }); continue; }
  results.push({ folder: label, status: data.ok ? 'valid' : 'invalid', http: res.status, bytes: data.bytes, records: data.records, run_date: data.run_date, mode: data.mode,
    errors: data.errors || [], warnings: (data.warnings || []).map((w) => ({ rule: w.rule, title: w.title, message: w.message, id_count: w.id_count, fix: w.fix })) });
}

const md = [`<!-- ${cfg.slug}-validate -->`, `## ${cfg.host} validation`, ''];
for (const r of results) {
  if (r.status === 'waiting') { md.push(`**\`${r.folder}\`:** waiting. ${r.message}`); continue; }
  if (r.status === 'error') { md.push(`**\`${r.folder}\`:** ⚠️ ${r.message}`); continue; }
  md.push(`**\`${r.folder}\`:** ${r.status === 'valid' ? '✅ VALID' : '❌ INVALID'} · ${r.records} records · ${r.mode || '?'} · run ${r.run_date || '?'} · ${Math.round((r.bytes || 0) / 1024)} KB`);
  if (r.errors.length) { md.push('', '**Errors (fix all, then push again to the same staging branch):**'); r.errors.slice(0, 60).forEach((e) => md.push(`- ${e.message}`)); if (r.errors.length > 60) md.push(`- … and ${r.errors.length - 60} more`); }
  if (r.warnings.length) { md.push('', '**Warnings (published, filed as data-quality; fix in this run if you can):**'); r.warnings.forEach((w) => md.push(`- **${w.title}** (${w.id_count}): ${w.message}`)); }
  md.push('');
}
const allValid = results.length > 0 && results.every((r) => r.status === 'valid' || r.status === 'waiting') && results.some((r) => r.status === 'valid');
md.push(allValid ? '**Next:** promoting to `main` and publishing now. A second comment will confirm when it is live.' : (results.every((r) => r.status === 'waiting') ? '' : '**Next:** nothing was published. Fix the errors and push to this staging branch again.'));
md.push('', '```json', JSON.stringify({ valid: allValid, results: results.map((r) => ({ folder: r.folder, status: r.status, records: r.records, errors: (r.errors || []).length, warnings: (r.warnings || []).length })) }), '```');

writeFileSync(join(OUT, 'validation.json'), JSON.stringify({ valid: allValid, results }, null, 2));
writeFileSync(join(OUT, 'validation.md'), md.join('\n') + '\n');
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n', { flag: 'a' });
console.log(md.join('\n'));
process.exit(fatal ? 1 : allValid ? 0 : (results.every((r) => r.status === 'waiting') ? 0 : 2));
