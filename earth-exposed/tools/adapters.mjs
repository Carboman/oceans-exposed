// Interim adapters: derive a child's stats file and map layer from its existing public API, for sites that have not
// yet shipped /network/stats.json and /network/layer.geojson (docs/CHILD_SITE_NOTE.md). Every figure comes from the
// site's public data feed, which is named as the source. Nothing here is typed in by hand.
// The hub prefers the site's own files; an adapter runs only when the stats URL answers 404.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIPS } from '../src/states.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stateNames = (() => {
  const t = JSON.parse(readFileSync(join(root, 'public', 'assets', 'data', 'states-10m.json'), 'utf8'));
  return Object.fromEntries(t.objects.states.geometries.map((g) => [FIPS[g.id], g.properties.name]).filter(([c]) => c));
})();
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const n = (v) => Number(v || 0).toLocaleString('en-US');
const plural = (c, one, many) => (c === 1 ? one : many);
const lvl = (r) => String(r.issue_level || r.level || '').toLowerCase();
const point = (site, r, url, date) => {
  const c = (r.location || {}).coordinates;
  const geometry = c && typeof c.lat === 'number' && typeof c.lon === 'number' ? { type: 'Point', coordinates: [c.lon, c.lat] } : null;
  const region = !geometry && r.location && /^[A-Z]{2}$/.test(r.location.state || '') && r.location.state !== 'US' ? { type: 'us-state', code: r.location.state } : undefined;
  if (!geometry && !region) return null;
  const properties = { site, id: r.id, title: String(r.title || '').slice(0, 200), url, level: lvl(r), category: r.primary_category || '', date };
  if (region) properties.region = region;
  return { type: 'Feature', geometry, properties };
};

