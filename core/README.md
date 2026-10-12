# exposed-core

The shared research-and-publishing pipeline of the .exposed network (water.exposed, oceans.exposed, and the sites to
come). Each site vendors a copy of this repository under `core/`, keeps a `site.config.json` in its root, and renders
its GitHub workflows from the templates here. Nothing here runs at page-load time on any site; this is tooling only.

```
VERSION                      The core version a site pins (its core/VERSION must match what it vendored)
site.config.example.json     Every key a site's site.config.json may carry
tools/config.mjs             Finds the site root and loads site.config.json (all other tools import it)
tools/publish-run.mjs        Quality-checks and publishes run folders through the site's authenticated API
tools/validate-remote.mjs    Validates staged runs against the live site (Stage runs)
tools/quality-check.mjs      Content-quality warnings for a run folder (uses the site's src/quality.js and src/adapt.js)
tools/contract-check.mjs     Every past run still validates under the site's schema; flags breaking proposals
tools/file-issues.mjs        Files and closes data-quality / publish-failed / lane-check issues
tools/cost-report.mjs        Research cost by month from runs/*/RUN.json
tools/mirror-live.sh         Mirrors the live feed to the orphan branch `live`
tools/render-workflows.mjs   Renders workflows/*.yml.tpl into the site's .github/workflows/ (--check in CI)
workflows/*.yml.tpl          Daily research, Stage runs, Publish runs, Research watchdog, Deploy site, Contract check,
                             Bootstrap site, Core sync
```

## How a site uses it

1. `site.config.json` in the repository root (copy the example; keys: host, repo, slug, feedName, runPrefix, schema,
   fieldRulesDoc, dossierPrefix, dossierTitle, bucket, sampleRun, research.cronDaily/dailyTime/cronWatchdog,
   workflows.skip).
2. `core/` is a plain copy of this repository (no submodule, no package registry):
   `git clone --depth 1 https://github.com/Carboman/exposed-core "$TMP" && rsync -a --delete --exclude .git "$TMP/" core/`.
3. `node core/tools/render-workflows.mjs` writes `.github/workflows/*.yml`. The Deploy site workflow runs the same
   command with `--check`, so a hand-edited workflow fails CI.
4. The site keeps what is its own: `src/` (Worker, validation vocabulary, quality rules, adapters), `public/`,
   `tools/site-check.mjs`, `tools/research/`, `contract/`, `docs/`, `runs/`.
5. The Core sync Action (weekly) opens a pull request when this repository has a newer version. Each site needs one
   repository secret, `CORE_SYNC_TOKEN`: a fine-grained GitHub token (Settings → Developer settings → Fine-grained
   tokens) with repository access to the site repositories **and** `Carboman/exposed-core`, and these permissions:
   Contents read and write, Workflows read and write, Pull requests read and write (Metadata read is added
   automatically). The built-in Actions token cannot read this private repository and may not push changes to
   workflow files, which the update always contains. The site also needs "Allow GitHub Actions to create and approve
   pull requests" enabled (Settings → Actions → General → Workflow permissions). One token can serve every site.

## Releasing a change

Edit here, bump `VERSION` (semver: patch for a fix, minor for a new template or config key, major when a site must
change its config), describe it in `CHANGELOG.md`, push to `main`. Sites pick it up through Core sync, or by hand with
step 2 and 3 above. Never change a template in a way that alters a site's behaviour without saying so in the changelog.

## What this is not

Not a runtime dependency of any site and not a data store. Research data lives only in each site's `runs/` and its
own storage. The hub (earth.exposed) does not use this repository.
