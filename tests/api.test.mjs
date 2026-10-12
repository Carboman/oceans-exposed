// API round-trip through the real Worker with an in-memory R2: publish (snapshot + incremental),
// record lookup, filters, full feed, summary and the public validate endpoint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';

// Workers runtime extension used by the token check; Node lacks it.
if (!crypto.subtle.timingSafeEqual) {
  crypto.subtle.timingSafeEqual = (a, b) => {
    const x = new Uint8Array(a), y = new Uint8Array(b);
    if (x.length !== y.length) return false;
    let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
    return d === 0;
  };
}

function memoryBucket() {
  const m = new Map();
  const obj = (key, body) => ({ key, httpEtag: '"' + body.length + '"', body, size: body.length, uploaded: new Date(), text: async () => body, json: async () => JSON.parse(body) });
  return {
    get: async (k) => (m.has(k) ? obj(k, m.get(k)) : null),
    head: async (k) => (m.has(k) ? obj(k, m.get(k)) : null),
    put: async (k, v) => { m.set(k, typeof v === 'string' ? v : new TextDecoder().decode(v)); },
    list: async ({ prefix }) => ({ objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((k) => obj(k, m.get(k))) }),
    _map: m,
  };
}
const env = () => ({ OCEAN_REPORTS: memoryBucket(), PUBLISH_TOKEN: 'test-token', ASSETS: { fetch: async () => new Response('asset') } });
const call = (e, path, init = {}) => worker.fetch(new Request('https://oceans.test' + path, init), e);
const publish = (e, feed, qs = '') => call(e, '/internal/ocean/publish' + qs, { method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: JSON.stringify(feed) });
const example = () => JSON.parse(readFileSync(new URL('../contract/examples/finding.feed.json', import.meta.url), 'utf8'));
const REEF = 'EXAMPLE-CORAL-REEF-BLEACHING-2026', TREATY = 'EXAMPLE-GLOBAL-TREATY-RATIFICATION-2026';

test('publish requires the bearer token', async () => {
  const r = await call(env(), '/internal/ocean/publish', { method: 'POST', body: '{}' });
  assert.equal(r.status, 401);
});

test('snapshot publish converts the research feed and serves records, feed and summary', async () => {
  const e = env();
  const r = await publish(e, example());
  assert.equal(r.status, 200, await r.clone().text());
  const one = await (await call(e, `/api/ocean/issues/${REEF}`)).json();
  assert.equal(one.record.location.sea, 'CORAL');
  assert.equal(one.record.economic_risk.level, 'Watch');
  const feed = await (await call(e, '/api/ocean/feed')).json();
  assert.equal(feed.feed_name, 'ocean-issues');
  assert.equal(feed.records.length, 2);
  const s = await (await call(e, '/api/ocean/summary')).json();
  assert.equal(s.summary.total, 2);
  assert.equal(s.summary.by_sea.CORAL, 1);
  assert.equal(s.summary.by_basin.PAC, 1);
  assert.equal(s.summary.by_basin.GLOBAL, 1);
  assert.equal(s.summary.by_level.High, 1);
  assert.equal(s.indicators, null);
  assert.ok(!('financial' in s) && !('systems' in s));
});

test('issues API filters by sea, basin, country, category, level and computes scores', async () => {
  const e = env();
  await publish(e, example());
  const q = async (qs) => (await (await call(e, '/api/ocean/issues?' + qs)).json());
  assert.deepEqual((await q('sea=coral')).records.map((r) => r.id), [REEF]);
  assert.deepEqual((await q('basin=GLOBAL')).records.map((r) => r.id), [TREATY]);
  assert.deepEqual((await q('country=au')).records.map((r) => r.id), [REEF]);
  assert.deepEqual((await q('country=ABNJ')).records.map((r) => r.id), [TREATY]);
  assert.deepEqual((await q('category=coral-reefs')).records.map((r) => r.id), [REEF]);
  assert.equal((await q('level=High')).records[0].severity_score, 7);
  assert.equal((await q('economic_risk=Watch')).count, 1);
  assert.deepEqual((await q('sea=coral')).filters_applied, { sea: 'coral' });
});

test('incremental publish merges by id and keeps coverage.regions_researched cumulative', async () => {
  const e = env();
  await publish(e, example());
  const inc = example();
  inc.mode = 'incremental'; inc.generated_at = '2026-12-01T00:00:00Z'; inc.coverage.regions_researched = ['MED'];
  const other = structuredClone(inc.records[0]); other.id = 'EXAMPLE-OTHER'; other.location = { name: 'X', type: 'Port', sea: 'MED', countries: ['IT'] };
  inc.records = [other];
  const r = await publish(e, inc);
  assert.equal(r.status, 200, await r.clone().text());
  const feed = await (await call(e, '/api/ocean/feed')).json();
  assert.equal(feed.records.length, 3);
  assert.deepEqual(feed.coverage.regions_researched, ['MED']);
  const inc2 = structuredClone(inc); inc2.generated_at = '2026-12-02T00:00:00Z'; inc2.coverage.regions_researched = ['BAL']; inc2.records = [];
  await publish(e, inc2, '?allow_empty=1');
  assert.deepEqual((await (await call(e, '/api/ocean/feed')).json()).coverage.regions_researched, ['BAL', 'MED']);
});

test('a record without a sea or basin, or with an unknown category, is rejected (422) and nothing is written', async () => {
  const e = env();
  const bad = example();
  delete bad.records[1].location.basin;
  bad.records[0].primary_category = 'drinking-water-quality';
  const r = await publish(e, bad);
  assert.equal(r.status, 422);
  const msgs = (await r.json()).errors.map((x) => x.message).join('\n');
  assert.match(msgs, /location\.sea .*is required/);
  assert.match(msgs, /primary_category must be one of/);
  assert.equal(e.OCEAN_REPORTS._map.has('feeds/latest.json'), false);
});

test('public validate endpoint: no token, nothing written, errors and warnings returned', async () => {
  const e = env();
  const good = await call(e, '/api/ocean/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(example()) });
  assert.equal(good.status, 200);
  const g = await good.json();
  assert.equal(g.ok, true); assert.equal(g.records, 2); assert.ok(Array.isArray(g.warnings));
  assert.equal(e.OCEAN_REPORTS._map.size, 0, 'validate must not write anything');
  const badFeed = example(); badFeed.records[0].severity.components.livelihoods = 3;
  const bad = await call(e, '/api/ocean/validate', { method: 'POST', body: JSON.stringify(badFeed) });
  assert.equal(bad.status, 422);
  assert.match((await bad.json()).errors.map((x) => x.message).join('\n'), /livelihoods must be 0, 1 or 2/);
  const cut = await call(e, '/api/ocean/validate', { method: 'POST', body: JSON.stringify(example()).slice(0, 500) });
  assert.equal(cut.status, 422);
  assert.match((await cut.json()).errors[0].message, /truncated/);
  assert.equal(e.OCEAN_REPORTS._map.size, 0);
});

test('the sample run in runs/ is valid site-format and serves unchanged', async () => {
  const e = env();
  const sample = JSON.parse(readFileSync(new URL('../runs/2026-10-12/feed.json', import.meta.url), 'utf8'));
  const r = await publish(e, sample);
  assert.equal(r.status, 200, await r.clone().text());
  const feed = await (await call(e, '/api/ocean/feed')).json();
  assert.equal(feed.sample, true);
  assert.equal(feed.records.length, 2);
});
