// Renders the core workflow templates into the site's .github/workflows/ from site.config.json.
// Usage: node core/tools/render-workflows.mjs            (write)
//        node core/tools/render-workflows.mjs --check    (exit 1 if any rendered file differs: used in CI)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfg, SITE_ROOT } from './config.mjs';

const coreDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const tplDir = join(coreDir, 'workflows');
const outDir = join(SITE_ROOT, '.github', 'workflows');
const check = process.argv.includes('--check');
const version = readFileSync(join(coreDir, 'VERSION'), 'utf8').trim();
const vars = {
  SITE_HOST: cfg.host, SITE_REPO: cfg.repo, REPO_NAME: cfg.repo.split('/')[1], BOT_NAME: cfg.bot || cfg.repo.split('/')[1] + '-bot',
  SLUG: cfg.slug, API: '/api/' + cfg.slug, FEED_NAME: cfg.feedName, RUN_PREFIX: cfg.runPrefix, SCHEMA: cfg.schema,
  CRON_DAILY: cfg.research.cronDaily, DAILY_TIME: cfg.research.dailyTime, CRON_WATCHDOG: cfg.research.cronWatchdog,
  BUCKET_NAME: cfg.bucket || '', SAMPLE_RUN: cfg.sampleRun || '',
};
const skip = new Set((cfg.workflows && cfg.workflows.skip) || []);
const stale = [];
for (const t of readdirSync(tplDir).filter((n) => n.endsWith('.yml.tpl')).sort()) {
  const name = t.replace(/\.tpl$/, '');
  if (skip.has(name)) continue;
  let body = readFileSync(join(tplDir, t), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in vars)) throw new Error(`${t}: no value for {{${k}}}`); return vars[k]; });
  body = `# GENERATED from core/workflows/${t} by node core/tools/render-workflows.mjs (exposed-core ${version}).\n# Edit the template in exposed-core or site.config.json, then re-render; CI fails when this file is out of date.\n` + body;
  const out = join(outDir, name);
  if (check) { if (!existsSync(out) || readFileSync(out, 'utf8') !== body) stale.push('.github/workflows/' + name); }
  else { mkdirSync(outDir, { recursive: true }); writeFileSync(out, body); }
}
if (check && stale.length) { console.log('STALE workflows (run node core/tools/render-workflows.mjs):\n- ' + stale.join('\n- ')); process.exit(1); }
console.log(check ? `CLEAR: rendered workflows are current (exposed-core ${version}).` : `Rendered workflows into .github/workflows/ (exposed-core ${version}).`);
