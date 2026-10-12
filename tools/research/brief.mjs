// Write a regional-sea research brief from the template, listing the sea's findings already live.
// Usage: node tools/research/brief.mjs <SEA> <live-feed.json> <out.md>     (sea codes: src/geo.js)
import { readFileSync, writeFileSync } from 'node:fs';
import { SEAS, BASINS, seasOf } from '../../src/geo.js';

const [code, livePath, out] = process.argv.slice(2);
if (!SEAS[code] || !livePath || !out) { console.error(`Usage: node tools/research/brief.mjs <SEA> <live-feed.json> <out.md>\nSeas: ${Object.keys(SEAS).join(', ')}`); process.exit(2); }

const live = JSON.parse(readFileSync(livePath, 'utf8'));
const existing = live.records.filter((r) => seasOf(r).includes(code)).map((r) => `${r.id} (${(r.title || '').slice(0, 80)})`);
const today = new Date().toISOString().slice(0, 10);
const start = new Date(Date.now() - 3 * 365.25 * 86400000).toISOString().slice(0, 10);
const md = readFileSync(new URL('./BRIEF.template.md', import.meta.url), 'utf8')
  .replaceAll('{{SEA_NAME}}', SEAS[code].name).replaceAll('{{SEA}}', code)
  .replaceAll('{{BASIN_NAME}}', BASINS[SEAS[code].basin]).replaceAll('{{BASIN}}', SEAS[code].basin)
  .replaceAll('{{TODAY}}', today).replaceAll('{{WINDOW_START}}', start)
  .replaceAll('{{EXISTING_IDS}}', existing.length ? existing.map((x) => '- ' + x).join('\n') : '- (none yet)');
writeFileSync(out, md);
console.log(`${out}: ${SEAS[code].name}, ${existing.length} existing findings listed`);
