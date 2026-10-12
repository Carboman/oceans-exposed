# Joining the earth.exposed network: implementation note for a site session

Hand this file to a Claude Code session on the site's repository. It adds two public files and the shared chrome.
Nothing here changes the site's data, research lane, branding, navigation or theme. Estimated time: one session.
Reference implementation for the oceans.exposed and water.exposed codebase: branch `earth-exposed/oceans-child` of
`Carboman/oceans-exposed` (`src/network.js`, two routes in `src/worker.js`, the chrome in every page, one site-check
rule).

## 1. The stats file and the map layer

Create `src/network.js` with two pure functions over the site's feed (the same object the Worker reads from R2):

```js
// src/network.js: what this site publishes for the earth.exposed network (docs/NETWORK_STATS_SPEC.md in the hub).
export function networkStats(feed, origin) {
  const records = (feed.records || []).filter((r) => r && r.public !== false);
  const runDate = feed.run.run_date;                       // waste.exposed: String(feed.run_id).slice(0, 10)
  const sources = records.reduce((n, r) => n + (r.sources || []).length, 0);
  const seas = new Set(records.flatMap((r) => seasOf(r))).size;   // water/waste: states
  const src = { name: '<site> data feed (JSON)', url: `${origin}/api/<x>/feed`, date: runDate };
  const today = new Date().toISOString().slice(0, 10);
  return {
    schema: 'earth.exposed/network-stats/1', site: '<site>', url: origin, tagline: '<tagline>', scope: '<one sentence>',
    headline: { text: `${records.length} sourced ... findings across ${seas} ...`, value: records.length, unit: 'findings', source: src, pulled: today },
    facts: [{ text: `${sources} cited sources behind the findings`, value: sources, unit: 'sources', source: src, pulled: today }],
    records: records.length, sources, last_run: runDate, map_layer: `${origin}/network/layer.geojson`,
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}
export function networkLayer(feed, origin) {
  const records = (feed.records || []).filter((r) => r && r.public !== false);
  const features = records.map((r) => {
    const c = (r.location || {}).coordinates;
    const geometry = c && typeof c.lat === 'number' && typeof c.lon === 'number' ? { type: 'Point', coordinates: [c.lon, c.lat] } : null;
    const region = !geometry && /^[A-Z]{2}$/.test(r.location?.state || '') && r.location.state !== 'US' ? { type: 'us-state', code: r.location.state } : undefined;
    if (!geometry && !region) return null;
    const properties = { site: '<site>', id: r.id, title: String(r.title).slice(0, 200), url: `${origin}/dossier.html?id=${encodeURIComponent(r.id)}`, level: level(score(r)).toLowerCase(), category: r.primary_category, date: feed.run.run_date };
    if (region) properties.region = region;
    return { type: 'Feature', geometry, properties };
  }).filter(Boolean);
  return { type: 'FeatureCollection', site: '<site>', generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), features };
}
```

Better headline facts than a count are welcome: a dated figure from a named public body, with its URL. The spec
says what a fact needs. Keep the file free of company names and credit lines; the hub rejects it otherwise.

Routes in `src/worker.js` (before the assets fallback):

```js
if (path === '/network/stats.json' || path === '/network/layer.geojson') {
  const obj = await env.<BUCKET>.get('feeds/latest.json');
  if (!obj) return error(404, 'feed_unavailable', 'No feed has been published yet.');
  const feed = await obj.json();
  const body = path.endsWith('stats.json') ? networkStats(feed, url.origin) : networkLayer(feed, url.origin);
  return new Response(JSON.stringify(body), { headers: { 'content-type': path.endsWith('.geojson') ? 'application/geo+json; charset=utf-8' : 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300', 'access-control-allow-origin': '*', etag: obj.httpEtag } });
}
```

Add `"/network/*"` to `assets.run_worker_first` in `wrangler.jsonc`. For water.exposed with thousands of records,
aggregate the layer to one feature per state (`geometry: null`, `region`, `count`, link to `state.html?s=XX`), as the
hub's adapter does today (`tools/adapters.mjs` in the hub).

Test: `curl -s https://<site>/network/stats.json | node -e '...'` against the hub's validator, or run the hub's
`node tools/refresh.mjs --site <id> --dry-run` from a hub checkout. The hub picks the file up at the next refresh
and the tile changes from "derived by the hub" to "published by the site".

## 2. The shared header and footer

1. Copy `https://earth.exposed/network/chrome/latest/chrome.css` to `public/assets/network-chrome.css` and link it
   in every page's `<head>` before the site's own stylesheet:
   `<link rel="stylesheet" href="assets/network-chrome.css">` (waste.exposed: `/assets/network-chrome.css`).
2. Paste `network-bar.html` as the first child of `<body>` in every page, replacing `{{SITE}}` with the site's host
   (`data-network-site="oceans.exposed"`). The CSS marks the current site from that attribute.
3. Paste `network-footer.html` as the last child of the site's `<footer>`. The site's existing credit line moves
   inside the slot: `<span class="ex-net-slot" data-network-slot="credit">Sponsored by <a href="...">...</a></span>`,
   or stays where it is and the slot stays empty; both pass the site's own site-check as written today, because the
   credit remains inside `<footer>`. **Do not add the credit anywhere else**, and do not change the credit itself
   until the owner decides the network-wide question (hub plan, decision D2).
4. Site-check: add one rule that every page contains `class="ex-net-bar" data-network-chrome="<version>"` and
   `class="ex-net-foot" data-network-chrome="<version>"`, with the version read from the first line of
   `public/assets/network-chrome.css`. Also keep the site's existing rule that the credit appears only in the footer.
5. The bar is 32 px, uses its own tokens and no JavaScript, follows the site's `data-theme` attribute and the system
   preference, hides the tagline under 640 px, and prints nothing.

When the hub publishes a new chrome version, repeat steps 1 to 3 with the new files (the version in the CSS's first
line and in the `data-network-chrome` attributes changes together).

## 3. What not to do

- Do not load the chrome from earth.exposed at page-load time: every site's rule is "external scripts only from
  cdnjs with exact versions", and a site must render with the hub down.
- Do not add the network bar inside the site's own `<header>`; it goes above it.
- Do not put a company name in `stats.json` or `layer.geojson`.
