// Check a research agent's records file: node tools/research/check.mjs <records.json>
// Wraps the array in an incremental feed and runs the site's validator and content-quality checks.
import { readFileSync } from 'node:fs';
import { validateFeed } from '../../src/validate.js';
import { checkRun } from '../../src/quality.js';
import { adaptRecord } from '../../src/adapt.js';

const recs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(recs)) { console.log('ERRORS:\n- The file must contain a JSON array of records.'); process.exit(1); }
const feed = { feed_name: 'ocean-issues', schema_version: 'check', run: { run_date: new Date().toISOString().slice(0, 10), mode: 'incremental' }, coverage: {}, records: recs.map(adaptRecord) };
const errs = validateFeed(feed);
console.log(errs.length ? 'ERRORS:\n- ' + errs.join('\n- ') : 'VALID: ' + recs.length + ' records');
const w = checkRun(feed, null).filter((x) => !['balance', 'records-dropped'].includes(x.rule));
console.log(w.length ? 'WARNINGS:\n' + w.map((x) => '- ' + x.rule + ': ' + x.message + (x.ids.length ? ' [' + x.ids.slice(0, 8).join(', ') + ']' : '')).join('\n') : 'No quality warnings.');
process.exit(errs.length ? 1 : 0);
