// Validates every research run in runs/ against the site's contract schema (site.config.json → schema).
// Used by the Contract check workflow on pull requests that change contract/**, and locally.
// Usage: node core/tools/contract-check.mjs [--schema path] [--base path-to-main-schema] [--out report.md] [--only runs/<a> runs/<b>...]
// --only: check just those run folders and exit 1 if any is invalid (the Stage runs schema gate).
// site.config.json → contract.historical: run folders kept as published but no longer checked (listed, never counted).
// With --base, a change is "breaking" only if a run that was valid under the base schema becomes invalid.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { cfg, sitePath } from './config.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const schemaArg = opt('--schema', cfg.schema);
const schemaPath = schemaArg.startsWith('/') ? schemaArg : sitePath(schemaArg);
const basePath = opt('--base');
const out = opt('--out');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args.slice(onlyIdx + 1).filter((a) => !a.startsWith('--')).map((a) => a.replace(/^runs\//, '').replace(/\/$/, '')) : null;
const historical = new Set(((cfg.contract || {}).historical) || []);
const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
const tick = '`';
const code = (s) => tick + s + tick;

function finish(exitCode, breaking) {
  if (out) writeFileSync(out, lines.join('\n') + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n', { flag: 'a' });
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, 'breaking=' + (breaking ? 'true' : 'false') + '\n', { flag: 'a' });
  process.exit(exitCode);
}
function compile(path, label) {
  const schema = JSON.parse(readFileSync(path, 'utf8'));
  return { schema, validate: new Ajv2020({ allErrors: true, strict: false }).compile(schema), label };
}

let cur;
try { cur = compile(schemaPath, 'proposed'); }
catch (e) { log('### Contract check: FAIL\n\n' + code(schemaPath) + ' is not a valid, compilable JSON Schema: ' + e.message); finish(1, true); }
let base = null;
if (basePath && existsSync(basePath)) {
  try { base = compile(basePath, 'base'); } catch (e) { log('- Base schema could not be compiled (' + e.message + '); comparing without it.'); }
}
const version = existsSync(sitePath('contract/VERSION')) ? readFileSync(sitePath('contract/VERSION'), 'utf8').trim() : null;

log('### Contract check\n');
log('Schema ' + code(schemaArg) + ' · contract_version ' + code(cur.schema.contract_version || '?') + ' · contract/VERSION ' + code(version || '?') +
  (base ? ' · compared with main (contract_version ' + code(base.schema.contract_version || '?') + ')' : ''));
if (version && cur.schema.contract_version !== version) log('\n- ⚠️ ' + code('contract_version') + ' in the schema does not match ' + code('contract/VERSION') + '.');
if (base && base.schema.contract_version === cur.schema.contract_version && JSON.stringify(base.schema) !== JSON.stringify(cur.schema)) log('\n- ⚠️ The schema changed but ' + code('contract_version') + ' was not bumped.');

let runs = existsSync(sitePath('runs')) ? readdirSync(sitePath('runs')).filter((d) => existsSync(sitePath('runs', d, 'feed.json'))).sort() : [];
if (only) runs = runs.filter((d) => only.includes(d));
let skippedHistorical = 0;
let checked = 0, invalid = 0, newlyBroken = 0;
log('\n| Run | Result | First problems |\n|---|---|---|');
for (const d of runs) {
  const feed = JSON.parse(readFileSync(sitePath('runs', d, 'feed.json'), 'utf8'));
  if (feed.feed_name !== cfg.feedName) { log('| ' + code(d) + ' | skipped (site-format baseline) | |'); continue; }
  if (!only && historical.has(d)) { skippedHistorical++; log('| ' + code(d) + ' | historical (kept as published, not checked) | |'); continue; }
  checked++;
  const wasValid = base ? base.validate(feed) : true;
  if (cur.validate(feed)) { log('| ' + code(d) + ' | ✅ valid' + (base && !wasValid ? ' (was invalid on main)' : '') + ' | |'); continue; }
  invalid++;
  if (wasValid) newlyBroken++;
  const errs = cur.validate.errors.slice(0, 4).map((e) => code(e.instancePath || '/') + ' ' + e.message).join('<br>');
  log('| ' + code(d) + ' | ❌ ' + cur.validate.errors.length + ' error(s)' + (base ? (wasValid ? ' **newly broken**' : ' (already invalid on main)') : '') + ' | ' + errs + ' |');
}
const breaking = base ? newlyBroken : invalid;
log('\n**' + (checked - invalid) + ' of ' + checked + ' research runs are valid under this schema.** ' +
  (breaking ? breaking + ' run(s) ' + (base ? 'that were valid on main become invalid' : 'are invalid') + ': this is a **breaking change** and needs the owner\'s explicit approval (contract/README.md).'
    : (base ? 'No run that was valid on main becomes invalid: backward compatible.' : 'No past run is invalid.')) +
  (skippedHistorical ? ' ' + skippedHistorical + ' historical run(s) listed in site.config.json were not checked.' : ''));
finish(only && invalid ? 1 : 0, breaking > 0);
