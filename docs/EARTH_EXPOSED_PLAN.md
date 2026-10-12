# earth.exposed: structure proposal for the network hub

Written 2026-10-12 by Claude Code from the oceans-exposed checkout, after reading oceans-exposed, water-exposed and
waste-exposed. The hub's code is in `earth-exposed/` on the `earth-exposed/hub` branch of this repository until
`Carboman/earth-exposed` exists (section 9). Nothing in this proposal touches a live site.

## 1. Recommendation in short

- **Platform: a Cloudflare Worker with static assets, not Cloudflare Pages.** All three sites are Workers
  (`wrangler.jsonc` with an `assets` binding, `run_worker_first` for `/api/*`, R2 for data, `npx wrangler deploy` from
  the Deploy site Action, `tools/site-check.mjs` before every deploy). Cloudflare now steers new static sites to
  Workers static assets as well, so the brief's "match the existing framework" and "on Cloudflare Pages" conflict;
  the Workers pattern keeps one deploy tool, one check, one bootstrap workflow and one token pattern across the
  network. Pages remains possible (the `public/` folder deploys unchanged), but the nightly refresh and the API
  would then need Pages Functions, a second pattern to maintain. **Owner decision; the build assumes Workers.**
- **The hub is a static site that is rebuilt nightly from the children's stats files.** No R2, no publish token, no
  research lane. A GitHub Action fetches every child's `/network/stats.json` and `/network/layer.geojson`, validates
  them against a schema, commits the snapshot to `public/data/` and deploys. A dead or broken child never blanks the
  hub: its last good snapshot stays, marked with the date it was pulled.
- **Shared header and footer are vendored snippets, not a remote script.** The siblings' rule is "external scripts
  only from cdnjs with exact versions"; loading chrome from earth.exposed would break it and make three sites
  depend on a fourth at page-load time. The hub repository is the source of truth (`network/`), a generator writes
  the per-site snippet, and each site pastes it in (two lines of HTML and one CSS file). A new site in the network
  means one entry in `network/sites.json` and a one-line change on each site.

## 2. Decisions for the owner

| # | Question | Recommendation | Why it is yours |
|---|---|---|---|
| D1 | Workers static assets, or Cloudflare Pages? | Workers (above) | The brief says Pages |
| D2 | **The sponsor credit.** Every child footer carries "Sponsored by Carbotura", enforced by each `tools/site-check.mjs`. The hub brief says no sponsors and no company mentions. | Shared footer with an **optional per-site sponsor slot**: the hub leaves it empty and its site-check fails on any company name; the children keep their credit in the slot. Nothing changes on the children's main branches. | The other way (drop the credit network-wide) changes three site-checks and three footers; only you can decide to remove the credit |
| D3 | Which fact is each site's headline? | Each child names one headline fact with a public source in its stats file. Until a child publishes the file, the hub's adapter derives a count fact from the child's existing summary API (for example "7 sourced findings across 5 regional seas") with the child's public data feed as the named source. No number is typed into the hub by hand. | Headline facts are editorial |
| D4 | Analytics | Cloudflare Web Analytics, no cookies. Enable it in the dashboard (Analytics & Logs → Web Analytics → Add a site → earth.exposed, automatic setup). The Worker can also inject the beacon itself when the variable `CF_BEACON_TOKEN` is set; leave it unset to use the dashboard route. | Needs a dashboard action |
| D5 | Domain | `earth.exposed` apex only, like the siblings (no `www`). | Zone setup |

## 3. Site structure

```
earth.exposed
  /                 Home: tagline, one tile per site (headline fact, named source, source date, pulled date,
                    record count, last run), network status strip (which snapshots are fresh, which are stale)
  /map              One shared map: Natural Earth land (Equal Earth projection), one toggleable layer per site,
                    each point links back to the finding on its site; US-state features placed at state centroids
  /standards        What every site in the network promises (facts only, sourced numbers, neutral language,
                    disagreement shown, no rankings across sites, no sponsors on the hub, privacy)
  /methodology      How the hub works: stats contract, nightly refresh, staleness rule, what the hub never does
  /sources          Every source behind every number currently on the hub, by site, with dates (built from the snapshot)
  /about            The network, how to join it, the code, contact through GitHub (no mailto)
  /api/network/summary.json   The validated snapshot the pages render (CORS open)
  /api/network/sites.json     The site registry (name, URL, tagline, stats URL, status)
  /network/chrome/*           The shared header and footer snippets and CSS, versioned, for the children to vendor
```

