// oceans.exposed — API + report Worker.
// Static pages are served from ./public by the assets binding; this Worker handles
// /api/*, /internal/* and /reports/* (see run_worker_first in wrangler.jsonc).
//
// R2 layout (binding OCEAN_REPORTS):
//   feeds/latest.json              current feed (site contract, docs/FEED_SPEC.md)
//   feeds/runs/<run_date>[-N].json versioned snapshot per publish (-2, -3... for later runs the same day)
//   reports/<file>.pdf             human-readable dossiers

import { validateFeed } from './validate.js';
import { isAgentFeed, adaptAgentFeed } from './adapt.js';
import { checkRun } from './quality.js';
import { score, level } from './model.js';
import { seasOf, basinOf, countriesOf } from './geo.js';
import { networkStats, networkLayer } from './network.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const PUBLIC_CACHE = 'public, max-age=300';
const PDF_NAME = /^[A-Za-z0-9._-]+\.pdf$/;
const RUN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RUN_LABEL = /^\d{4}-\d{2}-\d{2}(-\d+)?$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path.startsWith('/internal/')) return await internal(request, env, path);
      if (path === '/api/ocean/validate') return await validateOnly(request, env);
      if (request.method !== 'GET' && request.method !== 'HEAD') return error(405, 'method_not_allowed', 'Read-only endpoint.');
      if (path.startsWith('/api/ocean')) return await api(request, env, url, path);
      if (path === '/network/stats.json' || path === '/network/layer.geojson') return await network(request, env, url, path);
      if (path.startsWith('/reports/')) return await report(env, path);
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      return error(500, 'internal_error', 'Unexpected server error.');
    }
  },
};

/* ---------------- public read API ---------------- */

async function api(request, env, url, path) {
  const etagIn = request.headers.get('if-none-match');

  if (path === '/api/ocean/runs') {
    const list = await env.OCEAN_REPORTS.list({ prefix: 'feeds/runs/' });
    const runs = list.objects.map((o) => { const label = o.key.slice(11, -5); return { run: label, run_date: label.slice(0, 10), uploaded: o.uploaded, size: o.size }; }).sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1));
    return json({ runs }, PUBLIC_CACHE);
  }

  const runParam = url.searchParams.get('run');
  if (runParam && !RUN_LABEL.test(runParam)) return error(400, 'bad_run', 'run must be YYYY-MM-DD or YYYY-MM-DD-N.');
  const key = runParam ? `feeds/runs/${runParam}.json` : 'feeds/latest.json';
  const obj = await env.OCEAN_REPORTS.get(key);
  if (!obj) return error(404, 'feed_unavailable', runParam ? `No run ${runParam}.` : 'No feed has been published yet.');
  if (etagIn && etagIn === obj.httpEtag) return new Response(null, { status: 304, headers: { etag: obj.httpEtag } });

  if (path === '/api/ocean/feed') {
    return new Response(obj.body, { headers: { ...JSON_HEADERS, 'cache-control': PUBLIC_CACHE, etag: obj.httpEtag, 'access-control-allow-origin': '*' } });
  }

  const feed = await obj.json();
  const records = (feed.records || []).filter((r) => r && r.public !== false);

  if (path === '/api/ocean/issues') {
    const { filters, out } = filterRecords(records, url.searchParams);
    return json({ feed_name: feed.feed_name, schema_version: feed.schema_version, run: feed.run, filters_applied: filters, count: out.length, records: out }, PUBLIC_CACHE, obj.httpEtag);
  }

  const m = path.match(/^\/api\/ocean\/issues\/([A-Za-z0-9._-]+)$/);
  if (m) {
    const rec = records.find((r) => r.id === m[1]);
    if (rec) return json({ run: feed.run, record: rec }, PUBLIC_CACHE, obj.httpEtag);
    const tomb = (feed.tombstones || []).find((t) => t.id === m[1]);
    if (tomb) return json({ run: feed.run, tombstone: tomb }, PUBLIC_CACHE, obj.httpEtag, 410);
    return error(404, 'not_found', `No finding ${m[1]}.`);
  }

  if (path === '/api/ocean/changes') {
    const since = url.searchParams.get('since') || url.searchParams.get('cursor');
    if (since && !RUN_DATE.test(since)) return error(400, 'bad_cursor', 'since/cursor must be YYYY-MM-DD.');
    const changed = records.filter((r) => (r.history || []).some((h) => !since || h.date > since) && r.change_type !== 'unchanged');
    return json({ run: feed.run, since: since || null, next_cursor: feed.run && feed.run.run_date, changes: changed.map((r) => ({ id: r.id, revision: r.revision, change_type: r.change_type, title: r.title, history: r.history })), corrections: feed.corrections || [], tombstones: feed.tombstones || [] }, PUBLIC_CACHE, obj.httpEtag);
  }

  if (path === '/api/ocean/summary') {
    return json({ run: feed.run, summary: summarize(records), indicators: feed.indicators || null, coverage: feed.coverage, source_report: feed.source_report || null }, PUBLIC_CACHE, obj.httpEtag);
  }

  return error(404, 'not_found', 'Unknown endpoint.');
}

