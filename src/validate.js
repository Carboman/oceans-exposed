// Feed validation shared by the Worker publish endpoint, the research tools and tools/site-check.mjs.
import { validateLocation } from './geo.js';
import { COMPONENTS, CATEGORY_SLUGS, LAYERS } from './model.js';

const RUN_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateFeed(f) {
  const p = [];
  if (!f || typeof f !== 'object') return ['Feed must be a JSON object.'];
  if (!f.feed_name) p.push('feed_name is required.');
  if (!f.schema_version) p.push('schema_version is required.');
  if (!f.run || !RUN_DATE.test(f.run.run_date || '')) p.push('run.run_date (YYYY-MM-DD) is required.');
  if (!Array.isArray(f.records)) p.push('records must be an array.');
  if (!f.coverage) p.push('coverage is required.');
  const seen = new Set();
  (f.records || []).forEach((r, i) => {
    const at = `records[${i}]`;
    if (!r || !r.id) { p.push(`${at}.id is required.`); return; }
    if (seen.has(r.id)) p.push(`${at}: duplicate id ${r.id}.`);
    seen.add(r.id);
    const c = (r.severity || {}).components;
    if (!c) p.push(`${r.id}: severity.components is required.`);
    else for (const k of COMPONENTS) {
      if (![0, 1, 2].includes(c[k])) p.push(`${r.id}: severity.components.${k} must be 0, 1 or 2.`);
    }
    if (!r.primary_category) p.push(`${r.id}: primary_category is required.`);
    else if (!CATEGORY_SLUGS.includes(r.primary_category)) p.push(`${r.id}: primary_category must be one of ${CATEGORY_SLUGS.join(', ')}.`);
    if (!r.issue_layer) p.push(`${r.id}: issue_layer is required.`);
    else if (!LAYERS.includes(r.issue_layer)) p.push(`${r.id}: issue_layer must be one of ${LAYERS.join(', ')}.`);
    if (!Array.isArray(r.sources) || !r.sources.some((s) => s && /^https?:\/\//.test(s.url || '') && (s.date || s.accessed))) p.push(`${r.id}: at least one http(s) source with a date or accessed date is required.`);
    (r.sources || []).forEach((s, i) => { if (s && s.accessed && !/^\d{4}-\d{2}-\d{2}$/.test(s.accessed)) p.push(`${r.id}: sources[${i}].accessed must be YYYY-MM-DD.`); });
    (r.sources || []).forEach((s, i) => { if (s && s.date !== undefined && s.date !== null && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(String(s.date))) p.push(`${r.id}: sources[${i}].date must be YYYY, YYYY-MM, YYYY-MM-DD or null (never "None" or an empty string).`); });
    (r.responsible_bodies || []).forEach((b, i) => { if (b && b.contact !== undefined && b.contact !== null && !/^https?:\/\//.test(String(b.contact))) p.push(`${r.id}: responsible_bodies[${i}].contact must be an http(s) URL or null (never an empty string).`); });
    (r.measures || []).forEach((m, i) => { if (m && typeof m.value === 'number' && (typeof m.unit !== 'string' || !m.unit)) p.push(`${r.id}: measures[${i}].unit is required when value is a number.`); });
    p.push(...validateLocation(r));
  });
  return p;
}
