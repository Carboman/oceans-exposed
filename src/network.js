// What oceans.exposed publishes for the earth.exposed network: /network/stats.json and /network/layer.geojson
// (contract: docs/NETWORK_STATS_SPEC.md in Carboman/earth-exposed). Pure functions over the live feed; every figure
// names the site's own public data feed as its source. No company names or credit lines may appear here.
import { score, level } from './model.js';
import { seasOf } from './geo.js';

const SITE = 'oceans.exposed';
const n = (v) => Number(v || 0).toLocaleString('en-US');
const plural = (c, one, many) => (c === 1 ? one : many);
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

function publicRecords(feed) { return (feed.records || []).filter((r) => r && r.public !== false); }

export function networkStats(feed, origin = `https://${SITE}`, now = new Date()) {
  const records = publicRecords(feed);
  const runDate = feed.run && feed.run.run_date;
  const sources = records.reduce((a, r) => a + (r.sources || []).length, 0);
  const seas = new Set(records.flatMap((r) => seasOf(r))).size;
  const today = now.toISOString().slice(0, 10);
  const src = { name: 'oceans.exposed data feed (JSON)', url: `${origin}/api/ocean/feed`, date: runDate };
  return {
    schema: 'earth.exposed/network-stats/1',
    site: SITE, url: origin, tagline: 'Global Ocean Issues Tracker',
    scope: 'Marine and coastal issues across 32 regional seas and the high seas.',
    headline: { text: `${n(records.length)} sourced ocean ${plural(records.length, 'finding', 'findings')} across ${n(seas)} regional ${plural(seas, 'sea', 'seas')}`, value: records.length, unit: 'findings', source: src, pulled: today },
    facts: [{ text: `${n(sources)} cited ${plural(sources, 'source', 'sources')} behind the findings`, value: sources, unit: 'sources', source: src, pulled: today }],
    records: records.length, sources, last_run: runDate,
    map_layer: `${origin}/network/layer.geojson`,
    generated_at: iso(now),
  };
}

export function networkLayer(feed, origin = `https://${SITE}`, now = new Date()) {
  const runDate = feed.run && feed.run.run_date;
  const features = publicRecords(feed).map((r) => {
    const c = (r.location || {}).coordinates;
    if (!c || typeof c.lat !== 'number' || typeof c.lon !== 'number') return null;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: { site: SITE, id: r.id, title: String(r.title || '').slice(0, 200), url: `${origin}/dossier.html?id=${encodeURIComponent(r.id)}`, level: level(score(r)).toLowerCase(), category: r.primary_category || '', date: runDate },
    };
  }).filter(Boolean);
  return { type: 'FeatureCollection', site: SITE, generated_at: iso(now), features };
}
