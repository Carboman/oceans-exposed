// Nightly refresh: fetch every child's stats file and map layer, validate, and update the committed snapshot.
// A failing site keeps its last good entry, marked stale with the date. Exit code 0 even when sites fail (the
// snapshot is the deliverable); exit 2 only when the snapshot itself could not be written.
// Usage: node tools/refresh.mjs [--site oceans] [--dry-run]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStats, validateLayer, forbiddenHits } from '../src/validate.js';
import { adapters } from './adapters.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reg = JSON.parse(readFileSync(join(root, 'network', 'sites.json'), 'utf8'));
const args = process.argv.slice(2);
const only = args.includes('--site') ? args[args.indexOf('--site') + 1] : null;
const dry = args.includes('--dry-run');
const snapPath = join(root, 'public', 'data', 'snapshot.json');
const layersDir = join(root, 'public', 'data', 'layers');
const prev = existsSync(snapPath) ? JSON.parse(readFileSync(snapPath, 'utf8')) : { sites: {} };
const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const today = nowIso.slice(0, 10);
const MAX_LAYER_BYTES = 3 * 1024 * 1024;

async function fetchJSON(url, timeoutMs = 15000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': 'earth.exposed refresh (+https://earth.exposed/methodology)' } });
    if (res.status === 404) return { missing: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_LAYER_BYTES * 4) throw new Error('response too large');
    return { body: JSON.parse(text), bytes: text.length };
  } finally { clearTimeout(t); }
}

async function refreshSite(site) {
  let stats, layer, origin = 'site';
  const r = await fetchJSON(site.stats_url);
  if (r.missing) {
    const adapter = adapters[site.adapter];
    if (!adapter) throw new Error('stats file missing and no adapter');
    ({ stats, layer } = await adapter(fetch));
    origin = 'adapter';
  } else {
    stats = r.body;
  }
  const errs = validateStats(stats);
  if (stats.site !== site.site) errs.push(`site is "${stats.site}", expected "${site.site}"`);
  const hits = forbiddenHits(JSON.stringify(stats), reg.network.forbidden_terms);
  if (hits.length) errs.push(`forbidden terms: ${hits.join(', ')}`);
  if (errs.length) throw new Error('stats invalid: ' + errs.join('; '));
  if (!layer && stats.map_layer) {
    const l = await fetchJSON(stats.map_layer, 60000);
    if (!l.missing) { if (l.bytes > MAX_LAYER_BYTES) throw new Error('layer larger than 3 MB'); layer = l.body; }
  }
  let layerErrs = layer ? validateLayer(layer) : ['no layer'];
  if (layer) { const h = forbiddenHits(JSON.stringify(layer), reg.network.forbidden_terms); if (h.length) layerErrs.push(`forbidden terms: ${h.join(', ')}`); }
  return { stats, layer: layerErrs.length ? null : layer, layerErrs, origin };
}

const out = { schema: 'earth.exposed/network-snapshot/1', generated_at: nowIso, network: reg.network, sites: {} };
const report = [];
for (const site of reg.sites) {
  if (only && site.id !== only) { if (prev.sites[site.id]) out.sites[site.id] = prev.sites[site.id]; continue; }
  const old = prev.sites[site.id] || null;
  try {
    const { stats, layer, layerErrs, origin } = await refreshSite(site);
    out.sites[site.id] = { id: site.id, site: site.site, status: 'fresh', origin, fetched_at: nowIso, stats, layer_features: layer ? layer.features.length : (old && old.layer_features) || 0, layer_note: layerErrs.length ? `layer kept from ${old && old.layer_fetched_at ? old.layer_fetched_at.slice(0, 10) : 'never'}: ${layerErrs[0]}` : null, layer_fetched_at: layer ? nowIso : (old && old.layer_fetched_at) || null };
    if (layer && !dry) { mkdirSync(layersDir, { recursive: true }); writeFileSync(join(layersDir, `${site.id}.geojson`), JSON.stringify(layer)); }
    report.push(`${site.site}: fresh (${origin}, ${stats.records} records, ${layer ? layer.features.length + ' features' : 'layer unchanged'})`);
  } catch (err) {
    const msg = String(err && err.message || err).slice(0, 200);
    if (old && old.stats) {
      out.sites[site.id] = { ...old, status: 'stale', stale_since: old.status === 'stale' ? old.stale_since : (old.fetched_at || nowIso).slice(0, 10), last_error: msg, last_attempt: nowIso };
      report.push(`${site.site}: STALE since ${out.sites[site.id].stale_since} (${msg}); last good data kept`);
    } else {
      out.sites[site.id] = { id: site.id, site: site.site, status: 'missing', last_error: msg, last_attempt: nowIso };
      report.push(`${site.site}: MISSING, no previous data (${msg})`);
    }
  }
}
out.summary = { fresh: Object.values(out.sites).filter((s) => s.status === 'fresh').length, stale: Object.values(out.sites).filter((s) => s.status === 'stale').length, missing: Object.values(out.sites).filter((s) => s.status === 'missing').length, date: today };
if (!dry) { mkdirSync(dirname(snapPath), { recursive: true }); writeFileSync(snapPath, JSON.stringify(out, null, 1) + '\n'); }
console.log(report.join('\n'));
console.log(`Snapshot ${today}: ${out.summary.fresh} fresh, ${out.summary.stale} stale, ${out.summary.missing} missing${dry ? ' (dry run, nothing written)' : ''}.`);
// Stale-for-days list for the workflow (GITHUB_OUTPUT), so it can file one network-stale issue.
const staleLong = Object.values(out.sites).filter((s) => s.status !== 'fresh' && s.stale_since && (Date.parse(today) - Date.parse(s.stale_since)) / 86400000 >= 3).map((s) => `${s.site} (since ${s.stale_since})`);
if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `fresh=${out.summary.fresh}\nstale=${out.summary.stale}\nmissing=${out.summary.missing}\nstale_long=${staleLong.join('; ')}\n`, { flag: 'a' });
