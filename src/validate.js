// Validation of the network contract, shared by tools/refresh.mjs, tools/site-check.mjs and the tests.
// Hand-written checks (no Ajv at runtime) so the same file runs in Node and in the Worker.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const HTTPS = /^https:\/\/[^\s"'<>]+$/;
const validDate = (s) => DATE.test(s) && !Number.isNaN(Date.parse(s)) && s <= new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function checkFact(f, path, e) {
  if (!f || typeof f !== 'object') return e.push(`${path}: missing`);
  if (typeof f.text !== 'string' || f.text.length < 5 || f.text.length > 160) e.push(`${path}.text: 5 to 160 characters`);
  if (typeof f.value !== 'number' || !Number.isFinite(f.value)) e.push(`${path}.value: number`);
  if (typeof f.unit !== 'string' || !f.unit || f.unit.length > 40) e.push(`${path}.unit: 1 to 40 characters`);
  const s = f.source;
  if (!s || typeof s !== 'object') e.push(`${path}.source: missing (every number needs a named public source)`);
  else {
    if (typeof s.name !== 'string' || s.name.length < 3 || s.name.length > 160) e.push(`${path}.source.name: 3 to 160 characters`);
    if (typeof s.url !== 'string' || !HTTPS.test(s.url)) e.push(`${path}.source.url: https URL`);
    if (typeof s.date !== 'string' || !validDate(s.date)) e.push(`${path}.source.date: YYYY-MM-DD, not in the future`);
  }
  if (typeof f.pulled !== 'string' || !validDate(f.pulled)) e.push(`${path}.pulled: YYYY-MM-DD, not in the future`);
  for (const k of Object.keys(f)) if (!['text', 'value', 'unit', 'source', 'pulled'].includes(k)) e.push(`${path}.${k}: unknown field`);
}

export function validateStats(s) {
  const e = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) return ['stats: not an object'];
  if (s.schema !== 'earth.exposed/network-stats/1') e.push('schema: must be "earth.exposed/network-stats/1"');
  if (typeof s.site !== 'string' || !/^[a-z0-9-]+\.exposed$/.test(s.site)) e.push('site: like "oceans.exposed"');
  if (typeof s.url !== 'string' || !HTTPS.test(s.url)) e.push('url: https URL');
  if (typeof s.tagline !== 'string' || s.tagline.length < 3 || s.tagline.length > 120) e.push('tagline: 3 to 120 characters');
  if (s.scope !== undefined && (typeof s.scope !== 'string' || s.scope.length > 300)) e.push('scope: up to 300 characters');
  checkFact(s.headline, 'headline', e);
  if (s.facts !== undefined) {
    if (!Array.isArray(s.facts) || s.facts.length > 5) e.push('facts: array of up to 5');
    else s.facts.forEach((f, i) => checkFact(f, `facts[${i}]`, e));
  }
  if (!Number.isInteger(s.records) || s.records < 0) e.push('records: non-negative integer');
  if (s.sources !== undefined && (!Number.isInteger(s.sources) || s.sources < 0)) e.push('sources: non-negative integer');
  if (typeof s.last_run !== 'string' || !validDate(s.last_run)) e.push('last_run: YYYY-MM-DD, not in the future');
  if (s.map_layer !== undefined && (typeof s.map_layer !== 'string' || !HTTPS.test(s.map_layer))) e.push('map_layer: https URL');
  if (typeof s.generated_at !== 'string' || !DATETIME.test(s.generated_at)) e.push('generated_at: ISO 8601 UTC date-time');
  if (s.derived !== undefined && (typeof s.derived !== 'string' || s.derived.length > 200)) e.push('derived: up to 200 characters');
  const known = ['schema', 'site', 'url', 'tagline', 'scope', 'headline', 'facts', 'records', 'sources', 'last_run', 'map_layer', 'generated_at', 'derived'];
  for (const k of Object.keys(s)) if (!known.includes(k)) e.push(`${k}: unknown field`);
  return e;
}

export function validateLayer(l) {
  const e = [];
  if (!l || typeof l !== 'object') return ['layer: not an object'];
  if (l.type !== 'FeatureCollection') e.push('type: FeatureCollection');
  if (!Array.isArray(l.features)) return [...e, 'features: array'];
  if (l.features.length > 5000) e.push('features: at most 5000');
  l.features.slice(0, 5000).forEach((f, i) => {
    const p = `features[${i}]`;
    if (!f || f.type !== 'Feature') return e.push(`${p}: type Feature`);
    const g = f.geometry, pr = f.properties || {};
    if (g !== null) {
      if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates) || g.coordinates.length !== 2 || !g.coordinates.every((c) => typeof c === 'number' && Number.isFinite(c))) e.push(`${p}.geometry: Point [lon, lat] or null`);
      else if (Math.abs(g.coordinates[0]) > 180 || Math.abs(g.coordinates[1]) > 90) e.push(`${p}.geometry: coordinates out of range`);
    } else if (!pr.region || pr.region.type !== 'us-state' || !/^[A-Z]{2}$/.test(pr.region.code || '')) e.push(`${p}: null geometry needs properties.region {type: "us-state", code}`);
    for (const k of ['site', 'id', 'title', 'url']) if (typeof pr[k] !== 'string' || !pr[k]) e.push(`${p}.properties.${k}: required`);
    if (typeof pr.url === 'string' && !HTTPS.test(pr.url)) e.push(`${p}.properties.url: https URL`);
    if (typeof pr.title === 'string' && pr.title.length > 200) e.push(`${p}.properties.title: up to 200 characters`);
  });
  return e.slice(0, 20);
}

export function forbiddenHits(text, terms) {
  const t = String(text).toLowerCase();
  return (terms || []).filter((w) => t.includes(String(w).toLowerCase()));
}