Repository (`earth-exposed/` on this branch, later the root of `Carboman/earth-exposed`):

```
src/worker.js              Serves /api/network/*, adds CORS and cache headers, optional analytics beacon injection
public/                    Static pages and assets (served by the assets binding)
  assets/styles.css        Design tokens, light and dark, 16 px phone gutter, no horizontal scroll
  assets/app.js            Renders tiles, status strip and sources from /data/snapshot.json
  assets/map.js            Shared map (d3 7.9.0 + topojson 3.0.2 from cdnjs, Natural Earth land, us-atlas states)
  data/snapshot.json       Last good stats per site, written by the nightly refresh (committed)
  data/layers/<site>.geojson  Last good map layer per site (committed)
network/                   Source of truth for the shared chrome: sites.json, header.html, footer.html, chrome.css
contract/                  network-stats.schema.json, network-layer.schema.json, VERSION, CHANGELOG.md
tools/refresh.mjs          Fetch, validate, snapshot (keeps the last good copy per site; exit code reports failures)
tools/adapters.mjs         Interim adapters: derive stats and a layer from a child's existing summary and issues API
tools/chrome.mjs           Generates the per-site header and footer snippets from network/
tools/site-check.mjs       Pre-deploy checks (section 7)
tests/                     node --test
docs/                      This plan, NETWORK_STATS_SPEC.md, CHILD_SITE_NOTE.md, AUTO_DEPLOY_SETUP.md
.github/workflows/         deploy.yml, refresh.yml (nightly), bootstrap.yml (one-off)
```

## 4. The stats contract (what each child publishes)

Two files at fixed paths on every child site, both `Cache-Control: public, max-age=300` and
`Access-Control-Allow-Origin: *`. Full spec: `earth-exposed/docs/NETWORK_STATS_SPEC.md`, schema in
`earth-exposed/contract/`.

`GET /network/stats.json`

```json
{
  "schema": "earth.exposed/network-stats/1",
  "site": "oceans.exposed",
  "url": "https://oceans.exposed",
  "tagline": "Global Ocean Issues Tracker",
  "scope": "Marine and coastal issues across 32 regional seas and the high seas.",
  "headline": {
    "text": "7 sourced ocean findings across 5 regional seas",
    "value": 7, "unit": "findings",
    "source": { "name": "oceans.exposed data feed (JSON)", "url": "https://oceans.exposed/api/ocean/feed", "date": "2026-10-12" },
    "pulled": "2026-10-12"
  },
  "facts": [ { "text": "...", "value": 0, "unit": "...", "source": { "name": "...", "url": "https://...", "date": "YYYY-MM-DD" }, "pulled": "YYYY-MM-DD" } ],
  "records": 7,
  "sources": 14,
  "last_run": "2026-10-12",
  "map_layer": "https://oceans.exposed/network/layer.geojson",
  "generated_at": "2026-10-12T18:00:00Z"
}
```

