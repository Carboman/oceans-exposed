// Converts the research lane's native "ocean-intelligence" feed into the site contract (docs/FEED_SPEC.md).
// Feeds already in the site contract pass through unchanged.
//
// Record-level mapping is tolerant: it accepts the site field names plus common aliases. Anything it cannot
// map is left for validation to report, and the raw payload is always archived (feeds/raw/) so it can be
// re-processed later.
import { CATEGORIES } from './model.js';
import { SEAS, SEA_CODES } from './geo.js';

const CATEGORY_NAMES = {};
for (const c of CATEGORIES) CATEGORY_NAMES[c.name.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ')] = c.slug;
Object.assign(CATEGORY_NAMES, {
  'ocean warming': 'ocean-warming-heatwaves', 'marine heatwaves': 'ocean-warming-heatwaves',
  'sea level rise': 'sea-level-coastal-flooding', 'sea level': 'sea-level-coastal-flooding', 'coastal flooding': 'sea-level-coastal-flooding', 'coastal erosion': 'sea-level-coastal-flooding',
  'ocean acidification': 'acidification-deoxygenation', 'deoxygenation': 'acidification-deoxygenation',
  'coral bleaching': 'coral-reefs', 'reefs': 'coral-reefs',
  'fisheries': 'fisheries-overfishing', 'overfishing': 'fisheries-overfishing', 'illegal fishing': 'fisheries-overfishing',
  'plastics': 'plastics-marine-debris', 'marine debris': 'plastics-marine-debris', 'marine litter': 'plastics-marine-debris',
  'dead zones': 'nutrient-pollution-dead-zones', 'eutrophication': 'nutrient-pollution-dead-zones', 'harmful algal blooms': 'nutrient-pollution-dead-zones',
  'oil spills': 'chemical-oil-pollution', 'oil pollution': 'chemical-oil-pollution', 'chemical pollution': 'chemical-oil-pollution',
  'shipping': 'shipping-ports-noise', 'ports': 'shipping-ports-noise', 'underwater noise': 'shipping-ports-noise',
  'offshore oil and gas': 'offshore-energy', 'offshore wind': 'offshore-energy',
  'seabed mining': 'deep-sea-mining', 'deep sea mining': 'deep-sea-mining',
  'mangroves': 'coastal-habitats', 'seagrass': 'coastal-habitats', 'habitats': 'coastal-habitats',
  'wildlife': 'marine-wildlife', 'biodiversity': 'marine-wildlife', 'marine mammals': 'marine-wildlife',
  'sea ice': 'polar-oceans-sea-ice', 'polar': 'polar-oceans-sea-ice', 'arctic': 'polar-oceans-sea-ice', 'antarctic': 'polar-oceans-sea-ice',
  'governance': 'governance-treaties-disputes', 'treaties': 'governance-treaties-disputes', 'maritime disputes': 'governance-treaties-disputes', 'marine protected areas': 'governance-treaties-disputes',
  'fish farming': 'aquaculture', 'other': 'other',
});
const SLUGS = new Set(CATEGORIES.map((c) => c.slug));

export function isAgentFeed(f) {
  return !!f && f.feed_name === 'ocean-intelligence';
}

export function categorySlug(v) {
  if (!v) return v;
  const s = String(typeof v === 'object' ? v.slug || v.name || v.category || '' : v).trim();
  if (SLUGS.has(s)) return s;
  const k = s.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');
  if (CATEGORY_NAMES[k]) return CATEGORY_NAMES[k];
  const dashed = k.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return SLUGS.has(dashed) ? dashed : s;
}

const first = (o, keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return undefined; };
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined);
const list = (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]);

function component(key) {
  const k = key.toLowerCase();
  if (/harm|health|environment|ecolog/.test(k)) return 'harm';
  if (/service|livelihood|econom/.test(k)) return 'livelihoods';
  if (/scale|population|geograph|extent/.test(k)) return 'scale';
  if (/duration|persist/.test(k)) return 'duration';
  if (/regulat|signific|legal|formal/.test(k)) return 'significance';
  return null;
}

