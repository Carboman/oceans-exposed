# exposed-core changelog

## 1.1.0 (2026-10-12)

- Stage runs gains a **schema gate**: after the live-site validation passes, every staged run folder must also validate
  against the site's contract schema (`contract-check --only`), so a run can no longer publish while failing the
  contract. Sites need `ajv` in devDependencies (both do).
- `contract-check` reads `contract.historical` from `site.config.json`: run folders kept exactly as published but no
  longer checked (plan decision D5). They are listed as historical and never counted as invalid.
- `contract-check --only <runs...>` checks only those folders and exits 1 on an invalid one.

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