Rules: `headline.source.url` must be an `https` URL and `headline.source.date` a real date; the hub shows both
beside the number. `facts` is optional (up to 5), same shape. No field may name a company or a sponsor; the hub's
validator rejects the file if one does (the owner's list in `network/sites.json` → `forbidden_terms`).

`GET /network/layer.geojson`: a GeoJSON FeatureCollection. Each feature is a Point with `properties`
`{ site, id, title, url, level, category, date }`, or has `geometry: null` and `properties.region`
`{ "type": "us-state", "code": "AL" }` for findings known only to a state; the hub places those at the state
centroid. Up to 5,000 features; the hub keeps the file as published.

**What each child adds** (one Worker route each, details and code in `earth-exposed/docs/CHILD_SITE_NOTE.md`):
- oceans.exposed and water.exposed (same codebase): a new `src/network.js` with `networkStats(feed)` and
  `networkLayer(feed)`, two routes in `src/worker.js` under `/network/`, and `/network/*` added to `run_worker_first`.
- waste.exposed: the same two functions on its own feed shape (`findings`, `sources`, `state_profiles`).
- The shared header and footer snippet in every page, and one site-check line that the snippet is present and
  current.

Until a child ships its route, `tools/adapters.mjs` in the hub derives the two files from the child's public
`/api/<x>/summary` and `/api/<x>/issues` (or `/api/waste/feed`), so the hub shows real figures from day one and the
tile says "derived by the hub from the site's public API" until the child's own file takes over.

## 5. Nightly refresh

`refresh.yml` runs at 03:17 UTC (after the children's daily runs: water 09:xx, oceans 09:41, waste in the afternoon,
so the hub shows yesterday's completed runs; a second run at 19:17 UTC catches late publishes).
`node tools/refresh.mjs`:

1. For each site in `network/sites.json`: fetch `stats.json` (10 s timeout), validate against the schema and the
   forbidden-terms list; then fetch `map_layer`, validate, cap at 5,000 features.
2. On success: write the site's entry in `public/data/snapshot.json` with `fetched_at` and `status: "fresh"`, and
   `public/data/layers/<site>.geojson`.
3. On any failure: keep the previous entry and layer, set `status: "stale"`, `stale_since` and `last_error`
   (message only, never the body). The page shows "Last good data: <date>".
4. If anything changed, commit (`Network refresh <date>: N fresh, M stale`) and push; the push deploys through
   Deploy site. A site stale for 3 days or more opens (or comments on) one `network-stale` issue; the issue closes
   when the site is fresh again.

## 6. Shared header and footer

Source of truth: `earth-exposed/network/`. `node tools/chrome.mjs` writes `public/network/chrome/<version>/` with:

- `network-bar.html`: a 32 px strip above the site's own topbar: "earth.exposed" wordmark, "Public data, mapped.
  No opinions.", one link per site with the current one marked (`aria-current="true"`).
- `network-footer.html`: a strip for the bottom of the site's own footer: "Part of the earth.exposed network",
  Standards, Methodology, Sources, and an **optional sponsor slot** (`<span data-network-slot="sponsor"></span>`).
  The hub's generator leaves it empty for the hub; each child keeps its existing credit inside the slot (D2).
- `chrome.css`: self-contained, prefixed `ex-net-`, carries its own light and dark tokens (both
  `prefers-color-scheme` and `[data-theme]`, which all three sites use), 16 px phone gutter, no horizontal scroll,
  no dependency on the site's own tokens or scripts. Pure HTML and CSS; no JavaScript.

How a site adds it (also in `CHILD_SITE_NOTE.md`): copy `chrome.css` to `public/assets/network-chrome.css`, link it
in `<head>`, paste the bar as the first child of `<body>` and the footer strip as the last child of `<footer>`, set
`data-network-site="oceans.exposed"` on the bar, and add one site-check line comparing the vendored snippet's
`data-network-chrome="<version>"` with the current version. A site's own branding, nav, fonts and theme toggle
are untouched; the strip is deliberately quieter than every site's topbar.

## 7. Standards the hub enforces on itself (`tools/site-check.mjs`)

- No company names anywhere in `public/` (the forbidden-terms list), no "sponsor", no advocacy words from a short
  list ("must", "should", "crisis", "urgent", "fight"), no rankings across sites (no "best", "worst", "top" in the
  tiles), no `mailto:`.
- Every page carries the tagline, a canonical URL, the shared bar and footer. The tiles render from the snapshot
  with JavaScript; a `<noscript>` block links to `/api/network/summary.json` so the figures are reachable without it.
- Every number shown on the home page comes from the snapshot and is rendered beside its source name, source URL,
  source date and pulled date; the renderer refuses a fact without a source.
- The only external scripts are d3 7.9.0 and topojson 3.0.2 from cdnjs with exact versions; the only external
  stylesheet is Google Fonts. Placeholders, if any remain, are labeled "Example data".
- Snapshot valid against the schema; no snapshot entry older than 14 days without `status: "stale"`.

## 8. Analytics and privacy

Cloudflare Web Analytics: no cookies, no fingerprinting, no personal data stored, no consent banner needed. The
owner adds the site in the dashboard; with automatic setup Cloudflare injects the beacon at the edge and no code
changes. If the owner prefers the explicit snippet, set the Worker variable `CF_BEACON_TOKEN` (wrangler.jsonc
`vars`, or the dashboard) and `src/worker.js` injects the beacon tag into HTML responses; when unset, the pages
carry no third-party script beyond cdnjs and Google Fonts. The privacy statement on `/standards` says exactly this.

## 9. Owner setup checklist (about 30 minutes, no token ever pasted into chat)

**A. GitHub (5 min).** Create `Carboman/earth-exposed`, empty, same visibility as the siblings. Create the labels
`network-stale`, `claude-task`, `contract-change`. Then, in a Claude Code session on this repository:
`git subtree split --prefix earth-exposed earth-exposed/hub -b earth-exposed-main` and push that branch as `main`
of the new repository (the session does it; the commands are in `earth-exposed/README.md` → Moving to its own
repository).

**B. Cloudflare (10 min).** Add the zone `earth.exposed` to account `a0268f33dbddbfc9ca056d7575f661b3` (or confirm
it is there), with no A, AAAA or CNAME record on the apex. Create the API token exactly as
`docs/AUTO_DEPLOY_SETUP.md` Part 1 here, named `github-actions-earth-exposed`, Zone Resources → `earth.exposed`
only. No R2 permission is needed: the hub has no bucket.

**C. GitHub secret (2 min).** `CLOUDFLARE_API_TOKEN` in the new repository's Actions secrets. That is the only
secret. (`GITHUB_TOKEN` covers the nightly commit and the `network-stale` issue.)

**D. Bootstrap (5 min).** Actions → Bootstrap site → Run workflow: runs the checks, deploys the Worker and the custom
domain, runs the first refresh against the three live sites and commits the snapshot. Then open
https://earth.exposed.

**E. Analytics (3 min).** Dashboard → Analytics & Logs → Web Analytics → Add a site → earth.exposed, automatic.

**F. The children (one session each, after D2 is decided).** Hand `earth-exposed/docs/CHILD_SITE_NOTE.md` to a
session on each site. The oceans-exposed reference implementation is on the `earth-exposed/oceans-child` branch of
this repository; water-exposed gets the same change (same codebase); waste-exposed follows the note.

## 10. Phases

| Phase | What | Done when |
|---|---|---|
| 1 (this session) | Proposal, hub code, shared chrome, contract, child note, oceans reference branch | Branches pushed, checks pass locally |
| 2 (owner) | Decisions D1–D5, steps A–E | https://earth.exposed answers with three real tiles from the adapters |
| 3 (one session per child) | `/network/stats.json`, `/network/layer.geojson`, shared chrome | Hub tiles say "published by the site", not "derived" |
| 4 | New sites join by one `sites.json` entry and the child note | |

## 11. Risks

| Risk | Handling |
|---|---|
| A child changes its API shape | Only the adapters depend on it, and only until the child ships its stats route; the schema-validated stats file is the contract |
| A child is down at refresh time | Last good snapshot stays, marked stale; `network-stale` issue after 3 days |
| A headline fact with a weak source | The validator requires a named source, an https URL and a date; the hub's Sources page lists every one, so a weak source is visible, not hidden |
| Chrome drift between sites | The snippet carries a version; each site-check compares it; the hub's Standards page lists the current version |
| Scope creep into advocacy | Site-check word list, tagline on every page, no rankings across sites by design (tiles are in a fixed order: by launch date) |
