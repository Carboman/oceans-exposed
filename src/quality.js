// Content-quality checks for a run, compared with the feed that was live before it (pure: no Node APIs).
// Shared by the Worker (POST /api/ocean/validate), tools/publish-run.mjs and tools/quality-check.mjs.
// Warnings never block publishing.
import { isAgentFeed, adaptAgentFeed } from './adapt.js';
import { mappability, seasOf, seaName } from './geo.js';
import { COMPONENTS } from './model.js';

const GENERIC_TYPE = /(regional issue|sea, reef, or|water body, or|^issue$|^n\/?a$|^unknown$|^ocean$|^sea$)/i;
const NAME_MAX = 60;
// Run-housekeeping vocabulary that must never appear in the public executive summary.
export const PROCESS_NOTES = /\b(research process(es)?|reconcil\w*|duplicate ids?|merged into|data-quality|warnings? (repair|fix)|cell completion|cells? (complete|incomplete|remain)|staging|commit\w*|publish\w*|run id|this run|prior run|feed\.json|schema|tombstones?|instructions? version)\b/i;
const total = (r) => COMPONENTS.reduce((s, k) => s + (Number(((r.severity || {}).components || {})[k]) || 0), 0);

// Convert an agent feed exactly as the Worker will, so checks see what the site will show.
export function normalize(raw, prev) {
  if (isAgentFeed(raw)) { const { feed, error } = adaptAgentFeed(raw, prev); if (error) throw new Error(error); return feed; }
  return raw;
}

