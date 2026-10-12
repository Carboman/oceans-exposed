// Pre-deploy checks for earth.exposed. Usage: node tools/site-check.mjs   (exits 1 on FAIL)
// Enforces the network standards on the hub itself: no company or sponsor mentions, no advocacy words, no rankings
// across sites, sourced snapshot, pinned external scripts, shared chrome present and current.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStats, validateLayer, forbiddenHits } from '../src/validate.js';
import { renderBar, renderFooter, renderCss } from './chrome.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const reg = JSON.parse(readFileSync(join(root, 'network', 'sites.json'), 'utf8'));
const version = reg.network.chrome_version;
const fails = [];
const ADVOCACY = /\b(must act|should|crisis|urgent|fight|demand|outrage|shocking|scandal)\b/i;
const RANKING = /\b(best|worst|top \d+|most polluted|cleanest|dirtiest)\b/i;
const ALLOWED_SCRIPT = /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/[a-z0-9.-]+\/\d+\.\d+\.\d+\//;

const pages = readdirSync(pub).filter((n) => n.endsWith('.html'));
for (const f of pages) {
  const html = readFileSync(join(pub, f), 'utf8');
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  for (const w of forbiddenHits(html, reg.network.forbidden_terms)) fails.push(`${f}: forbidden term "${w}"`);
  const adv = text.match(ADVOCACY); if (adv && !/standards\.html|methodology\.html/.test(f)) fails.push(`${f}: advocacy wording "${adv[0]}"`);
  const rk = text.match(RANKING); if (rk) fails.push(`${f}: ranking wording "${rk[0]}"`);
  if (/sponsor/i.test(text) && f !== 'standards.html') fails.push(`${f}: mentions a sponsor (only standards.html may state the rule)`);
  if (/mailto:/i.test(html)) fails.push(`${f}: mailto: link`);
  if (!html.includes(reg.network.tagline)) fails.push(`${f}: tagline missing`);
  if (!html.includes('earth<em>.exposed</em>')) fails.push(`${f}: wordmark missing`);
  if (f !== '404.html' && !/rel="canonical" href="https:\/\/earth\.exposed\//.test(html)) fails.push(`${f}: canonical URL missing`);
  if (!html.includes(`class="ex-net-bar" data-network-chrome="${version}"`)) fails.push(`${f}: network bar missing or not v${version} (run node tools/chrome.mjs)`);
  if (!html.includes(`class="ex-net-foot" data-network-chrome="${version}"`)) fails.push(`${f}: network footer missing or not v${version}`);
  if (!/<meta name="viewport" content="width=device-width, initial-scale=1">/.test(html)) fails.push(`${f}: viewport meta missing`);
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const src = m[1];
    if (/^https?:/.test(src) && !ALLOWED_SCRIPT.test(src)) fails.push(`${f}: external script not from cdnjs with an exact version: ${src}`);
  }
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
    if (/^https?:/.test(m[1]) && !m[1].startsWith('https://fonts.googleapis.com/')) fails.push(`${f}: external stylesheet not from Google Fonts: ${m[1]}`);
  }
  if (/placeholder|lorem ipsum|TODO/i.test(text) && !/Example data/.test(text)) fails.push(`${f}: placeholder text without the "Example data" label`);
}
for (const f of readdirSync(join(pub, 'assets')).filter((n) => /\.(js|css)$/.test(n))) {
  for (const w of forbiddenHits(readFileSync(join(pub, 'assets', f), 'utf8'), reg.network.forbidden_terms)) fails.push(`assets/${f}: forbidden term "${w}"`);
}

// Shared chrome: generated copies and the hub pages must match network/.
const gen = { 'network-bar.html': renderBar('{{SITE}}').replace(/aria-current="true"/g, ''), 'network-footer.html': renderFooter(), 'chrome.css': renderCss() };
for (const dir of ['latest', version]) for (const [name, body] of Object.entries(gen)) {
  const p = join(pub, 'network', 'chrome', dir, name);
  if (!existsSync(p)) fails.push(`public/network/chrome/${dir}/${name}: missing (run node tools/chrome.mjs)`);
  else if (readFileSync(p, 'utf8') !== body) fails.push(`public/network/chrome/${dir}/${name}: out of date (run node tools/chrome.mjs)`);
}
for (const w of forbiddenHits(JSON.stringify(gen), reg.network.forbidden_terms)) fails.push(`shared chrome: forbidden term "${w}"`);

// Snapshot: valid, sourced, not silently old.
const snapPath = join(pub, 'data', 'snapshot.json');
if (!existsSync(snapPath)) fails.push('public/data/snapshot.json: missing (run node tools/refresh.mjs)');
else {
  const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  for (const site of reg.sites) {
    const s = snap.sites[site.id];
    if (!s) { fails.push(`snapshot: no entry for ${site.site}`); continue; }
    if (s.stats) {
      for (const m of validateStats(s.stats)) fails.push(`snapshot ${site.site}: ${m}`);
      for (const w of forbiddenHits(JSON.stringify(s.stats), reg.network.forbidden_terms)) fails.push(`snapshot ${site.site}: forbidden term "${w}"`);
      const age = (Date.parse(today) - Date.parse(String(s.fetched_at || '').slice(0, 10))) / 86400000;
      if (s.status === 'fresh' && age > 14) fails.push(`snapshot ${site.site}: marked fresh but fetched ${age} days ago`);
    }
    const lp = join(pub, 'data', 'layers', `${site.id}.geojson`);
    if (existsSync(lp)) for (const m of validateLayer(JSON.parse(readFileSync(lp, 'utf8')))) fails.push(`layers/${site.id}.geojson: ${m}`);
  }
}

if (fails.length) { console.log('FAIL\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`CLEAR: ${pages.length} pages pass; shared chrome v${version} current; snapshot valid.`);
