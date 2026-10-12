// The files oceans.exposed publishes for the earth.exposed network (src/network.js) and their routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';
import { networkStats, networkLayer } from '../src/network.js';

const feed = () => JSON.parse(readFileSync(new URL('../runs/2026-10-12/feed.json', import.meta.url), 'utf8'));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

test('stats: every figure carries a named https source with a date, and no credit line', () => {
  const s = networkStats(feed(), 'https://oceans.test', new Date('2026-10-12T12:00:00Z'));
  assert.equal(s.schema, 'earth.exposed/network-stats/1');
  assert.equal(s.site, 'oceans.exposed');
  for (const f of [s.headline, ...s.facts]) {
    assert.equal(typeof f.value, 'number');
    assert.match(f.source.url, /^https:\/\//);
    assert.match(f.source.date, DATE);
    assert.match(f.pulled, DATE);
    assert.ok(f.source.name.length >= 3);
  }
  assert.equal(s.records, feed().records.filter((r) => r.public !== false).length);
  assert.match(s.last_run, DATE);
  assert.equal(s.generated_at, '2026-10-12T12:00:00Z');
  assert.ok(!/carbotura|sponsored by/i.test(JSON.stringify(s)));
});

test('layer: one point per located record, linking to its dossier', () => {
  const l = networkLayer(feed(), 'https://oceans.test');
  assert.equal(l.type, 'FeatureCollection');
  for (const f of l.features) {
    assert.equal(f.geometry.type, 'Point');
    assert.ok(Math.abs(f.geometry.coordinates[0]) <= 180 && Math.abs(f.geometry.coordinates[1]) <= 90);
    assert.match(f.properties.url, /^https:\/\/oceans\.test\/dossier\.html\?id=/);
    assert.ok(['critical', 'high', 'moderate', 'low'].includes(f.properties.level));
  }
});

test('routes answer with CORS and 404 before any publish', async () => {
  const bucket = { get: async (k) => (k === 'feeds/latest.json' ? { httpEtag: '"x"', json: async () => feed() } : null) };
  const env = { OCEAN_REPORTS: bucket, ASSETS: { fetch: async () => new Response('asset') } };
  const stats = await worker.fetch(new Request('https://oceans.test/network/stats.json'), env);
  assert.equal(stats.status, 200);
  assert.equal(stats.headers.get('access-control-allow-origin'), '*');
  assert.equal((await stats.json()).site, 'oceans.exposed');
  const layer = await worker.fetch(new Request('https://oceans.test/network/layer.geojson'), env);
  assert.match(layer.headers.get('content-type'), /geo\+json/);
  const empty = await worker.fetch(new Request('https://oceans.test/network/stats.json'), { ...env, OCEAN_REPORTS: { get: async () => null } });
  assert.equal(empty.status, 404);
});
