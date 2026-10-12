# Operating the hub

- **Refresh:** Network refresh runs at 03:17 and 19:17 UTC and on demand (Actions → Network refresh → Run workflow,
  optionally one site). It commits `public/data/` as `earth-exposed-bot` only when something changed. Cost: none
  beyond Actions minutes (no model calls).
- **A stale site:** the tile says "stale since <date>" and keeps the last good figures. After 3 days the Action opens
  one `network-stale` issue and comments on it daily; it closes the issue when every site is fresh. Look at the
  site's own Actions and `research-stale` issues; the hub needs nothing.
- **A site changes its API:** only `tools/adapters.mjs` depends on a site's API, and only until that site publishes
  `/network/stats.json`. Fix the adapter, or ask the site's session to ship the route (`docs/CHILD_SITE_NOTE.md`).
- **Adding a site:** one entry in `network/sites.json` (id, host, URL, tagline, stats URL, launch month; `adapter`
  only if the site has no stats file yet), `node tools/chrome.mjs`, `node tools/site-check.mjs`, push. The chrome
  version does not change for a new site; the bar's site list is in the snippet, so each existing site re-vendors
  the bar at the next chrome release.
- **Releasing a new chrome version:** edit `network/`, bump `network/sites.json` → `chrome_version`, run
  `node tools/chrome.mjs`, update `contract/CHANGELOG.md`, push. The previous version stays served under its own
  folder; sites move when their sessions re-vendor.
- **Rolling back:** `git revert <sha>` on `main` redeploys. A bad snapshot: revert the refresh commit.
- **Pausing:** disable the Network refresh workflow. The last snapshot stays live.