function filterRecords(records, p) {
  const filters = {};
  const take = (k) => { const v = p.get(k); if (v) filters[k] = v; return v; };
  const category = take('category'), layer = take('layer'), lvl = take('level'), sea = take('sea'), basin = take('basin'), country = take('country'),
    status = take('status'), risk = take('economic_risk'), trend = take('trend'), q = take('q');
  const minScore = take('min_score');
  const out = records.filter((r) => {
    const s = score(r);
    if (category && r.primary_category !== category) return false;
    if (layer && r.issue_layer !== layer) return false;
    if (lvl && level(s) !== lvl) return false;
    if (sea && !seasOf(r).includes(sea.toUpperCase())) return false;
    if (basin && basinOf(r) !== basin.toUpperCase()) return false;
    if (country && !countriesOf(r).includes(country.toUpperCase())) return false;
    if (status && r.status !== status) return false;
    if (risk && (r.economic_risk || {}).level !== risk) return false;
    if (trend && (r.trend || {}).direction !== trend) return false;
    if (minScore && s < Number(minScore)) return false;
    if (q && !JSON.stringify([r.id, r.title, r.description, r.location]).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).map((r) => ({ ...r, severity_score: score(r), issue_level: level(score(r)) }));
  return { filters, out };
}

function summarize(records) {
  const by = (fn) => records.reduce((m, r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; return m; }, {});
  return {
    total: records.length,
    by_level: by((r) => level(score(r))),
    by_category: by((r) => r.primary_category),
    by_layer: by((r) => r.issue_layer),
    by_trend: by((r) => (r.trend || {}).direction || 'Insufficient History'),
    by_basin: by((r) => basinOf(r) || 'Unknown'),
    by_sea: records.reduce((m, r) => { seasOf(r).forEach((s) => { m[s] = (m[s] || 0) + 1; }); return m; }, {}),
  };
}

/* ---------------- earth.exposed network files ---------------- */

// GET /network/stats.json and /network/layer.geojson: what the network hub reads twice a day (src/network.js).
async function network(request, env, url, path) {
  const obj = await env.OCEAN_REPORTS.get('feeds/latest.json');
  if (!obj) return error(404, 'feed_unavailable', 'No feed has been published yet.');
  const etagIn = request.headers.get('if-none-match');
  const etag = obj.httpEtag.replace(/"$/, '-net"');
  if (etagIn && etagIn === etag) return new Response(null, { status: 304, headers: { etag } });
  const feed = await obj.json();
  const geo = path.endsWith('.geojson');
  const body = geo ? networkLayer(feed, url.origin) : networkStats(feed, url.origin);
  return new Response(JSON.stringify(body), { headers: { 'content-type': (geo ? 'application/geo+json' : 'application/json') + '; charset=utf-8', 'cache-control': PUBLIC_CACHE, etag, 'access-control-allow-origin': '*' } });
}

/* ---------------- public pre-commit validation ---------------- */
// POST /api/ocean/validate with a feed.json body: runs exactly the publish-time conversion, hard validation and
// quality checks against the live feed, and returns them. Writes nothing; needs no token. The research lane calls this
// before staging so a run never fails on publish.
const VALIDATE_MAX_BYTES = 25 * 1024 * 1024;
async function validateOnly(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'content-type' } });
  if (request.method === 'GET') return json({ usage: 'POST the exact feed.json you are about to commit (Content-Type: application/json). Response: {ok, errors[], warnings[], records, run_date, bytes}. Nothing is stored.', max_bytes: VALIDATE_MAX_BYTES }, 'public, max-age=3600');
  if (request.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST.');
  const text = await request.text();
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > VALIDATE_MAX_BYTES) return error(413, 'too_large', `Feed is ${bytes} bytes; the limit is ${VALIDATE_MAX_BYTES}. Use mode "incremental" with only new or changed records.`);
  let raw;
  try { raw = JSON.parse(text); } catch (e) {
    return json({ ok: false, bytes, errors: [{ code: 'invalid_json', message: `Not valid JSON: ${e.message}. If the file is cut off near ${Math.round(bytes / 1024)} KB, your write was truncated; publish an incremental run instead of a full snapshot.` }], warnings: [] }, 'no-store', null, 422);
  }
  const latestObj = await env.OCEAN_REPORTS.get('feeds/latest.json');
  const latest = latestObj ? await latestObj.json() : null;
  const errors = [];
  let feed = raw;
  if (isAgentFeed(raw)) {
    const adapted = adaptAgentFeed(raw, latest);
    if (adapted.error) errors.push({ code: 'invalid_feed', message: adapted.error });
    else feed = adapted.feed;
  }
  if (!errors.length) {
    if (Array.isArray(feed.records) && feed.records.length === 0) errors.push({ code: 'empty_snapshot', message: 'Feed has no records; a snapshot must contain every current finding.' });
    for (const m of validateFeed(feed)) errors.push({ code: 'invalid_feed', message: m });
    const curDate = latest && latest.run && latest.run.run_date;
    if (curDate && feed.run && feed.run.run_date && feed.run.run_date < curDate) errors.push({ code: 'older_run', message: `run date ${feed.run.run_date} is older than the live run ${curDate}.` });
  }
  let warnings = [];
  if (!errors.length) {
    try {
      const touched = isAgentFeed(raw) && raw.mode === 'incremental' ? new Set((raw.records || []).map((r) => r.id || r.finding_id)) : null;
      warnings = checkRun(feed, latest, { touchedIds: touched }).map((w) => ({ rule: w.rule, title: w.title, message: w.message, ids: w.ids.slice(0, 50), id_count: w.ids.length, fix: w.fix }));
    } catch (e) { warnings = [{ rule: 'quality-check-error', title: 'Quality check could not run', message: e.message, ids: [], fix: '' }]; }
  }
  return json({ ok: errors.length === 0, bytes, records: (feed.records || []).length, run_date: feed.run && feed.run.run_date, mode: (feed.run && feed.run.mode) || raw.mode || null, errors, warnings, note: errors.length ? 'Fix every error, then validate again before committing.' : 'Valid. Warnings are published but filed as a data-quality issue; fix them in this run if you can.' }, 'no-store', null, errors.length ? 422 : 200);
}

