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

// New findings for the hub's "New discoveries" strip (network contract 1.1.0). A finding counts on the day the site
// first published it: the earliest date in its history, not the date of the event it describes. Latest additions are
// picked by that date, newest first, ties by id; never by severity.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Last day of the first full research pass (the baseline pass over all 32 seas, 2026-10-12). The hub shows additions up to it as
// the initial build rather than as new discoveries.
const INITIAL_BUILD_THROUGH = '2026-10-12';
const addedOn = (r) => (r.history || []).map((h) => String((h && h.date) || '').slice(0, 10)).filter((d) => DAY.test(d)).sort()[0] || null;
function discoveries(records, asOf, src, findingUrl) {
  if (!DAY.test(asOf || '')) return undefined;
  const by_day = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.parse(asOf) - (29 - i) * 86400000).toISOString().slice(0, 10), added: 0 }));
  const slot = new Map(by_day.map((b, i) => [b.date, i]));
  const recent = [];
  for (const r of records) { const d = addedOn(r); if (slot.has(d)) { by_day[slot.get(d)].added++; recent.push({ d, r }); } }
  const sum = (a) => a.reduce((t, b) => t + b.added, 0);
  recent.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : String(a.r.id).localeCompare(String(b.r.id))));
  return {
    as_of: asOf, ...(INITIAL_BUILD_THROUGH <= asOf ? { initial_build_through: INITIAL_BUILD_THROUGH } : {}), added_7d: sum(by_day.slice(23)), added_30d: sum(by_day), by_day,
    basis: 'Counted on the day the site first published each finding (the first entry in its history).',
    source: src,
    latest: recent.slice(0, 5).map(({ d, r }) => ({ title: String(r.title || r.id).slice(0, 200), url: findingUrl(r), date: d })),
  };
}

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
    discoveries: discoveries(records, runDate, src, (r) => `${origin}/dossier.html?id=${encodeURIComponent(r.id)}`),
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
