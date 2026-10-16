// Network cross-reference fields on a record (earth.exposed network contract 1.2.0; plan:
// docs/CROSS_REFERENCE_PLAN.md in Carboman/earth-exposed). All three are optional:
//   network_tags  keys from the hub's registry (network/tags.json): events "EV-YYYY-..." and topics "lower-case"
//   shared_ids    public identifiers copied from the source (EPA FRS, EIA plant or utility, PWSID, IAEA reactor,
//                 court docket, county FIPS); the hub joins findings on different sites that share one
//   cross_refs    links to findings on other network sites; a cause (causes, caused-by) carries the source that
//                 states it and a one-line basis, or it is not a cause
// The same file is vendored by every site; keep the copies identical.
export const RELATIONS = ['same-event', 'causes', 'caused-by', 'same-facility', 'same-policy', 'supersedes'];
export const CAUSAL = ['causes', 'caused-by'];
export const SHARED_ID_KEYS = ['epa_frs', 'eia_plant', 'eia_utility', 'pwsid', 'iaea_reactor', 'court_docket', 'fips'];
const TAG = /^(EV-\d{4}-[A-Z0-9-]+|[a-z0-9-]+)$/;
const HOST = /^[a-z0-9-]+\.exposed$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\/[^\s"'<>]+$/;

export function validateNetworkFields(r, self, { allowRefs = true } = {}) {
  const p = [], id = (r && r.id) || 'record';
  if (r.network_tags !== undefined && (!Array.isArray(r.network_tags) || r.network_tags.length > 10 || r.network_tags.some((t) => typeof t !== 'string' || !TAG.test(t)))) p.push(`${id}: network_tags must be up to 10 registry keys (EV-YYYY-NAME or lower-case-topic).`);
  if (r.shared_ids !== undefined) {
    if (!r.shared_ids || typeof r.shared_ids !== 'object' || Array.isArray(r.shared_ids)) p.push(`${id}: shared_ids must be an object.`);
    else for (const [k, v] of Object.entries(r.shared_ids)) {
      if (!SHARED_ID_KEYS.includes(k)) p.push(`${id}: shared_ids.${k} is not one of ${SHARED_ID_KEYS.join(', ')}.`);
      else if (!Array.isArray(v) || !v.length || v.length > 20 || v.some((x) => typeof x !== 'string' || !x || x.length > 60)) p.push(`${id}: shared_ids.${k} must be an array of 1 to 20 strings.`);
    }
  }
  if (r.cross_refs !== undefined) {
    if (!allowRefs) p.push(`${id}: cross_refs are not used on this site yet.`);
    else if (!Array.isArray(r.cross_refs) || r.cross_refs.length > 20) p.push(`${id}: cross_refs must be an array of up to 20 links.`);
    else r.cross_refs.forEach((x, i) => {
      const at = `${id}: cross_refs[${i}]`;
      if (!x || typeof x !== 'object') return p.push(`${at} must be an object.`);
      if (typeof x.site !== 'string' || !HOST.test(x.site) || x.site === self) p.push(`${at}.site must be another network site, like "energy.exposed".`);
      if (typeof x.id !== 'string' || !x.id) p.push(`${at}.id is required.`);
      if (!RELATIONS.includes(x.relation)) p.push(`${at}.relation must be one of ${RELATIONS.join(', ')}.`);
      const cause = CAUSAL.includes(x.relation);
      if (cause || x.source !== undefined) {
        const s = x.source || {};
        if (typeof s.name !== 'string' || s.name.length < 3 || !HTTPS.test(s.url || '') || !DAY.test(s.date || '')) p.push(`${at}.source needs name, https url and date (YYYY-MM-DD)${cause ? ': a cause is recorded only with the source that states it' : ''}.`);
      }
      if ((cause || x.basis !== undefined) && (typeof x.basis !== 'string' || x.basis.length < 10 || x.basis.length > 200)) p.push(`${at}.basis must be 10 to 200 characters saying what the source states.`);
    });
  }
  return p;
}

// The site's /network/links.json: every public record that carries a tag, a shared ID or a cross-reference.
// date = earliest source date (when the issue was first reported); place from the record's location.
export function networkLinks(records, { site, findingUrl, place, level, extraIds }, now = new Date()) {
  const findings = [];
  for (const r of records) {
    const ids = {};
    for (const [k, v] of Object.entries(r.shared_ids || {})) if (SHARED_ID_KEYS.includes(k) && Array.isArray(v) && v.length) ids[k] = v.map(String).slice(0, 20);
    if (extraIds) for (const [k, v] of Object.entries(extraIds(r) || {})) if (v.length) ids[k] = [...new Set([...(ids[k] || []), ...v])].slice(0, 20);
    const tags = (r.network_tags || []).filter((t) => TAG.test(t)).slice(0, 10);
    const refs = (r.cross_refs || []).filter((x) => x && HOST.test(x.site || '') && x.site !== site && RELATIONS.includes(x.relation))
      .map((x) => ({ site: x.site, id: String(x.id), relation: x.relation, ...(x.source ? { source: { name: x.source.name, url: x.source.url, date: x.source.date } } : {}), ...(x.basis ? { basis: x.basis } : {}) }))
      .filter((x) => !CAUSAL.includes(x.relation) || (x.source && x.basis)).slice(0, 20);
    if (!tags.length && !refs.length && !Object.keys(ids).length) continue;
    const dates = (r.sources || []).map((s) => String((s && s.date) || '').slice(0, 10)).filter((d) => DAY.test(d)).sort();
    const f = { id: r.id, title: String(r.title || r.id).slice(0, 200), url: findingUrl(r) };
    if (dates[0]) f.date = dates[0];
    const lv = level && level(r); if (lv) f.level = lv;
    const pl = place && place(r); if (pl && Object.keys(pl).length) f.place = pl;
    if (tags.length) f.tags = tags;
    if (Object.keys(ids).length) f.ids = ids;
    if (refs.length) f.refs = refs;
    findings.push(f);
  }
  return { schema: 'earth.exposed/network-links/1', site, generated_at: now.toISOString().replace(/\.\d{3}Z$/, 'Z'), findings: findings.slice(0, 5000) };
}
