# exposed-core changelog

## 1.0.2 (2026-10-12)

Contract check reads `contract/VERSION` from the site root, not the current directory.

## 1.0.1 (2026-10-12)

Contract check prints the schema path as given (`contract/...`), not the absolute path, so its report matches the
sites' previous output exactly.

## 1.0.0 (2026-10-12)

First release: the pipeline extracted from water-exposed and oceans-exposed (identical there apart from site names).
Workflow templates: research-daily, stage-runs, publish-runs, research-watchdog, deploy, contract-check, bootstrap,
core-sync. Tools: publish-run, validate-remote, quality-check, contract-check, file-issues, cost-report, mirror-live,
render-workflows, config. Behaviour is identical to the sites' own copies; the only changes are that site names, API
paths, feed names, schedules and commit prefixes come from `site.config.json`, and the Deploy site workflow also checks
that the rendered workflows are current.
