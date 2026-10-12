import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStats, validateLayer, forbiddenHits } from '../src/validate.js';

const good = () => ({
  schema: 'earth.exposed/network-stats/1', site: 'oceans.exposed', url: 'https://oceans.exposed', tagline: 'Global Ocean Issues Tracker',
  headline: { text: '7 sourced ocean findings across 5 regional seas', value: 7, unit: 'findings', source: { name: 'oceans.exposed data feed (JSON)', url: 'https://oceans.exposed/api/ocean/feed', date: '2026-10-12' }, pulled: '2026-10-12' },
  records: 7, sources: 14, last_run: '2026-10-12', map_layer: 'https://oceans.exposed/network/layer.geojson', generated_at: '2026-10-12T18:00:00Z',
});

test('a valid stats file passes', () => { assert.deepEqual(validateStats(good()), []); });
test('a fact without a source is rejected', () => {
  const s = good(); delete s.headline.source;
  assert.ok(validateStats(s).some((m) => m.includes('headline.source')));
});
test('a non-https source URL is rejected', () => {
  const s = good(); s.headline.source.url = 'http://example.org';
  assert.ok(validateStats(s).some((m) => m.includes('source.url')));
});
test('a future date is rejected', () => {
  const s = good(); s.headline.source.date = '2099-01-01';
  assert.ok(validateStats(s).some((m) => m.includes('source.date')));
});
test('unknown fields are rejected', () => {
  const s = good(); s.sponsor = 'x';
  assert.ok(validateStats(s).some((m) => m.includes('unknown field')));
});
test('more than five facts are rejected', () => {
  const s = good(); s.facts = Array.from({ length: 6 }, () => good().headline);
  assert.ok(validateStats(s).some((m) => m.includes('facts')));
});
test('forbidden terms are found case-insensitively', () => {
  assert.deepEqual(forbiddenHits('Sponsored By Someone', ['sponsored by']), ['sponsored by']);
  assert.deepEqual(forbiddenHits('plain text', ['sponsor']), []);
});
test('a layer with points and state regions passes', () => {
  const l = { type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-110, 0] }, properties: { site: 'oceans.exposed', id: 'A', title: 't', url: 'https://oceans.exposed/dossier.html?id=A' } },
    { type: 'Feature', geometry: null, properties: { site: 'water.exposed', id: 'US-AL', title: 't', url: 'https://water.exposed/state.html?s=AL', region: { type: 'us-state', code: 'AL' } } },
  ] };
  assert.deepEqual(validateLayer(l), []);
});
test('a null geometry without a region is rejected', () => {
  const l = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { site: 's', id: 'i', title: 't', url: 'https://x.exposed/' } }] };
  assert.ok(validateLayer(l).some((m) => m.includes('region')));
});
test('out-of-range coordinates are rejected', () => {
  const l = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [200, 0] }, properties: { site: 's', id: 'i', title: 't', url: 'https://x.exposed/' } }] };
  assert.ok(validateLayer(l).some((m) => m.includes('out of range')));
});
