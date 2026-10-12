// Pre-deploy checks for oceans.exposed.
// Usage: node tools/site-check.mjs   (exits 1 on FAIL)
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFeed } from '../src/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const fails = [];
// Shared earth.exposed chrome: the version in the vendored stylesheet's first line must match every page's bar and footer.
const chromeVersion = (readFileSync(join(root, 'assets', 'network-chrome.css'), 'utf8').match(/shared chrome v(\d+\.\d+\.\d+)/) || [])[1];
if (!chromeVersion) fails.push('assets/network-chrome.css: missing or without a version line');
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
  if (!html.includes(`class="ex-net-bar" data-network-chrome="${chromeVersion}" data-network-site="oceans.exposed"`)) fails.push(`${f}: earth.exposed network bar missing or not v${chromeVersion}`);
  if (!footer.includes(`class="ex-net-foot" data-network-chrome="${chromeVersion}"`)) fails.push(`${f}: earth.exposed network footer missing or not v${chromeVersion}`);
  if (!/href="\/?assets\/network-chrome\.css"/.test(html)) fails.push(`${f}: network-chrome.css not linked`);
}
for (const f of ['favicon.svg', ...readdirSync(join(root, 'assets')).filter((n) => /\.(js|css)$/.test(n)).map((n) => 'assets/' + n)]) {
  if (/carbotura/i.test(readFileSync(join(root, f), 'utf8'))) fails.push(`${f}: contains Carbotura`);
}
const feed = JSON.parse(readFileSync(join(root, '..', 'runs', '2026-10-12', 'feed.json'), 'utf8'));
for (const m of validateFeed(feed)) fails.push(`runs/2026-10-12/feed.json: ${m}`);

if (fails.length) { console.log('FAIL\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`CLEAR: all pages pass; baseline feed valid (${feed.records.length} records).`);
