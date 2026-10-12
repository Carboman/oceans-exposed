# oceans.exposed: notes for Claude Code

This is the oceans.exposed site (Cloudflare Worker + R2), ported from water.exposed on 2026-10-12 following
`docs/OCEANS_EXPOSED_PLAN.md`. The site is branded oceans.exposed; Carbotura appears only as the footer credit
"Sponsored by Carbotura". Do not apply Carbotura brand or canon rules to the site. The whole two-lane workflow is
in `docs/WORKFLOW.md`.

## Your lane

Claude Code owns everything: the code lane (sessions like this one) and the research lane, which is `runs/**`.
Research runs daily as the **Daily research** GitHub Action (09:41 UTC, headless Claude Code on a workspace-scoped
API key, prompt `docs/RESEARCH_PROMPT.md`); a claude.ai session is the backup. Missed runs, cost and backups are in
`docs/OPERATIONS.md`. Research rules are in `docs/RESEARCH.md`. Publish only through `staging/<folder>` branches,
and never edit or delete a run folder once it has been published. To correct data, publish a new run that updates
the record (same `id`, `revision` + 1) or tombstones it.

## When the user asks you to check, sync, or review

1. `git pull --rebase`. Both lanes push to `main` (the research lane through Stage runs).
2. `git log --format='%h %ad %s' --date=iso -15`: list new runs (`Ocean run ...` commits). Any run not made by the
   Daily research Action or a Claude Code session is a problem: tell the owner.
3. `gh run list --repo Carboman/oceans-exposed --limit 10`: every Daily research, Stage runs, Publish runs, Research
   watchdog and Deploy site run should be green. For a failure: `gh run view <id> --log`. `node tools/cost-report.mjs`
   totals research cost by month.
4. `gh issue list --repo Carboman/oceans-exposed --state open`. Handle every `claude-task`. Read `data-quality`,
   `publish-failed` and `research-stale` (a missed daily run: `docs/OPERATIONS.md`).
5. Live state: `curl -s https://oceans.exposed/api/ocean/summary` and `/api/ocean/runs`. Report
   `coverage.regions_researched` as N of 32 seas (the baseline pass per sea is in `docs/RESEARCH.md`; once it is
   complete the daily run re-verifies two seas a day in rotation).
6. Re-check any run: `node tools/quality-check.mjs runs/<folder> --prev-run auto` (compares it with the run published before it).
7. Report: new runs, live counts, open issues, and actions taken.

## Contract proposals (`contract-change` pull requests or issues)

The owner decides, Claude Code or the owner proposes, you implement (`contract/README.md`). For each proposal:
1. Read the proposal and the Contract check report (`gh pr view <n> --comments`).
2. If it is labeled `breaking`, or rejects any past run, do not merge until the owner approves in their own words.
3. Implement it on the proposal branch, or on main after merging the contract files: `src/model.js` and `src/geo.js`
   (vocabulary), `src/adapt.js`, `src/validate.js`, the API (`src/worker.js`), the site, then `docs/FEED_SPEC.md`,
   `docs/RESEARCH_PROMPT.md` (bump `instructions_version`) and `tools/research/BRIEF.template.md`, `contract/VERSION`
   and `contract/CHANGELOG.md`.
4. Run `node tools/contract-check.mjs` and `node tools/site-check.mjs`, merge, comment with what shipped, and close.

## When you change the data contract

- Update `src/adapt.js` and `src/validate.js` (and `src/model.js` or `src/geo.js` for vocabulary), then
  `docs/FEED_SPEC.md`, then **`docs/RESEARCH_PROMPT.md`** and `tools/research/BRIEF.template.md`, and **bump
  `instructions_version`** on the prompt's first line. The Daily research Action reads that file every run and
  records the version in `RUN.json` and the commit message, so nothing needs re-pasting.
- Run `node tools/site-check.mjs` before pushing. Pushes to `main` deploy automatically (Deploy site Action).
- Port fixes to shared logic (validation, quality, publish tools, workflows) to water.exposed by hand in the same
  session, and say so in the commit.

## Guardrails

- Never print `PUBLISH_TOKEN`, `.publish-token`, `.dev.vars`, `ANTHROPIC_API_KEY` or any Cloudflare or GitHub token.
- Never edit published research data in place. Republish or roll back through the Publish runs workflow
  (`docs/WORKFLOW.md` → Recovery).
- Don't rank findings globally across categories (methodology rule): rank is per category only.
- Keep the scope boundary with water.exposed (`docs/RESEARCH.md`): marine and coastal here, freshwater there.
- Commit messages end with the Co-Authored-By line from the session's attribution instructions.