function adaptSeverity(r) {
  const sev = r.severity || {};
  const raw = sev.components || r.severity_components || sev;
  const components = {}, notes = { ...(sev.notes || {}) };
  for (const [key, val] of Object.entries(raw || {})) {
    const c = component(key);
    if (!c || components[c] !== undefined) continue;
    if (val && typeof val === 'object') {
      const n = Number(first(val, ['score', 'value', 'points']));
      if (Number.isFinite(n)) components[c] = n;
      const note = first(val, ['rationale', 'evidence', 'note', 'basis']);
      if (note && !notes[c]) notes[c] = String(note);
    } else if (Number.isFinite(Number(val)) && typeof val !== 'boolean') {
      components[c] = Number(val);
    }
  }
  const out = { components };
  if (Object.keys(notes).length) out.notes = notes;
  if (sev.level || sev.issue_level) out.level = sev.level || sev.issue_level;
  return out;
}

function adaptSource(s) {
  if (typeof s === 'string') return { url: s };
  return {
    ...s,
    url: first(s, ['url', 'link', 'source_url', 'href']),
    // Contract 1.4.0: date is when the source was published or issued (null if it shows none); accessed is when it was opened.
    date: day(first(s, ['date', 'source_date', 'published', 'published_at', 'publication_date'])) || s.date || null,
    accessed: day(first(s, ['accessed', 'accessed_at', 'access_date', 'retrieved', 'retrieved_at'])) || s.accessed,
    title: first(s, ['title', 'name', 'label']),
    publisher: first(s, ['publisher', 'source', 'organization', 'agency']),
    basis: first(s, ['basis', 'source_basis', 'type']),
  };
}

// Coordinates: the contract says lat/lon; accept the long names and lng, which the agent has sent.
function adaptPoint(c) {
  if (!c || typeof c !== 'object') return c;
  const lat = first(c, ['lat', 'latitude']), lon = first(c, ['lon', 'lng', 'longitude']);
  const { latitude, longitude, lng, ...rest } = c;
  return { ...rest, ...(lat !== undefined ? { lat: Number(lat) } : {}), ...(lon !== undefined ? { lon: Number(lon) } : {}) };
}

// Sea codes are upper-case; a sea given by name is resolved to its code.
function seaCode(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim();
  const up = s.toUpperCase().replace(/[^A-Z]/g, '');
  if (SEAS[up]) return up;
  const hit = SEA_CODES.find((c) => SEAS[c].name.toLowerCase() === s.toLowerCase());
  return hit || s;
}
function adaptLocation(r) {
  const l = r.location || {};
  const seas = list(first(l, ['seas', 'regional_seas']) || first(r, ['seas'])).map(seaCode);
  const sea = seaCode(first(l, ['sea', 'regional_sea']) || first(r, ['sea']) || seas[0]);
  const basin = first(l, ['basin', 'ocean', 'ocean_basin']) || first(r, ['basin']);
  const countries = list(first(l, ['countries', 'country', 'country_codes']) || first(r, ['countries', 'country'])).map((x) => String(x).toUpperCase());
  return {
    ...l,
    ...(l.coordinates ? { coordinates: adaptPoint(l.coordinates) } : {}),
    ...(Array.isArray(l.points) ? { points: l.points.map(adaptPoint) } : {}),
    name: first(l, ['name', 'label', 'place']) || first(r, ['location_name', 'place']),
    type: first(l, ['type', 'location_type']) || first(r, ['location_type']),
    ...(sea ? { sea } : {}),
    ...(seas.length ? { seas } : {}),
    ...(basin ? { basin: String(basin).toUpperCase() } : {}),
    ...(countries.length ? { countries } : {}),
  };
}

