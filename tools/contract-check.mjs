// Validates every research run in runs/ against contract/ocean-intelligence.schema.json.
// Used by the Contract check workflow on pull requests that change contract/**, and locally.
// Usage: node tools/contract-check.mjs [--schema path] [--base path-to-main-schema] [--out report.md]
// With --base, a change is "breaking" only if a run that was valid under the base schema becomes invalid.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const schemaPath = opt('--schema', 'contract/ocean-intelligence.schema.json');
const basePath = opt('--base');
const out = opt('--out');
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
const version = existsSync('contract/VERSION') ? readFileSync('contract/VERSION', 'utf8').trim() : null;

log('### Contract check\n');
log('Schema ' + code(schemaPath) + ' · contract_version ' + code(cur.schema.contract_version || '?') + ' · contract/VERSION ' + code(version || '?') +
  (base ? ' · compared with main (contract_version ' + code(base.schema.contract_version || '?') + ')' : ''));
if (version && cur.schema.contract_version !== version) log('\n- ⚠️ ' + code('contract_version') + ' in the schema does not match ' + code('contract/VERSION') + '.');
if (base && base.schema.contract_version === cur.schema.contract_version && JSON.stringify(base.schema) !== JSON.stringify(cur.schema)) log('\n- ⚠️ The schema changed but ' + code('contract_version') + ' was not bumped.');

const runs = existsSync('runs') ? readdirSync('runs').filter((d) => existsSync(join('runs', d, 'feed.json'))).sort() : [];
let checked = 0, invalid = 0, newlyBroken = 0;
log('\n| Run | Result | First problems |\n|---|---|---|');
for (const d of runs) {
  const feed = JSON.parse(readFileSync(join('runs', d, 'feed.json'), 'utf8'));
  if (feed.feed_name !== 'ocean-intelligence') { log('| ' + code(d) + ' | skipped (site-format baseline) | |'); continue; }
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
    : (base ? 'No run that was valid on main becomes invalid: backward compatible.' : 'No past run is invalid.')));
finish(0, breaking > 0);
