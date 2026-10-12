# oceans.exposed

https://oceans.exposed is an informational site of ranked, sourced ocean findings (the Global Ocean Issues
Tracker), served by a Cloudflare Worker that reads its data from R2. It was built on 2026-10-12 from the
water.exposed code; the plan it follows is `docs/OCEANS_EXPOSED_PLAN.md`.

## Layout

```
src/worker.js        API, report and publish Worker (R2 binding OCEAN_REPORTS, bucket oceans-exposed-reports)
src/model.js         Categories, issue layers, severity components, scoring
src/geo.js           Basins, regional seas, country codes, coordinates, extents
src/validate.js      Feed validation (used by the Worker, the research tools and tools/site-check.mjs)
src/adapt.js         Converts the research lane's native ocean-intelligence feed (snapshot or incremental)
src/quality.js       Content-quality checks (warnings never block publishing)
public/              static pages served by the Worker's assets binding
  index.html         Overview: KPIs, executive summary, sea panel, sea tile map, ranked findings by category
  explorer.html      Filterable, sortable table with CSV export (filters persist in the URL)
  dossier.html?id=   Full dossier for one finding
  sea.html?code=     One regional sea: its findings and map
  updates.html       Changes, cross-cutting findings, milestones, coverage limitations
  methodology.html   Scoring rubric, issue layers, evidence and source rules, API
  assets/            styles.css, app.js, charts.js, seamap.js
contract/            The publishing contract: ocean-intelligence.schema.json, VERSION, CHANGELOG.md, examples/
docs/FEED_SPEC.md    The feed contract the Worker accepts and the site renders
docs/PUBLISHING.md   Publish API, accepted formats, safety rules, public endpoints
docs/WORKFLOW.md     How the code lane and the research lane work together (lanes, issues, recovery)
docs/RESEARCH.md     Research rules: publishing path, scope, the pass per sea, the daily sweep, quality bar
docs/RESEARCH_PROMPT.md  The prompt the Daily research Action runs (first line: instructions_version)
docs/OPERATIONS.md   The daily run: cost, missed runs, backups
docs/AUTO_DEPLOY_SETUP.md  Cloudflare token, GitHub secrets and the Worker secret
docs/OCEANS_EXPOSED_PLAN.md  The approved plan this site was built from
CLAUDE.md            Claude Code's notes (lane, check routine, guardrails)
runs/<date[-N]>/     One folder per run: feed.json, NOTES.md, RUN.json
research/pending/    Researched records waiting for a source
tools/research/      brief.mjs, assemble.mjs, check.mjs and BRIEF.template.md (research helpers)
core/tools/publish-run.mjs    Quality-checks and publishes run folders (used by the Actions)
core/tools/quality-check.mjs  Content-quality warnings for a run folder
core/tools/validate-remote.mjs  Validates a run against the live site (used by Stage runs)
core/tools/file-issues.mjs    Files and closes data-quality / publish-failed / lane-check issues
tools/site-check.mjs     Pre-deploy checks (branding, links, sample feed valid)
core/tools/contract-check.mjs Schema compiles, past runs still valid, version bumped
core/tools/cost-report.mjs    Research cost by month from runs/*/RUN.json
core/tools/mirror-live.sh     Mirrors the live feed to the `live` branch
.github/workflows/   research-daily.yml, research-watchdog.yml, stage-runs.yml, publish-runs.yml,
                     deploy.yml, contract-check.yml
```

## Daily update

The **Daily research** Action (09:41 UTC) runs Claude Code headless with `docs/RESEARCH_PROMPT.md`, writes
`runs/<folder>/feed.json` and `NOTES.md`, and pushes the folder to `staging/<folder>`. The **Stage runs** Action
validates it against oceans.exposed, promotes it to `main`, publishes it and mirrors the `live` branch. A failed
run shows as a failed check on the commit, with each invalid field named, and never changes the live site. Code
changes on `main` deploy through **Deploy site** once the `CLOUDFLARE_API_TOKEN` repo secret exists
(`docs/AUTO_DEPLOY_SETUP.md`); until then, run `npm run deploy`. Pull before working locally: `git pull --rebase`.

## Scope

Marine and coastal issues, including coasts of every country and the high seas. Freshwater, drinking water,
groundwater and inland flooding belong to the sister site water.exposed (`docs/RESEARCH.md` → Scope boundary).

## Local preview

`npm run dev` serves the site and API at http://localhost:8787, using local R2 and `.dev.vars`
(`PUBLISH_TOKEN=...`, git-ignored). To seed local R2:
`npx wrangler r2 object put oceans-exposed-reports/feeds/latest.json --file runs/<folder>/feed.json --local`

`npm run check` runs the site check, the contract check and the tests.

## Branding

The site is branded oceans.exposed. Carbotura appears only as the footer credit "Sponsored by Carbotura".