const strings = (v) => list(v).filter((x) => typeof x === 'string' && x.trim());
// Loose shapes the site cannot render as sent: a projection or a conflict written as a sentence, list fields sent as one string.
function adaptProjection(p) {
  if (p === undefined || p === null || p === '') return p;
  if (typeof p === 'string') return { statement: p };
  if (typeof p !== 'object') return p;
  return { ...p, ...(p.assumptions !== undefined ? { assumptions: strings(p.assumptions) } : {}), ...(p.reversal_factors !== undefined ? { reversal_factors: strings(p.reversal_factors) } : {}) };
}
function adaptConflict(c) { return typeof c === 'string' ? { note: c } : c; }
function adaptMeasure(m) {
  if (!m || typeof m !== 'object' || typeof m.value !== 'string') return m;
  const n = Number(m.value.replace(/[,$%\s]/g, ''));
  return Number.isFinite(n) && /^[\s$,.%0-9-]+$/.test(m.value) ? { ...m, value: n } : { ...m, value: null, text: m.text || m.value };
}
function adaptBody(b) {
  if (typeof b === 'string') return { name: b };
  if (b && typeof b === 'object' && Array.isArray(b.name)) return b.name.map(adaptBody);  // a list sent where one name belongs
  return b;
}
const NEAR = { change_type: { corrected: 'changed', updated: 'changed' }, direction: { 'Volatile Mixed': 'Volatile or Mixed', 'Mixed': 'Volatile or Mixed', 'Volatile': 'Volatile or Mixed' }, risk: { High: 'Elevated', Moderate: 'Watch', Low: 'Not Indicated', None: 'Not Indicated' } };
export function adaptRecord(r) {
  if (!r || typeof r !== 'object') return r;
  const pop = r.population_affected;
  const trend = r.trend || {};
  const { business_model_risk, ...rest } = r;
  const er = r.economic_risk || business_model_risk || (r.economic_risk_level ? { level: r.economic_risk_level, signals: list(r.economic_risk_signals) } : undefined);
  return {
    ...rest,
    id: first(r, ['id', 'finding_id', 'stable_id']),
    title: first(r, ['title', 'canonical_title', 'name']),
    description: first(r, ['description', 'public_summary', 'summary', 'issue_description']),
    location: adaptLocation(r),
    primary_category: categorySlug(first(r, ['primary_category', 'category'])),
    secondary_categories: list(first(r, ['secondary_categories', 'secondary_category'])).map(categorySlug),
    issue_layer: first(r, ['issue_layer', 'primary_issue_layer', 'layer']),
    layer_rationale: first(r, ['layer_rationale', 'issue_layer_rationale']),
    severity: adaptSeverity(r),
    status: first(r, ['status', 'current_status']),
    population_affected: pop && typeof pop === 'object' ? pop : pop !== undefined ? { value: Number.isFinite(Number(pop)) ? Number(pop) : null, status: Number.isFinite(Number(pop)) ? 'Reported' : 'Not reported', note: Number.isFinite(Number(pop)) ? undefined : String(pop) } : undefined,
    economic_risk: er && typeof er === 'object' ? { ...er, level: NEAR.risk[er.level] || er.level, ...(er.signals !== undefined ? { signals: strings(er.signals) } : {}) } : er,
    secondary_drivers: strings(r.secondary_drivers),
    measures: list(r.measures).map(adaptMeasure),
    ...(r.conflicts !== undefined ? { conflicts: list(r.conflicts).map(adaptConflict) } : {}),
    trend: { ...trend, direction: (function (d) { return NEAR.direction[d] || d; })(first(trend, ['direction']) || first(r, ['trend_direction']) || 'Insufficient History'), ...(trend.projection !== undefined ? { projection: adaptProjection(trend.projection) } : {}) },
    responsible_bodies: list(first(r, ['responsible_bodies', 'responsible_government_body'])).flatMap(adaptBody),
    corrective_actions: list(first(r, ['corrective_actions', 'corrective_action'])),
    sources: list(first(r, ['sources', 'source_links', 'source'])).map(adaptSource),
    change_type: (function (c) { return NEAR.change_type[c] || c; })(first(r, ['change_type', 'change']) || 'new'),
    revision: first(r, ['revision', 'record_revision']) || 1,
  };
}

