# Research operations: the daily run, cost, missed runs, and backups

The daily research run is the **Daily research** GitHub Action (`.github/workflows/research-daily.yml`). Every day at
09:41 UTC (5:41 am Eastern; a different minute from water.exposed so the two sites never share a window of API load)
it runs Claude Code headless in GitHub Actions with [`docs/RESEARCH_PROMPT.md`](RESEARCH_PROMPT.md). Claude writes
only `runs/<folder>/` (`feed.json`, `NOTES.md`). The workflow checks that lane, validates the feed the same way
`tools/research/assemble.mjs` does, writes the run's cost to `runs/<folder>/RUN.json`, pushes the folder to
`staging/<folder>` and starts **Stage runs**, which validates it against the live site, promotes it to `main`,
publishes it and mirrors `live`. Nothing in this path depends on claude.ai sessions, connectors or Routines.

## Cost and limits

- Billed to the Claude API workspace `oceans-exposed` that owns the `ANTHROPIC_API_KEY` secret, separately from the
  claude.ai plan and from the water.exposed and waste.exposed workspaces. Give that workspace a monthly spend limit in
  the Console (start at $150; the first week of `RUN.json` files shows the real daily cost). The baseline pass per sea
  (`docs/RESEARCH.md`) is a one-time cost on top, roughly $300 to $600 at list price across 12 to 15 sessions.
- The live feed grows with every run, so the prompt works from `tools/research/brief.mjs` and the summary API rather
  than loading the whole feed.
- Every run writes `runs/<folder>/RUN.json`: model, turns, web searches, tokens, duration, cost at list price, records
  published, trigger and the Actions run URL. `node core/tools/cost-report.mjs` totals them by month; the job summary
  (Actions → Daily research → the run) shows the same figures plus Claude's report.
- The model is Sonnet (`claude-sonnet-5-5`); the repository variable `RESEARCH_MODEL` overrides it.
- One run at a time: the workflow refuses to start while a `staging/*` branch exists, and stops after 150 minutes or
  700 turns. A run that does its targets should cost about $5 to $15; read the first week before changing anything.

## Setup (owner checklist: `docs/OCEANS_EXPOSED_PLAN.md` section 10)

1. A Claude API key created **inside a workspace** (Console → Settings → Workspaces → `oceans-exposed` → its own spend
   limit; Settings → API Keys → Create Key in that workspace), stored as the repository secret `ANTHROPIC_API_KEY`
   (Settings → Secrets and variables → Actions). Never reuse the water.exposed or waste.exposed key: spend limits and
   cost reports are per workspace. An organization-level key fails with "This API key is not scoped to a workspace";
   replace it, or add the repository variable `ANTHROPIC_WORKSPACE_ID` (`wrkspc_...`).
2. Optional: repository variable `RESEARCH_FALLBACK_AUTO` = `true` makes the watchdog start a run by itself when the
   live feed goes stale (see below). Turn it on after seven clean daily runs.
3. The other secrets (`CLOUDFLARE_API_TOKEN`, `PUBLISH_TOKEN`) and the Worker secret are in `docs/AUTO_DEPLOY_SETUP.md`.

## Detecting a missed run

The **Research watchdog** Action runs daily at 15:17 UTC. If the newest published run is 30 hours old or more, or the
site does not answer, it opens one `research-stale` issue (and comments on it each further day). When a fresh run is
live it closes the issue. GitHub emails you about new issues if you watch the repository. With
`RESEARCH_FALLBACK_AUTO` set, it also starts Daily research again.

When a run fails, open it in Actions: the failing step and its log say why (no key, a key without a workspace, a feed
that fails validation, Stage runs rejecting the run, a push conflict). A failed run never changes the live site. If a
run was rejected by Stage runs, its `staging/<folder>` branch is left in place so the verdict can be read; delete the
branch (`git push origin --delete staging/<folder>`) before the next run, or push a fix to it.

## Backups, in order

| # | When | What to do |
|---|------|------------|
| 1 | A day's run failed or was thin | GitHub: **Actions → Daily research → Run workflow**, optionally with a note (for example "re-verify MED and CAR"). |
| 2 | GitHub Actions or the API key is unavailable | Start a session at <https://claude.ai/code> with `Carboman/oceans-exposed` selected and paste `docs/RESEARCH_PROMPT.md`. It uses the claude.ai plan and may commit to `staging/<folder>` itself. |
| 3 | A claude.ai Routine is wanted | Create it at <https://claude.ai/code> **with the repository selected** (a Routine made by an agent starts without one), daily at a time other than 09:41 UTC, prompt `docs/RESEARCH_PROMPT.md`. Turn off the Daily research schedule first so only one runs. |

## Data safety in every path

- Every path writes a **new** `runs/<folder>/` in mode `incremental`; nothing edits an earlier run.
- A run that fails validation never reaches the live site, and the previous run stays live.
- Rolling back: Actions → Publish runs → Run workflow with an earlier `run_dir` and `allow_older` checked
  (`docs/WORKFLOW.md` → Recovery).

## The sister site

water.exposed (`Carboman/water-exposed`) runs the same six workflows and the same tools. Fixes to shared logic
(validation, quality checks, publish tools, workflows) are ported by hand to the other repository in the session
that makes them; neither site imports code from the other.
