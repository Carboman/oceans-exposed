// Content-quality rules specific to the ocean contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRun, normalize } from '../src/quality.js';

const example = () => JSON.parse(readFileSync(new URL('../contract/examples/finding.feed.json', import.meta.url), 'utf8'));
const rules = (feed, prev = null, opts) => checkRun(normalize(feed, prev), prev, opts).map((w) => w.rule);

test('the example feed is warning-free', () => { assert.deepEqual(rules(example()), []); });

test('a finding sourced only by undated dashboards is flagged', () => {
  const f = example();
  f.records[0].sources = [{ ref: 1, title: 'Coral Reef Watch dashboard', publisher: 'NOAA', date: null, accessed: '2026-10-12', url: 'https://example.org/d', basis: 'Dataset' }];
  assert.ok(rules(f).includes('sources-dataset-only'));
});

test('a finding with no sea and no area extent is unmappable', () => {
  const f = example();
  f.records[1].location = { name: 'x', type: 'Treaty', basin: 'ATL' };
  assert.ok(rules(f).includes('location-unmappable'));
});

test('one sea dominating a feed of 10+ findings is flagged unless the notes explain it', () => {
  const f = example();
  f.records = Array.from({ length: 12 }, (_, i) => ({ ...structuredClone(f.records[0]), id: 'R' + i }));
  f.coverage.notes = [];
  assert.ok(rules(f).includes('balance'));
  const w = checkRun(normalize(f, null), null).find((x) => x.rule === 'balance');
  assert.match(w.message, /Coral Sea/);
  f.coverage.notes = ['In-depth pass for CORAL in progress'];
  assert.match(checkRun(normalize(f, null), null).find((x) => x.rule === 'balance').message, /acknowledge/);
});
