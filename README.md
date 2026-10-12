# earth.exposed

https://earth.exposed is the hub of the .exposed network of facts-only public-data sites (water.exposed,
waste.exposed, oceans.exposed, and more to come): one tile per site with a headline fact, its named public source and
the date it was pulled; one shared map; the network's standards, methodology and sources. Tagline: "Public data,
mapped. No opinions."

Served by a Cloudflare Worker with static assets (the same pattern as the sites). The hub holds no research of its
own: a scheduled Action fetches each site's `/network/stats.json` and `/network/layer.geojson`, validates them, and
commits the snapshot to `public/data/`. The plan it follows is `docs/PLAN.md`.

## Layout

```
src/worker.js            /api/network/* from the committed snapshot; optional analytics beacon injection
src/validate.js          Contract validation (shared by the refresh, the site check and the tests)
src/states.js            FIPS to state codes (adapters and the map)
public/                  Static pages served by the assets binding
  index.html             Tiles, status strip
  map.html               Shared map (d3 + topojson from cdnjs; Natural Earth land; us-atlas state centroids)
  standards.html, methodology.html, sources.html, about.html, 404.html
  assets/                styles.css, app.js, map.js, data/ (land-110m.json, states-10m.json)
  data/snapshot.json     Last good stats per site (written by tools/refresh.mjs, committed)
  data/layers/*.geojson  Last good map layer per site
  network/chrome/        Generated shared header, footer and CSS, per version and latest (the sites vendor these)
network/                 Source of truth for the shared chrome and the site registry (sites.json)
contract/                network-stats.schema.json, network-layer.schema.json, VERSION, CHANGELOG.md
tools/refresh.mjs        Fetch, validate, snapshot (last good copy kept; stale marked with its date)
tools/adapters.mjs       Interim: derive a site's stats and layer from its public API until it ships the files
tools/chrome.mjs         Generate the shared chrome and inject it into the hub pages (--check in CI)
tools/site-check.mjs     Pre-deploy checks: no company or credit mentions, sourced snapshot, pinned scripts, chrome current
tests/                   node --test
docs/                    PLAN.md, NETWORK_STATS_SPEC.md, CHILD_SITE_NOTE.md, AUTO_DEPLOY_SETUP.md, OPERATIONS.md
.github/workflows/       deploy.yml, refresh.yml (03:17 and 19:17 UTC), bootstrap.yml (one-off)
```

## Commands

```
npm run check      site check + tests
npm run chrome     regenerate the shared chrome after editing network/
npm run refresh    fetch the live sites and rewrite public/data/
npm run dev        http://localhost:8788
```

## Moving to its own repository

This tree was built inside `Carboman/oceans-exposed` (branch `earth-exposed/hub`, folder `earth-exposed/`). Once
`Carboman/earth-exposed` exists, from a checkout of oceans-exposed:

```
git fetch origin earth-exposed/hub
git subtree split --prefix earth-exposed origin/earth-exposed/hub -b earth-exposed-main
git push https://github.com/Carboman/earth-exposed.git earth-exposed-main:main
```

Then follow `docs/AUTO_DEPLOY_SETUP.md`.