// Returns { feed } in site-contract shape, or { error } when the envelope is unusable.
export function adaptAgentFeed(f, latest) {
  const runDate = day(f.run_date) || day(f.generated_at) || day((f.research_window || {}).end);
  const cov = f.coverage || {};
  const dw = cov.date_window || f.research_window || {};
  const mode = f.mode || 'snapshot';
  const incoming = (f.records || []).map(adaptRecord);

  let records = incoming;
  let tombstones = list(f.tombstones);
  if (mode === 'incremental') {
    if (!latest) return { error: 'Incremental update received but no feed has been published yet; send a snapshot first.' };
    const byId = new Map((latest.records || []).map((r) => [r.id, r]));
    for (const r of incoming) byId.set(r.id, r);
    for (const t of tombstones) if (t && t.id) byId.delete(t.id);
    records = [...byId.values()];
    tombstones = [...list(latest.tombstones), ...tombstones];
  }

  const coverage = {
    date_range: dw.start && dw.end ? `${dw.start} to ${dw.end}` : undefined,
    searched_geography: cov.searched_geography,
    categories: list(cov.categories).map((c) => (typeof c === 'string' ? { slug: categorySlug(c), researched: true } : { ...c, slug: categorySlug(c.slug || c.name || c.category), researched: c.researched !== false })),
    unverified_fields: list(cov.missing_fields).map(String),
    gaps: [...list(cov.source_limitations), ...list(cov.notes)].map((x) => (typeof x === 'string' ? x : JSON.stringify(x))),
    exhaustive: cov.exhaustive,
    scope_limits: cov.scope_limits,
    baseline_note: cov.baseline_note,
    regions_researched: [...new Set([...list((latest && latest.coverage || {}).regions_researched), ...list(cov.regions_researched)].map(seaCode).filter((x) => SEAS[x]))].sort(),
    statement: cov.statement || (cov.exhaustive === false ? 'This is a ranked set of discoverable, reported, or officially documented issues, not a census of every problem in the world ocean. Low coverage or missing public records do not prove the absence of an issue.' : undefined),
  };

  // Incremental updates keep the live run's report link and coverage detail unless the agent sends new ones.
  if (mode === 'incremental' && latest && latest.coverage) {
    const lc = latest.coverage;
    for (const k of ['date_range', 'unverified_fields', 'gaps', 'scope_limits', 'baseline_note', 'statement']) {
      const v = coverage[k];
      if (v === undefined || (Array.isArray(v) && !v.length)) coverage[k] = lc[k];
    }
    if (!coverage.categories.length) coverage.categories = lc.categories;
  }
  const sourceReport = f.source_report || (mode === 'incremental' && latest ? latest.source_report : undefined);

  const feed = {
    feed_name: 'ocean-issues',
    schema_version: `agent-${f.schema_version}`,
    generated_at: f.generated_at,
    source_feed: { feed_name: f.feed_name, schema_version: f.schema_version, run_id: f.run_id, mode, cursor: f.cursor, next_cursor: f.next_cursor },
    source_report: sourceReport,
    run: {
      mode,
      run_id: f.run_id,
      run_date: runDate,
      research_start: dw.start,
      research_end: dw.end,
      prior_run_date: latest && latest.run ? latest.run.run_date : null,
      revision: ((latest && latest.run && latest.run.revision) || 0) + 1,
    },
    filters_applied: f.filters_applied || {},
    summary: f.summary && Object.keys(f.summary).length ? f.summary : latest && mode === 'incremental' ? latest.summary : undefined,
    category_notes: f.category_notes || (mode === 'incremental' && latest ? latest.category_notes : undefined),
    // Ocean indicators (contract 1.1.0, not yet validated or shown) are refreshed monthly; a run without them keeps the live ones.
    indicators: f.indicators || (latest ? latest.indicators : undefined),
    milestones: f.milestones || (mode === 'incremental' && latest ? latest.milestones : undefined),
    records,
    corrections: [...(mode === 'incremental' && latest ? list(latest.corrections) : []), ...list(f.corrections)],
    tombstones,
    coverage,
    errors: list(f.errors),
  };
  return { feed };
}
