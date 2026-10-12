// Geography (contract 1.0.0): seas, basins, countries, geometry, mappability, adapter aliases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLocation, mappability, SEAS, BASINS, seasOf, basinOf, countryName } from '../src/geo.js';
import { validateFeed } from '../src/validate.js';
import { adaptAgentFeed, adaptRecord } from '../src/adapt.js';

test('every sea belongs to a known basin and codes are upper-case', () => {
  for (const [code, s] of Object.entries(SEAS)) { assert.ok(BASINS[s.basin], code); assert.equal(code, code.toUpperCase()); }
  assert.equal(Object.keys(SEAS).length, 32);
});

test('a sea, several seas, or a basin alone are valid; geometry is optional', () => {
  assert.deepEqual(validateLocation({ id: 'A', location: { name: 'x', type: 'Reef', sea: 'CORAL' } }), []);
  assert.deepEqual(validateLocation({ id: 'A', location: { name: 'x', type: 'Stock', seas: ['NSEA', 'NEATL'], countries: ['GB', 'NO', 'ABNJ'], extent: 'regional_sea' } }), []);
  assert.deepEqual(validateLocation({ id: 'A', location: { name: 'x', type: 'Treaty', basin: 'GLOBAL', coordinates: { lat: 0, lon: 0, precision: 'sea' }, points: [{ lat: 1, lon: 2, precision: 'site', role: 'platform' }] } }), []);
});

test('unknown sea, basin, country, precision or extent, and a record with no sea or basin, are rejected', () => {
  const e = validateLocation({ id: 'A', location: { sea: 'ATLANTIS', basin: 'MOON', countries: ['USA'], coordinates: { lat: 95, lon: -200, precision: 'gps' }, extent: 'statewide' } }).join('\n');
  assert.match(e, /location\.sea must be one of/);
  assert.match(e, /location\.basin must be one of/);
  assert.match(e, /countries must be an array of ISO/);
  assert.match(e, /lat must be a number between -90 and 90/);
  assert.match(e, /precision must be one of/);
  assert.match(e, /extent must be one of/);
  assert.match(validateLocation({ id: 'B', location: { name: 'x' } }).join('\n'), /location\.sea .*is required/);
});

test('validateFeed applies location rules to the example feed', () => {
  const f = adaptAgentFeed(JSON.parse(readFileSync(new URL('../contract/examples/finding.feed.json', import.meta.url), 'utf8')), null).feed;
  assert.deepEqual(validateFeed(f), []);
  f.records[0].location.coordinates.lat = 'forty';
  assert.match(validateFeed(f).join('\n'), /lat must be a number/);
});

test('seasOf, basinOf and countryName', () => {
  assert.deepEqual(seasOf({ location: { sea: 'MED' } }), ['MED']);
  assert.deepEqual(seasOf({ location: { seas: ['MED', 'BLK'] } }), ['MED', 'BLK']);
  assert.equal(basinOf({ location: { sea: 'MED' } }), 'ATL');
  assert.equal(basinOf({ location: { basin: 'GLOBAL' } }), 'GLOBAL');
  assert.equal(countryName('ABNJ'), 'High seas (beyond national jurisdiction)');
  assert.equal(countryName('JP'), 'Japan');
});

test('mappability prefers coordinates, then area extent, then the sea tile', () => {
  assert.equal(mappability({ location: { sea: 'MED', coordinates: { lat: 1, lon: 1, precision: 'exact' } } }), 'coordinates');
  assert.equal(mappability({ location: { basin: 'GLOBAL', extent: 'global' } }), 'area');
  assert.equal(mappability({ location: { seas: ['MED', 'BLK'] } }), 'area');
  assert.equal(mappability({ location: { sea: 'MED' } }), 'sea');
  assert.equal(mappability({ location: { name: 'Nowhere' } }), 'none');
});

test('adapter resolves sea names, lower-case codes, country aliases, lat/lng aliases and the old risk field', () => {
  const r = adaptRecord({ id: 'A', business_model_risk: { level: 'High', signals: 'x' }, severity: { components: { harm: 1, service: 2, scale: 0, duration: 1, significance: 2 } },
    location: { sea: 'Mediterranean Sea', seas: ['med', 'blk'], country: 'it', coordinates: { latitude: 40.8, longitude: 14.2, precision: 'city' }, points: [{ lat: 35.1, lng: 11.2, precision: 'site' }] } });
  assert.equal(r.location.sea, 'MED');
  assert.deepEqual(r.location.seas, ['MED', 'BLK']);
  assert.deepEqual(r.location.countries, ['IT']);
  assert.deepEqual(r.location.coordinates, { lat: 40.8, lon: 14.2, precision: 'city' });
  assert.deepEqual(r.location.points[0], { lat: 35.1, lon: 11.2, precision: 'site' });
  assert.equal(r.economic_risk.level, 'Elevated');
  assert.equal('business_model_risk' in r, false);
  assert.equal(r.severity.components.livelihoods, 2);
  assert.deepEqual(validateLocation(r), []);
});