export function checkRun(feed, prev, opts = {}) {
  const recs = feed.records || [];
  const P = new Map(((prev && prev.records) || []).map((r) => [r.id, r]));
  const mode = (feed.run && feed.run.mode) || (feed.source_feed && feed.source_feed.mode) || 'snapshot';
  const touched = opts.touchedIds ? recs.filter((r) => opts.touchedIds.has(r.id)) : recs; // incremental: only judge sent records
  const W = [];
  const add = (rule, title, message, ids = [], fix = '') => W.push({ rule, title, message, ids, fix });

  // 1. Severity notes: present and evidence-specific
  const blank = touched.filter((r) => { const n = (r.severity || {}).notes || {}; return COMPONENTS.some((k) => !String(n[k] || '').trim()); });
  if (blank.length) add('notes-missing', 'Missing severity explanations', `${blank.length} finding(s) have one or more blank severity.notes, so their dossiers show scores with no explanation.`, blank.map((r) => r.id),
    'Give every component a note stating the cited fact behind that score, e.g. "NOAA Coral Reef Watch recorded Bleaching Alert Level 2 over 80% of the reef in March 2026 [1]".');
  const sets = new Map();
  touched.forEach((r) => { const n = (r.severity || {}).notes || {}; if (COMPONENTS.every((k) => String(n[k] || '').trim())) { const key = JSON.stringify(COMPONENTS.map((k) => n[k])); (sets.get(key) || sets.set(key, []).get(key)).push(r.id); } });
  const groups = [...sets.values()].filter((ids) => ids.length >= 3);  // one warning for all groups, not one per group
  if (groups.length) add('notes-boilerplate', 'Boilerplate severity explanations', `${groups.reduce((n, g) => n + g.length, 0)} findings in ${groups.length} group(s) share an identical set of severity notes (largest group: ${Math.max(...groups.map((g) => g.length))}).`, groups.flat(), 'Write notes specific to each finding\'s evidence; never reuse one note set across findings.');
  const perNote = new Map();
  touched.forEach((r) => COMPONENTS.forEach((k) => { const t = String(((r.severity || {}).notes || {})[k] || '').trim(); if (t.length > 25) (perNote.get(t) || perNote.set(t, new Set()).get(t)).add(r.id); }));
  const reused = [...perNote.entries()].filter(([, s]) => s.size >= 4);
  if (reused.length) add('notes-template', 'Templated severity notes', `${reused.length} note sentence(s) are repeated across 4+ findings, e.g. "${reused[0][0].slice(0, 90)}".`, [...new Set(reused.flatMap(([, s]) => [...s]))], 'Replace templated sentences with each finding\'s own evidence.');

  const noDesc = touched.filter((r) => !String(r.description || '').trim());
  if (noDesc.length) add('description-missing', 'Missing descriptions', `${noDesc.length} finding(s) have an empty description, so their dossiers and cards show no summary.`, noDesc.map((r) => r.id),
    'Write a 2-3 sentence public-safe summary for every finding (contract requires a non-empty description).');

  // 2. Location type specific
  const generic = touched.filter((r) => GENERIC_TYPE.test(String((r.location || {}).type || '').trim()) || !String((r.location || {}).type || '').trim());
  if (generic.length) add('location-type-generic', 'Generic location type', `${generic.length} finding(s) use a placeholder location.type such as "${(generic[0].location || {}).type || '(blank)'}".`, generic.map((r) => r.id),
    'Use a specific type: "Coral reef system", "Fish stock", "Marine protected area", "Port", "Offshore lease area", "Coastal city", "Exclusive economic zone", "Treaty process"...');

  // 3. Names: short and stable
  const longNames = touched.filter((r) => String((r.location || {}).name || '').length > NAME_MAX);
  if (longNames.length) add('name-long', 'Location names too long', `${longNames.length} location.name value(s) exceed ${NAME_MAX} characters (they truncate in charts and the issue panel).`, longNames.map((r) => r.id),
    'Keep location.name to the reef, stock, place, facility or sea; move country and regional context to location.detail.');
  const renamed = touched.filter((r) => P.has(r.id) && (P.get(r.id).location || {}).name && (P.get(r.id).location || {}).name !== (r.location || {}).name);
  if (renamed.length) add('name-changed', 'Finding names changed', `${renamed.length} existing finding(s) were renamed, e.g. "${P.get(renamed[0].id).location.name}" -> "${renamed[0].location.name}".`, renamed.map((r) => r.id),
    'Keep a finding\'s location.name stable across runs unless the underlying place or stock changed.');

  // 4. Carry forward analysis
  const reset = touched.filter((r) => { const a = (P.get(r.id) || {}).trend || {}; const b = r.trend || {}; return P.has(r.id) && a.direction && a.direction !== 'Insufficient History' && b.direction === 'Insufficient History' && !b.note; });
  if (reset.length) add('trend-reset', 'Evidence-based trends reset', `${reset.length} finding(s) had a trend (e.g. ${(P.get(reset[0].id).trend || {}).direction}) that was reset to "Insufficient History" with no explanation.`, reset.map((r) => r.id),
    'Carry forward the prior trend and projection unless new evidence changes them; if you change it, add trend.note explaining why.');
  const lostProj = touched.filter((r) => P.has(r.id) && ((P.get(r.id).trend || {}).projection) && !((r.trend || {}).projection));
  if (lostProj.length) add('projection-dropped', 'Projections dropped', `${lostProj.length} finding(s) lost their projection.`, lostProj.map((r) => r.id), 'Keep prior projections unless new evidence invalidates them.');
  if (prev && mode === 'snapshot') {
    const titles = new Set((feed.milestones || []).map((m) => m.title));
    const lostM = (prev.milestones || []).filter((m) => !titles.has(m.title));
    if (lostM.length) add('milestones-dropped', 'Milestones dropped', `${lostM.length} milestone(s) from the prior run are missing: ${lostM.map((m) => `"${m.title}"`).join(', ')}.`, [], 'Copy milestones forward from the live feed in each snapshot.');
    const ids = new Set(recs.map((r) => r.id)), tomb = new Set((feed.tombstones || []).map((t) => t.id));
    const lostR = [...P.keys()].filter((id) => !ids.has(id) && !tomb.has(id));
    if (lostR.length) add('records-dropped', 'Findings disappeared without a tombstone', `${lostR.length} finding(s) live before this snapshot are missing and have no tombstone.`, lostR, 'A snapshot must include every current finding; use tombstones for merged or removed ones.');
  }

  // 5. Score changes need a history note
  const rescored = touched.filter((r) => P.has(r.id) && total(P.get(r.id)) !== total(r) && !(r.history || []).some((h) => h.date === (feed.run || {}).run_date && h.note));
  if (rescored.length) add('rescored-silently', 'Scores changed without a history note', `${rescored.length} finding(s) changed severity score with no history entry for this run.`, rescored.map((r) => r.id), 'Append a history entry {date, status, score, note} explaining the change.');

  // 6. Balance
  if (recs.length >= 10) {
    const c = {}; recs.forEach((r) => seasOf(r).forEach((s) => { c[s] = (c[s] || 0) + 1; }));
    const [top, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0] || [];
    const notes = JSON.stringify(((feed.coverage || {}).notes || [])).toLowerCase() + JSON.stringify((feed.coverage || {}).gaps || []).toLowerCase();
    if (top && n / recs.length > 0.5) add('balance', 'One sea dominates the global feed', `${n} of ${recs.length} findings (${Math.round(n / recs.length * 100)}%) involve ${seaName(top)} (${top}).` + (notes.includes(top.toLowerCase()) || notes.includes(seaName(top).toLowerCase()) || /batch|in progress|in-depth pass/.test(notes) ? ' The coverage notes acknowledge a pass in progress.' : ' The coverage notes do not explain this.'), [],
      'Explain single-sea passes in coverage.notes, and keep mode "incremental" so global records keep their analysis.');
  }
  // 6a. The executive summary is public prose about the ocean, not run housekeeping
  const sm = feed.summary || {};
  const smText = [sm.highest_risk, sm.directional_picture, ...((sm.cross_cutting || []).map((c) => c && c.text))].filter(Boolean).join(' ');
  if (PROCESS_NOTES.test(smText)) add('summary-process-notes', 'Executive summary contains run housekeeping', `summary.highest_risk / directional_picture read as notes about the run ("${(smText.match(PROCESS_NOTES) || [''])[0]}"...). The site hides the executive summary when this happens.`, [],
    'Write the summary for the public: which findings carry the highest risk and which way the global picture is moving. Never mention runs, merges, duplicate IDs, reconciliation, warnings, cells or publishing.');

  // 6b. Sourcing: no finding rests only on a dataset or dashboard
  const DATASET = /(dashboard|dataset|data portal|database|watch|monitor|index|atlas|tracker|explorer)\b/i;
  const dataOnly = touched.filter((r) => (r.sources || []).length && (r.sources || []).every((s) => s && !s.date && (DATASET.test(String(s.basis || '')) || DATASET.test(String(s.title || '')))));
  if (dataOnly.length) add('sources-dataset-only', 'Findings sourced only from datasets or dashboards', `${dataOnly.length} finding(s) cite only undated database or dashboard lookups.`, dataOnly.map((r) => r.id),
    'Add at least one dated report, agency page, court record or news article about the specific issue.');

  // 7. Location geometry
  const unmapped = touched.filter((r) => mappability(r) === 'none');
  if (unmapped.length) add('location-unmappable', 'Findings cannot be placed on the sea map', `${unmapped.length} finding(s) have no coordinates, no sea and no area extent, so the map can only list them.`, unmapped.map((r) => r.id),
    'Add location.sea (or seas) and, where a public source gives it, location.coordinates {lat, lon, precision}; use location.extent basin or global for open-ocean and global issues.');
  const tileOnly = touched.filter((r) => mappability(r) === 'sea');
  if (tileOnly.length >= 5 && tileOnly.length / Math.max(touched.length, 1) > 0.5) add('location-approximate', 'Most findings are placed only by sea', `${tileOnly.length} finding(s) have no coordinates, so they appear only on their sea tile.`, tileOnly.map((r) => r.id),
    'Add location.coordinates with precision "exact", "site" or "city" where a public source gives the location.');
  return W;
}