/* ---------------- reports ---------------- */

async function report(env, path) {
  let name = path.slice('/reports/'.length);
  if (name === 'latest.pdf') {
    const latest = await env.OCEAN_REPORTS.get('feeds/latest.json');
    const file = latest && ((await latest.json()).source_report || {}).file;
    if (!file) return error(404, 'report_unavailable', 'No report has been published yet.');
    name = file;
  }
  if (!PDF_NAME.test(name)) return error(404, 'not_found', 'Unknown report.');
  const obj = await env.OCEAN_REPORTS.get(`reports/${name}`);
  if (!obj) return error(404, 'report_unavailable', 'Report not found.');
  return new Response(obj.body, { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${name}"`, 'cache-control': 'public, max-age=3600', etag: obj.httpEtag } });
}

/* ---------------- authenticated publishing ---------------- */

async function internal(request, env, path) {
  if (!(await authorized(request, env))) return error(401, 'unauthorized', 'Missing or invalid bearer token.');

  // PUT /internal/ocean/reports/<file>.pdf   (body: application/pdf)
  const pm = path.match(/^\/internal\/ocean\/reports\/([^/]+)$/);
  if (pm) {
    if (request.method !== 'PUT') return error(405, 'method_not_allowed', 'Use PUT.');
    if (!PDF_NAME.test(pm[1])) return error(400, 'bad_filename', 'Filename must match [A-Za-z0-9._-]+.pdf');
    const body = await request.arrayBuffer();
    const head = new Uint8Array(body.slice(0, 5));
    if (String.fromCharCode(...head) !== '%PDF-') return error(400, 'not_pdf', 'Body is not a PDF.');
    if (body.byteLength > 50 * 1024 * 1024) return error(413, 'too_large', 'PDF exceeds 50 MB.');
    await env.OCEAN_REPORTS.put(`reports/${pm[1]}`, body, { httpMetadata: { contentType: 'application/pdf' } });
    return json({ ok: true, key: `reports/${pm[1]}`, url: `/reports/${pm[1]}`, bytes: body.byteLength }, 'no-store');
  }

  // POST /internal/ocean/publish   (body: feed JSON, see docs/FEED_SPEC.md)
  if (path === '/internal/ocean/publish') {
    if (request.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST.');
    const params = new URL(request.url).searchParams;
    const dryRun = params.get('dry_run') === '1';
    const rawText = await request.text();
    let feed;
    try { feed = JSON.parse(rawText); } catch { return error(400, 'invalid_json', 'Body must be valid JSON.'); }

    // Archive every authenticated payload as received, before any conversion or validation.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawKey = `feeds/raw/${stamp}${feed && feed.run_id ? '-' + String(feed.run_id).replace(/[^A-Za-z0-9._-]/g, '') : ''}.json`;
    if (!dryRun) await env.OCEAN_REPORTS.put(rawKey, rawText, { httpMetadata: { contentType: 'application/json' } });

    if (isAgentFeed(feed)) {
      const latestObj = await env.OCEAN_REPORTS.get('feeds/latest.json');
      const adapted = adaptAgentFeed(feed, latestObj ? await latestObj.json() : null);
      if (adapted.error) return error(422, 'invalid_feed', adapted.error);
      feed = adapted.feed;
    }
    if (Array.isArray(feed.records) && feed.records.length === 0 && params.get('allow_empty') !== '1') {
      return error(422, 'empty_snapshot', 'Feed has no records; refusing to replace the live site. Add ?allow_empty=1 to publish anyway.');
    }
    const problems = validateFeed(feed);
    if (!problems.length && params.get('allow_older') !== '1') {
      const cur = await env.OCEAN_REPORTS.get('feeds/latest.json');
      const curDate = cur && ((await cur.json()).run || {}).run_date;
      if (curDate && feed.run.run_date < curDate) problems.push(`run.run_date ${feed.run.run_date} is older than the live run ${curDate}; add ?allow_older=1 to replace it anyway.`);
    }
    if (problems.length) return json({ ok: false, errors: problems.map((m) => ({ code: 'invalid_feed', message: m })) }, 'no-store', null, 422);
    if (feed.source_report && feed.source_report.file) {
      const pdf = await env.OCEAN_REPORTS.head(`reports/${feed.source_report.file}`);
      if (!pdf) return error(422, 'report_missing', `Upload reports/${feed.source_report.file} first (PUT /internal/ocean/reports/<file>).`);
      feed.source_report.url = `/reports/${feed.source_report.file}`;
    }
    const body = JSON.stringify(feed);
    let runKey = `feeds/runs/${feed.run.run_date}.json`;
    if (!dryRun) {
      runKey = await snapshotKey(env, feed.run.run_date, body);
      await env.OCEAN_REPORTS.put(runKey, body, { httpMetadata: { contentType: 'application/json' } });
      await env.OCEAN_REPORTS.put('feeds/latest.json', body, { httpMetadata: { contentType: 'application/json' } });
    }
    return json({ ok: true, dry_run: dryRun, converted_from: feed.source_feed ? feed.source_feed.feed_name : null, run_date: feed.run.run_date, revision: feed.run.revision, records: feed.records.length, keys: dryRun ? [] : ['feeds/latest.json', runKey, rawKey] }, 'no-store');
  }

  return error(404, 'not_found', 'Unknown internal endpoint.');
}

// Same content as an existing snapshot for that day -> reuse its key (idempotent re-publish);
// otherwise take the first free key: <date>.json, <date>-2.json, <date>-3.json ...
async function snapshotKey(env, runDate, body) {
  for (let n = 1; n < 100; n++) {
    const key = `feeds/runs/${runDate}${n === 1 ? '' : '-' + n}.json`;
    const existing = await env.OCEAN_REPORTS.get(key);
    if (!existing) return key;
    if ((await existing.text()) === body) return key;
  }
  return `feeds/runs/${runDate}-${Date.now()}.json`;
}

async function authorized(request, env) {
  const secret = env.PUBLISH_TOKEN;
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!secret || !m) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(m[1])), crypto.subtle.digest('SHA-256', enc.encode(secret))]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/* ---------------- helpers ---------------- */

function json(data, cache, etag, status = 200) {
  const headers = { ...JSON_HEADERS, 'cache-control': cache, 'access-control-allow-origin': '*' };
  if (etag) headers.etag = etag;
  return new Response(JSON.stringify(data), { status, headers });
}
function error(status, code, message) {
  return json({ errors: [{ code, message }] }, 'no-store', null, status);
}