async function getJSON(fetchFn, url, timeoutMs = 60000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

export const adapters = {
  async oceans(fetchFn) {
    const base = 'https://oceans.exposed';
    const sum = await getJSON(fetchFn, `${base}/api/ocean/summary`);
    const issues = await getJSON(fetchFn, `${base}/api/ocean/issues`);
    const recs = issues.records || [];
    const runDate = (sum.run || {}).run_date;
    const seas = Object.keys((sum.summary || {}).by_sea || {}).length;
    const sources = recs.reduce((a, r) => a + (r.sources || []).length, 0);
    const total = (sum.summary || {}).total || 0;
    const src = { name: 'oceans.exposed data feed (JSON)', url: `${base}/api/ocean/feed`, date: runDate };
    const stats = {
      schema: 'earth.exposed/network-stats/1', site: 'oceans.exposed', url: base, tagline: 'Global Ocean Issues Tracker',
      scope: 'Marine and coastal issues across 32 regional seas and the high seas.',
      headline: { text: `${n(total)} sourced ocean ${plural(total, 'finding', 'findings')} across ${n(seas)} regional ${plural(seas, 'sea', 'seas')}`, value: total, unit: 'findings', source: src, pulled: today() },
      facts: [{ text: `${n(sources)} cited ${plural(sources, 'source', 'sources')} behind the findings`, value: sources, unit: 'sources', source: src, pulled: today() }],
      records: total, sources, last_run: runDate, map_layer: `${base}/network/layer.geojson`, generated_at: now(),
      derived: 'Derived by the hub from /api/ocean/summary and /api/ocean/issues until the site publishes /network/stats.json.',
    };
    const features = recs.map((r) => point('oceans.exposed', r, `${base}/dossier.html?id=${encodeURIComponent(r.id)}`, runDate)).filter(Boolean);
    return { stats, layer: { type: 'FeatureCollection', site: 'oceans.exposed', generated_at: now(), features } };
  },

  async water(fetchFn) {
    const base = 'https://water.exposed';
    const sum = await getJSON(fetchFn, `${base}/api/water/summary`);
    const issues = await getJSON(fetchFn, `${base}/api/water/issues`, 120000);
    const recs = issues.records || [];
    const runDate = (sum.run || {}).run_date;
    const total = (sum.summary || {}).total || 0;
    const states = new Set(((sum.coverage || {}).states_researched || []).map((s) => (typeof s === 'string' ? s : s.code || s.state)).filter(Boolean));
    const sources = recs.reduce((a, r) => a + (r.sources || []).length, 0);
    const src = { name: 'water.exposed data feed (JSON)', url: `${base}/api/water/feed`, date: runDate };
    const byState = {};
    for (const r of recs) {
      const st = (r.location || {}).state; if (!/^[A-Z]{2}$/.test(st || '') || st === 'US') continue;
      const e = (byState[st] ||= { count: 0 });
      e.count++;
    }
    const stats = {
      schema: 'earth.exposed/network-stats/1', site: 'water.exposed', url: base, tagline: 'U.S. Water Issues Tracker',
      scope: 'Drinking water, wastewater, groundwater, surface water, stormwater and water finance across the United States.',
      headline: { text: `${n(total)} sourced water ${plural(total, 'finding', 'findings')} across ${n(states.size || Object.keys(byState).length)} U.S. states and territories`, value: total, unit: 'findings', source: src, pulled: today() },
      facts: [{ text: `${n(sources)} cited ${plural(sources, 'source', 'sources')} behind the findings`, value: sources, unit: 'sources', source: src, pulled: today() }],
      records: total, sources, last_run: runDate, map_layer: `${base}/network/layer.geojson`, generated_at: now(),
      derived: 'Derived by the hub from /api/water/summary and /api/water/issues until the site publishes /network/stats.json. One feature per state.',
    };
    const features = Object.entries(byState).sort().map(([st, e]) => ({
      type: 'Feature', geometry: null,
      properties: { site: 'water.exposed', id: `US-${st}`, title: `${stateNames[st] || st}: ${n(e.count)} water ${plural(e.count, 'finding', 'findings')}`, url: `${base}/state.html?s=${st}`, category: 'state', date: runDate, region: { type: 'us-state', code: st }, count: e.count },
    }));
    return { stats, layer: { type: 'FeatureCollection', site: 'water.exposed', generated_at: now(), features } };
  },

  async waste(fetchFn) {
    const base = 'https://waste.exposed';
    const sum = await getJSON(fetchFn, `${base}/api/waste/summary`);
    const feed = await getJSON(fetchFn, `${base}/api/waste/feed`, 120000);
    const recs = (feed.records || []).filter((r) => r && r.public !== false);
    const runDate = String(sum.run_id || feed.run_id || '').slice(0, 10);
    const total = sum.findings || recs.length;
    const sources = sum.sources || recs.reduce((a, r) => a + (r.sources || []).length, 0);
    const cov = sum.coverage || {};
    const src = { name: 'waste.exposed data feed (JSON)', url: `${base}/api/waste/feed`, date: runDate };
    const stats = {
      schema: 'earth.exposed/network-stats/1', site: 'waste.exposed', url: base, tagline: 'U.S. waste, recycling and waste-to-energy',
      scope: 'How U.S. waste is collected, recycled, burned, buried and paid for, state by state.',
      headline: { text: `${n(total)} sourced waste ${plural(total, 'finding', 'findings')} across ${n(cov.states_researched || 0)} of ${n(cov.of || 56)} U.S. states and territories`, value: total, unit: 'findings', source: src, pulled: today() },
      facts: [{ text: `${n(sources)} cited ${plural(sources, 'source', 'sources')} behind the findings`, value: sources, unit: 'sources', source: src, pulled: today() }],
      records: total, sources, last_run: runDate, map_layer: `${base}/network/layer.geojson`, generated_at: now(),
      derived: 'Derived by the hub from /api/waste/summary and /api/waste/feed until the site publishes /network/stats.json.',
    };
    const score = (r) => Number((r.severity || {}).score ?? r.severity_score ?? NaN);
    const features = recs.map((r) => {
      const s = score(r); const level = Number.isFinite(s) ? (s >= 8 ? 'critical' : s >= 6 ? 'high' : s >= 4 ? 'moderate' : 'low') : '';
      return point('waste.exposed', { ...r, issue_level: level }, `${base}/finding?id=${encodeURIComponent(r.id)}`, runDate);
    }).filter(Boolean);
    return { stats, layer: { type: 'FeatureCollection', site: 'waste.exposed', generated_at: now(), features } };
  },
};
