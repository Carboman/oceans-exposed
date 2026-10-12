// Pre-deploy checks for oceans.exposed.
// Usage: node tools/site-check.mjs   (exits 1 on FAIL)
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFeed } from '../src/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const fails = [];
// The earth.exposed network bar and footer are not used on this site (owner decision, 2026-10-12); /network/stats.json and
// /network/layer.geojson stay so the hub can read the site.
for (const f of readdirSync(root).filter((n) => n.endsWith('.html'))) {
  const html = readFileSync(join(root, f), 'utf8');
  const footer = html.slice(html.indexOf('<footer'));
  const beforeFooter = html.slice(0, html.indexOf('<footer'));
  if (!html.includes('<footer')) fails.push(`${f}: footer missing`);
  if (/carbotura/i.test(beforeFooter)) fails.push(`${f}: Carbotura appears outside the footer`);
  if (!/Sponsored by <a href="https:\/\/carbotura\.com"[^>]*>Carbotura<\/a>/.test(footer)) fails.push(`${f}: footer sponsor credit missing`);
  if ((footer.match(/carbotura/gi) || []).length !== 2) fails.push(`${f}: Carbotura should appear only in the sponsor credit`);
  if (!html.includes('oceans<em>.exposed</em>')) fails.push(`${f}: oceans.exposed wordmark missing`);
  if (f !== '404.html' && !html.includes('rel="canonical" href="https://oceans.exposed/')) fails.push(`${f}: canonical URL missing`);
  if (/mailto:/i.test(html)) fails.push(`${f}: mailto: link`);
  if (/ex-net-bar|ex-net-foot|network-chrome\.css/.test(html)) fails.push(`${f}: earth.exposed network chrome present`);
}
for (const f of ['favicon.svg', ...readdirSync(join(root, 'assets')).filter((n) => /\.(js|css)$/.test(n)).map((n) => 'assets/' + n)]) {
  if (/carbotura/i.test(readFileSync(join(root, f), 'utf8'))) fails.push(`${f}: contains Carbotura`);
}
const feed = JSON.parse(readFileSync(join(root, '..', 'runs', '2026-10-12', 'feed.json'), 'utf8'));
for (const m of validateFeed(feed)) fails.push(`runs/2026-10-12/feed.json: ${m}`);

if (fails.length) { console.log('FAIL\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`CLEAR: all pages pass; baseline feed valid (${feed.records.length} records).`);
