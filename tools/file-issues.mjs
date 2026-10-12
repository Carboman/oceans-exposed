// Files, updates and closes GitHub issues from the publish step's reports (see publish-runs.yml).
// Uses the gh CLI with GH_TOKEN (the workflow's github.token, scope issues:write).
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const DIR = process.env.REPORT_DIR;
const RUN_URL = process.env.RUN_URL || '';
const COMMIT = (process.env.COMMIT || '').slice(0, 7);
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' }).trim();
const LABELS = {
  'data-quality': ['d4a72c', 'Automatic content-quality warnings on a published run'],
  'publish-failed': ['d73a4a', 'A run that did not go live'],
  'claude-task': ['1d76db', 'Request for Claude Code (code, schema, site)'],
};

const resultsPath = DIR && join(DIR, 'results.json');
const results = resultsPath && existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : [];
const laneFile = process.env.LANE_FILE;
const lane = laneFile && existsSync(laneFile) ? readFileSync(laneFile, 'utf8').trim() : '';
if (!results.length && !lane) { console.log('Nothing to file.'); process.exit(0); }

for (const [name, [color, desc]] of Object.entries(LABELS)) {
  try { gh('label', 'create', name, '--color', color, '--description', desc, '--force'); } catch (e) { console.log(`label ${name}: ${e.message}`); }
}
const openIssues = (label) => JSON.parse(gh('issue', 'list', '--label', label, '--state', 'open', '--json', 'number,title', '--limit', '100'));
function upsert(label, title, body) {
  const file = join(tmpdir(), `issue-${Date.now()}.md`);
  writeFileSync(file, body);
  const existing = openIssues(label).find((i) => i.title === title);
  if (existing) { gh('issue', 'comment', String(existing.number), '--body-file', file); console.log(`updated #${existing.number}: ${title}`); return existing.number; }
  const url = gh('issue', 'create', '--title', title, '--label', label, '--body-file', file);
  console.log(`opened ${url}`);
  return url;
}
const footer = `\n---\nWorkflow run: ${RUN_URL}${COMMIT ? ` · commit ${COMMIT}` : ''}\n\n_Research lane: read this before the next run and fix each item. ` +
  'This issue closes automatically when a later run publishes with no warnings._\n';

if (lane) {
  const fence = '`'.repeat(3);
  const body = [
    'A commit whose message starts with "Ocean run" changed files outside `runs/`. Only `runs/**` belongs to the research lane.',
    '',
    fence, lane, fence,
    '',
    '**Claude Code:** review these changes. Revert them if they were not intended, and confirm the site still deploys correctly.',
    '**Research lane:** never write outside `runs/`; open a `claude-task` issue instead.',
  ].join('\n');
  upsert('claude-task', `Lane check: research run commit changed files outside runs/ (${COMMIT})`, body + footer);
}

let anyPublishedClean = null;
for (const r of results) {
  if (r.status === 'failed') {
    const body = existsSync(join(DIR, `${r.label}.failed.md`)) ? readFileSync(join(DIR, `${r.label}.failed.md`), 'utf8') : r.errors.join('\n');
    upsert('publish-failed', `Publish failed: run ${r.label}`, body + footer);
  }
  if ((r.status === 'published' || r.status === 'quality-only') && r.warnings > 0) {
    const md = readFileSync(join(DIR, `${r.label}.quality.md`), 'utf8');
    upsert('data-quality', `Data-quality warnings: run ${r.label}`, md + footer);
  }
  if (r.status === 'published' && r.warnings === 0) anyPublishedClean = r.label;
  if (r.status === 'published' && r.warnings > 0) anyPublishedClean = null;
}

// A clean publish supersedes older warnings and failures.
if (anyPublishedClean) {
  for (const label of ['data-quality', 'publish-failed']) {
    for (const i of openIssues(label)) {
      gh('issue', 'close', String(i.number), '--comment', `Superseded: run ${anyPublishedClean} published with no quality warnings. ${RUN_URL}`);
      console.log(`closed #${i.number}`);
    }
  }
} else {
  // A successful publish (even with warnings) resolves earlier publish failures.
  const ok = results.filter((r) => r.status === 'published').pop();
  if (ok) {
    for (const i of openIssues('publish-failed')) { gh('issue', 'close', String(i.number), '--comment', `Run ${ok.label} published successfully. ${RUN_URL}`); console.log(`closed #${i.number}`); }
    // Only the newest published run's warnings stay open: each run's warnings are re-checked from scratch,
    // so an older run's data-quality issue is superseded by the newer one (which lists whatever still applies).
    const keep = `Data-quality warnings: run ${ok.label}`;
    const current = openIssues('data-quality').find((i) => i.title === keep);
    for (const i of openIssues('data-quality')) {
      if (i.title === keep) continue;
      gh('issue', 'close', String(i.number), '--comment', `Superseded by run ${ok.label}${current ? ' (#' + current.number + ')' : ''}, which re-checks every rule; anything still unresolved is listed there. ${RUN_URL}`);
      console.log(`superseded #${i.number}`);
    }
  }
}