export function toMarkdown(label, feed, warnings, prevLabel) {
  const r = feed.run || {};
  let md = `## Data-quality warnings: run \`${label}\`\n\n`;
  md += `Run ${r.run_id || ''} · run date ${r.run_date || ''} · ${(feed.records || []).length} findings · compared with ${prevLabel || 'no prior run'}.\n\n`;
  if (!warnings.length) return md + 'No warnings. ✅\n';
  md += `The run **was published**; these do not block publication. Fix them in the next run (see \`docs/RESEARCH.md\` → "Quality bar").\n\n`;
  md += '| # | Warning | Detail | Findings |\n|---|---|---|---|\n';
  warnings.forEach((w, i) => { md += `| ${i + 1} | **${w.title}** | ${w.message.replace(/\|/g, '\\|')} | ${w.ids.length || '—'} |\n`; });
  md += '\n### How to fix\n\n';
  warnings.forEach((w, i) => {
    md += `**${i + 1}. ${w.title}** (\`${w.rule}\`): ${w.fix}\n`;
    if (w.ids.length) md += `<details><summary>${w.ids.length} finding id(s)</summary>\n\n${w.ids.map((id) => '- `' + id + '`').join('\n')}\n\n</details>\n`;
    md += '\n';
  });
  return md;
}

// GitHub Actions annotations (capped so the log stays readable).
export function annotate(label, warnings) {
  warnings.forEach((w) => console.log(`::warning title=${label}: ${w.title}::${w.message}${w.ids.length ? ' IDs: ' + w.ids.slice(0, 6).join(', ') + (w.ids.length > 6 ? ` (+${w.ids.length - 6} more)` : '') : ''}`));
}
