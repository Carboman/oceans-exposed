// Generates the shared header and footer from network/ and injects them into the hub's own pages.
// Usage: node tools/chrome.mjs            writes public/network/chrome/<version>/ and public/network/chrome/latest/
//        node tools/chrome.mjs --check    exits 1 if the generated files or the hub pages are out of date
// The children vendor the files from public/network/chrome/latest/ (docs/CHILD_SITE_NOTE.md).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reg = JSON.parse(readFileSync(join(root, 'network', 'sites.json'), 'utf8'));
const version = reg.network.chrome_version;
const tagline = reg.network.tagline;
const check = process.argv.includes('--check');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));

export function renderBar(current) {
  const links = [{ site: 'earth.exposed', short: 'Hub', url: 'https://earth.exposed' }, ...reg.sites.map((s) => ({ site: s.site, short: s.short, url: s.url }))]
    .map((s) => `      <a href="${esc(s.url)}/" data-site="${esc(s.site)}"${s.site === current ? ' aria-current="true"' : ''}>${esc(s.short)}</a>`).join('\n');
  return fill(readFileSync(join(root, 'network', 'header.html'), 'utf8'), { VERSION: version, TAGLINE: esc(tagline), CURRENT: esc(current), SITE_LINKS: links });
}
export function renderFooter() {
  return fill(readFileSync(join(root, 'network', 'footer.html'), 'utf8'), { VERSION: version, TAGLINE: esc(tagline) });
}
export function renderCss() {
  // One rule per site so a generic snippet marks the current site through the data-network-site attribute alone.
  const rules = ['earth.exposed', ...reg.sites.map((s) => s.site)]
    .map((s) => `.ex-net-bar[data-network-site="${s}"] .ex-net-sites a[data-site="${s}"] { color: var(--ex-ink-strong); border-bottom-color: var(--ex-accent); }`).join('\n');
  return fill(readFileSync(join(root, 'network', 'chrome.css'), 'utf8'), { VERSION: version, CURRENT_RULES: rules });
}

// The hub's own pages carry the chrome between markers; the generic snippet uses a placeholder the site replaces.
export function inject(html, current) {
  const bar = renderBar(current).trim();
  const foot = renderFooter().trim();
  return html
    .replace(/<!-- network-bar[^>]*-->[\s\S]*?<!-- \/network-bar -->/, bar)
    .replace(/<!-- network-footer[^>]*-->[\s\S]*?<!-- \/network-footer -->/, foot);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = { 'network-bar.html': renderBar('{{SITE}}').replace(/aria-current="true"/g, ''), 'network-footer.html': renderFooter(), 'chrome.css': renderCss() };
  const stale = [];
  for (const dir of [join(root, 'public', 'network', 'chrome', version), join(root, 'public', 'network', 'chrome', 'latest')]) {
    for (const [name, body] of Object.entries(files)) {
      const p = join(dir, name);
      if (check) { if (!existsSync(p) || readFileSync(p, 'utf8') !== body) stale.push(p.replace(root + '/', '')); }
      else { mkdirSync(dir, { recursive: true }); writeFileSync(p, body); }
    }
  }
  const pub = join(root, 'public');
  for (const f of readdirSync(pub).filter((n) => n.endsWith('.html'))) {
    const p = join(pub, f), html = readFileSync(p, 'utf8'), out = inject(html, 'earth.exposed');
    if (out !== html) { if (check) stale.push('public/' + f); else writeFileSync(p, out); }
  }
  if (check && stale.length) { console.log('STALE chrome: run node tools/chrome.mjs\n- ' + stale.join('\n- ')); process.exit(1); }
  console.log(check ? `CLEAR: shared chrome v${version} is current.` : `Wrote shared chrome v${version} and injected it into the hub pages.`);
}
