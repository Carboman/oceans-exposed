// earth.exposed: network hub Worker.
// Static pages come from ./public through the assets binding. This Worker answers /api/network/* from the committed
// snapshot (public/data/snapshot.json, written by tools/refresh.mjs) and, when CF_BEACON_TOKEN is set, injects the
// Cloudflare Web Analytics beacon into HTML pages. No storage, no secrets, no write endpoints.

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method !== 'GET' && request.method !== 'HEAD') return error(405, 'method_not_allowed', 'Read-only endpoint.');
    try {
      if (path.startsWith('/api/')) return await api(request, env, path);
      const res = await env.ASSETS.fetch(request);
      return maybeBeacon(res, env);
    } catch (err) {
      console.error(err);
      return error(500, 'internal_error', 'Unexpected server error.');
    }
  },
};

async function asset(env, request, p) {
  const u = new URL(request.url); u.pathname = p; u.search = '';
  return env.ASSETS.fetch(new Request(u.toString(), { method: 'GET', headers: request.headers }));
}

async function api(request, env, path) {
  if (path === '/api/network/summary' || path === '/api/network/summary.json') {
    const res = await asset(env, request, '/data/snapshot.json');
    if (!res.ok) return error(503, 'snapshot_unavailable', 'No snapshot has been committed yet.');
    return new Response(res.body, { headers: { ...JSON_HEADERS, etag: res.headers.get('etag') || '' } });
  }
  if (path === '/api/network/sites' || path === '/api/network/sites.json') {
    const res = await asset(env, request, '/data/snapshot.json');
    const snap = res.ok ? await res.json() : { sites: {} };
    const sites = Object.values(snap.sites || {}).map((s) => ({ id: s.id, site: s.site, url: s.stats && s.stats.url, tagline: s.stats && s.stats.tagline, status: s.status, origin: s.origin, last_run: s.stats && s.stats.last_run, fetched_at: s.fetched_at, stale_since: s.stale_since || null }));
    return new Response(JSON.stringify({ network: snap.network || null, generated_at: snap.generated_at || null, sites }), { headers: JSON_HEADERS });
  }
  const m = path.match(/^\/api\/network\/layers\/([a-z0-9-]+)(?:\.geojson)?$/);
  if (m) {
    const res = await asset(env, request, `/data/layers/${m[1]}.geojson`);
    if (!res.ok) return error(404, 'not_found', `No layer ${m[1]}.`);
    return new Response(res.body, { headers: { ...JSON_HEADERS, 'content-type': 'application/geo+json; charset=utf-8' } });
  }
  return error(404, 'not_found', 'Unknown endpoint. See https://earth.exposed/methodology#api');
}

function maybeBeacon(res, env) {
  const token = (env.CF_BEACON_TOKEN || '').trim();
  if (!token || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) return res;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return res;
  const tag = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${token}"}'></script>`;
  return new HTMLRewriter().on('body', { element(el) { el.append(tag, { html: true }); } }).transform(res);
}

function error(status, code, message) {
  return new Response(JSON.stringify({ error: code, message }), { status, headers: { ...JSON_HEADERS, 'cache-control': 'no-store' } });
}
