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

test('discoveries: 30 days ending on the run date, totals equal the daily sums, latest newest first', async () => {
  const { networkStats: ns } = await import('../src/network.js');
  const day = (k) => new Date(Date.parse('2026-10-13') - k * 86400000).toISOString().slice(0, 10);
  const rec = (id, d) => ({ id, title: `Finding ${id}`, history: [{ date: d }], sources: [] });
  const records = [rec('A', day(0)), rec('B', day(0)), rec('C', day(3)), rec('D', day(10)), rec('E', day(40)), { id: 'F', title: 'F', history: [] }];
  const d = ns({ run: { run_date: '2026-10-13' }, run_id: '2026-10-13', records }, 'https://site.test').discoveries;
  assert.equal(d.as_of, '2026-10-13');
  assert.equal(d.by_day.length, 30);
  assert.equal(d.by_day[29].date, '2026-10-13');
  assert.equal(d.added_7d, 3);
  assert.equal(d.added_30d, 4);
  assert.equal(d.added_30d, d.by_day.reduce((t, b) => t + b.added, 0));
  assert.deepEqual(d.latest.map((x) => x.title), ['Finding A', 'Finding B', 'Finding C', 'Finding D']);
  assert.match(d.latest[0].url, /^https:\/\/site\.test\//);
});

test('network links: validator, links file and route (contract 1.2.0 on the hub)', async () => {
  const { validateNetworkFields } = await import('../src/xref.js');
  const { networkLinksFile } = await import('../src/network.js');
  const src = { name: 'Agency report', url: 'https://agency.example/r', date: '2021-03-04' };
  const ok = { id: 'A', network_tags: ['EV-2021-WINTER-STORM-URI'], shared_ids: { epa_frs: ['110000123'] }, cross_refs: [{ site: 'energy.exposed', id: 'E1', relation: 'caused-by', source: src, basis: 'The agency says the outage caused this.' }] };
  assert.deepEqual(validateNetworkFields(ok, 'oceans.exposed'), []);
  const bad = validateNetworkFields({ id: 'B', network_tags: ['Bad Tag'], shared_ids: { foo: ['1'] }, cross_refs: [{ site: 'oceans.exposed', id: 'X', relation: 'causes' }] }, 'oceans.exposed');
  for (const m of ['network_tags', 'shared_ids.foo', 'another network site', 'source', 'basis']) assert.ok(bad.some((x) => x.includes(m)), m);
  const rec = { ...ok, title: 'A finding', severity: { components: { harm: 2, service: 2, scale: 1, duration: 1, significance: 1 } }, sources: [{ url: 'https://x.example', date: '2021-02-16' }, { url: 'https://y.example', date: '2021-02-15' }], location: { state: 'TX', countries: ['US'] } };
  const l = networkLinksFile({ run: { run_date: '2026-10-16' }, records: [rec, { id: 'PLAIN', title: 'No links', sources: [] }] }, 'https://site.test', new Date('2026-10-16T00:00:00Z'));
  assert.equal(l.schema, 'earth.exposed/network-links/1');
  assert.equal(l.site, 'oceans.exposed');
  assert.equal(l.findings.length, 1);
  const f = l.findings[0];
  assert.equal(f.date, '2021-02-15');
  assert.deepEqual(f.tags, ['EV-2021-WINTER-STORM-URI']);
  assert.equal(f.refs[0].relation, 'caused-by');
  assert.match(f.url, /^https:\/\/site\.test\//);
  assert.ok(!/carbotura|sponsored by/i.test(JSON.stringify(l)));
});
