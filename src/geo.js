// Geography of the oceans.exposed contract (contract 1.0.0): basins, regional seas, countries, geometry.
// The regional sea is the unit of the side panel, the sea tile map, coverage and the re-verification rotation.
// The browser has its own copy of SEAS in public/assets/app.js (bounding boxes in seamap.js); keep them in step.

export const BASINS = {
  PAC: 'Pacific Ocean', ATL: 'Atlantic Ocean', IND: 'Indian Ocean', SOU: 'Southern Ocean', ARC: 'Arctic Ocean', GLOBAL: 'Global ocean',
};

export const SEAS = {
  NPAC: { name: 'North Pacific (open ocean)', basin: 'PAC' },
  SPAC: { name: 'South Pacific (open ocean)', basin: 'PAC' },
  BERING: { name: 'Bering Sea', basin: 'PAC' },
  JPN: { name: 'Sea of Japan / East Sea', basin: 'PAC' },
  ECS: { name: 'East China & Yellow Seas', basin: 'PAC' },
  SCS: { name: 'South China Sea', basin: 'PAC' },
  SEA: { name: 'Indonesian & Philippine seas', basin: 'PAC' },
  CORAL: { name: 'Coral Sea & Great Barrier Reef', basin: 'PAC' },
  TASMAN: { name: 'Tasman Sea', basin: 'PAC' },
  NEPAC: { name: 'Northeast Pacific (US & Canada west coast)', basin: 'PAC' },
  TROPEPAC: { name: 'Eastern tropical Pacific', basin: 'PAC' },
  SEPAC: { name: 'Southeast Pacific (Humboldt)', basin: 'PAC' },
  NATL: { name: 'North Atlantic (open ocean)', basin: 'ATL' },
  SATL: { name: 'South Atlantic (open ocean)', basin: 'ATL' },
  NWATL: { name: 'Northwest Atlantic (US & Canada east coast)', basin: 'ATL' },
  GOM: { name: 'Gulf of Mexico', basin: 'ATL' },
  CAR: { name: 'Caribbean Sea', basin: 'ATL' },
  NSEA: { name: 'North Sea', basin: 'ATL' },
  BAL: { name: 'Baltic Sea', basin: 'ATL' },
  NEATL: { name: 'Northeast Atlantic (Celtic Seas, Biscay, Iberia)', basin: 'ATL' },
  MED: { name: 'Mediterranean Sea', basin: 'ATL' },
  BLK: { name: 'Black Sea', basin: 'ATL' },
  GOG: { name: 'Gulf of Guinea & West Africa', basin: 'ATL' },
  BRA: { name: 'Southwest Atlantic (Brazil & Argentina)', basin: 'ATL' },
  SAFR: { name: 'Southern Africa', basin: 'ATL' },
  RED: { name: 'Red Sea', basin: 'IND' },
  GULF: { name: 'Persian Gulf & Arabian Sea', basin: 'IND' },
  BEN: { name: 'Bay of Bengal & Andaman Sea', basin: 'IND' },
  WIND: { name: 'Western Indian Ocean', basin: 'IND' },
  EIND: { name: 'Eastern Indian Ocean', basin: 'IND' },
  SOUTHERN: { name: 'Southern Ocean', basin: 'SOU' },
  ARCTIC: { name: 'Arctic Ocean', basin: 'ARC' },
};
export const SEA_CODES = Object.keys(SEAS);

export const PRECISIONS = ['exact', 'site', 'city', 'coastline', 'sea'];
export const EXTENTS = ['site', 'local', 'national_waters', 'regional_sea', 'basin', 'global'];
const COUNTRY = /^([A-Z]{2}|ABNJ)$/;  // ISO 3166-1 alpha-2, or ABNJ for the high seas
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function seasOf(r) { const l = (r && r.location) || {}; return l.seas && l.seas.length ? l.seas : l.sea ? [l.sea] : []; }
export function basinOf(r) {
  const l = (r && r.location) || {};
  if (l.basin) return l.basin;
  const s = seasOf(r)[0];
  return s && SEAS[s] ? SEAS[s].basin : undefined;
}
export function countriesOf(r) { const l = (r && r.location) || {}; return Array.isArray(l.countries) ? l.countries : []; }
export function seaName(code) { return (SEAS[code] || {}).name || code; }
export function countryName(code) {
  if (code === 'ABNJ') return 'High seas (beyond national jurisdiction)';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch { return code; }
}

function checkPoint(pt, at, p) {
  if (!pt || typeof pt !== 'object') { p.push(`${at} must be an object.`); return; }
  if (!isNum(pt.lat) || pt.lat < -90 || pt.lat > 90) p.push(`${at}.lat must be a number between -90 and 90.`);
  if (!isNum(pt.lon) || pt.lon < -180 || pt.lon > 180) p.push(`${at}.lon must be a number between -180 and 180.`);
  if (!PRECISIONS.includes(pt.precision)) p.push(`${at}.precision must be one of ${PRECISIONS.join(', ')}.`);
}

// Hard errors. A record needs a regional sea (or a basin for open-ocean and global findings); geometry is optional.
export function validateLocation(record) {
  const p = [], l = record.location || {}, id = record.id;
  if (l.sea !== undefined && l.sea !== null && !SEAS[l.sea]) p.push(`${id}: location.sea must be one of ${SEA_CODES.join(', ')}.`);
  if (l.seas !== undefined && l.seas !== null && (!Array.isArray(l.seas) || l.seas.some((s) => !SEAS[s]))) p.push(`${id}: location.seas must be an array of sea codes.`);
  if (l.basin !== undefined && l.basin !== null && !BASINS[l.basin]) p.push(`${id}: location.basin must be one of ${Object.keys(BASINS).join(', ')}.`);
  if (!seasOf(record).length && !l.basin) p.push(`${id}: location.sea (or location.seas, or location.basin for open-ocean and global findings) is required.`);
  if (l.countries !== undefined && l.countries !== null && (!Array.isArray(l.countries) || l.countries.some((c) => !COUNTRY.test(String(c))))) p.push(`${id}: location.countries must be an array of ISO 3166-1 alpha-2 codes (or ABNJ).`);
  if (l.coordinates !== undefined && l.coordinates !== null) checkPoint(l.coordinates, `${id}: location.coordinates`, p);
  if (l.points !== undefined && l.points !== null) {
    if (!Array.isArray(l.points)) p.push(`${id}: location.points must be an array.`);
    else l.points.forEach((pt, i) => checkPoint(pt, `${id}: location.points[${i}]`, p));
  }
  if (l.extent !== undefined && l.extent !== null && !EXTENTS.includes(l.extent)) p.push(`${id}: location.extent must be one of ${EXTENTS.join(', ')}.`);
  return p;
}

// Can the site place this finding on a map? coordinates > area (a whole sea, basin or the globe) > sea tile only > none.
export function mappability(record) {
  const l = record.location || {};
  if (l.coordinates || (Array.isArray(l.points) && l.points.length)) return 'coordinates';
  if (['regional_sea', 'basin', 'global'].includes(l.extent) || seasOf(record).length > 1) return 'area';
  if (seasOf(record).length) return 'sea';
  return 'none';
}
