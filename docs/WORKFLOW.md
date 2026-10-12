# How the two lanes work together

```
                    ┌──────────────────────── GitHub: Carboman/oceans-exposed ────────────────────────┐
  Research lane ──► │ staging/<folder>: runs/<date[-N]>/ (feed.json, NOTES.md, RUN.json)              │
  (Daily research   │     ──► "Stage runs" Action: validate against the site → promote to main ───────┼──► oceans.exposed
  Action, or a      │         → publish → mirror `live` → comment "Published"                         │     (R2 + Worker)
  Claude Code       │ issues: data-quality · publish-failed · research-stale ◄── Actions file/close  │
  session)          │         claude-task   ──► for the code lane                                     │
  Code lane ──────► │ src/ public/ tools/ docs/ contract/ .github/   ──► "Deploy site" Action ────────┼──► oceans.exposed
  (Claude Code      └────────────────────────────────────────────────────────────────────────────────┘
  sessions)
```

Both lanes are Claude Code. The research lane is the **Daily research** GitHub Action (headless Claude Code on a
workspace-scoped API key), with a claude.ai session as the backup (`docs/OPERATIONS.md`). The code lane is any
Claude Code session the owner works in.

## Lanes: who writes what

| Path | Lane | Rule |
|---|---|---|
| `runs/**` | Research | New folder per run, pushed to `staging/<folder>`. Never edit or delete an earlier run's folder. |
| `research/pending/` | Research reads, code lane clears | Records waiting for a source (`research/pending/README.md`). |
| `src/`, `public/`, `tools/`, `.github/`, `wrangler.jsonc`, `package*.json` | Code | Code and site. Deploys automatically on push to `main`. |
| `docs/RESEARCH_PROMPT.md`, `tools/research/BRIEF.template.md` | Code | The research lane's working instructions. The Action reads the prompt from its checkout every run; bump `instructions_version` on its first line on every change. |
| `contract/**` | **Owner** decides; Claude Code or the owner **proposes** (pull request from a `contract/<name>` branch, or a `contract-change` issue); Claude Code **implements and merges** | The publishing contract (schema, version, changelog, examples, proposals). Breaking changes need the owner's written approval. See `contract/README.md`. |
| `docs/` (other), `README.md`, `CLAUDE.md` | Code | |

The lanes never touch each other's paths, so they never conflict. The Daily research and Stage runs workflows
refuse a run that touches anything outside `runs/<folder>/` (lane check). Code sessions always pull before working
(`git pull --rebase`).

## Publishing path

The research lane needs only `git push` access, no Cloudflare or publish token. It reads the live state from the
`live` branch (mirrored after every publish) and pushes each run to `staging/<folder>`. The **Stage runs** Action
validates the run against oceans.exposed (`POST /api/ocean/validate`, the same conversion, validation and quality
checks as publishing), comments the result on the commit, and, when valid, copies the folder to `main`, publishes
it, mirrors `live`, comments "Published" and deletes the staging branch. Invalid runs never reach `main`. (Direct
commits to `main` under `runs/` still publish via **Publish runs**.)

## The loop

1. **Daily research** runs at 09:41 UTC (or by hand: Actions → Daily research → Run workflow). Before research it
   reads `CLAUDE.md`, `docs/RESEARCH.md`, the brief template and the open issues, and works from the live feed the
   workflow saved for it (protocol in `docs/RESEARCH_PROMPT.md`).
2. **The workflow** lane-checks and validates `runs/<folder>/`, writes `RUN.json` (model, turns, searches, cost),
   pushes the folder to `staging/<folder>` as `oceans-exposed-bot` with the commit message
   `Ocean run <folder> (incremental): N records [instr <version>]`, and starts Stage runs.
3. **Stage runs**, on its own:
   - validates against the live site and comments the verdict on the commit;
   - promotes a valid run to `main`, **publishes** (dry run, real publish, confirms the run is live), mirrors `live`;
   - files a **`data-quality`** issue if there were warnings, or a **`publish-failed`** issue if nothing went live;
   - **closes** older `data-quality` and `publish-failed` issues when a run publishes clean.
4. **Research watchdog** runs at 15:17 UTC: if the newest published run is 30 hours old or more, or the site does not
   answer, it opens (or comments on) one `research-stale` issue, and closes it when a fresh run is live.
5. **Claude Code** (when you ask it to check): pulls, reviews new runs and the open issues, handles every
   `claude-task`, and fixes data problems by publishing an update in the next run or a correction.

## Messages between the lanes

| Label | Opened by | Meaning | Closed by |
|---|---|---|---|
| `publish-failed` | Action | Run did not go live; the site still shows the previous run | Action, on the next successful publish |
| `data-quality` | Action | Run is live but broke content-quality rules | Action, on the next clean publish |
| `research-stale` | Research watchdog | No run published for 30 hours or more | The watchdog, when a fresh run is live |
| `claude-task` | You, or a research run's notes | Code, site or validation change needed | Claude Code, after deploying the fix |
| `contract-change` | Claude Code or the owner (pull request or issue) | Proposed change to what the research lane publishes | Claude Code, after shipping it (with owner approval if `breaking`) |
| `breaking` | Contract check | The proposal would reject past runs | Removed when the proposal becomes backward compatible |

## What can go wrong, and what catches it

| Failure | Caught by | Effect on the live site |
|---|---|---|
| Invalid JSON, a bad score, a missing source, a missing field, a sea or basin not in the list | **The research tools validate first** (`tools/research/assemble.mjs`, then the workflow and `POST /api/ocean/validate`); anything that slips through fails the Worker dry run → `publish-failed` issue | None; the previous run stays live |
| Empty snapshot | Worker refuses (`empty_snapshot`) | None |
| Run dated earlier than the live run | Worker refuses unless rollback is chosen | None |
| Two runs on one day | Separate run folders and snapshots (`-2`, `-3`) | Both kept |
| Boilerplate notes, generic types, renames, wiped trends, dropped milestones or findings, silent rescoring, dataset-only sourcing, unmappable findings, one-sea imbalance | Quality check → `data-quality` issue | Published; fixed next run |
| The research lane works from stale instructions | The Action reads `docs/RESEARCH_PROMPT.md` from its checkout each run; the version appears in `RUN.json` and the commit message | n/a |
| A research run edits code | Lane check in Daily research and Stage runs refuses it; Claude Code reviews `git log` on each check | Claude Code reverts it |
| A run never happens | Research watchdog → `research-stale` issue; `RESEARCH_FALLBACK_AUTO` restarts the run | The previous run stays live |
| Bad code deploy | Site checks and tests before deploy; git history | Roll back by reverting the commit, which redeploys |
| Lost data | Raw payload archive (`feeds/raw/`), per-run snapshots, everything in git | Republish any run (below) |

## Recovery

- **Republish or roll back a run:** GitHub → Actions → **Publish runs** → *Run workflow*. Enter `run_dir`
  (e.g. `runs/2026-10-20-2`), mode `publish`, and tick **allow_older** for an earlier-dated run.
- **Re-check a run without publishing:** the same form with mode `quality-only` (files or updates its issue).
- **Roll back code:** `git revert <sha>` and push. The deploy Action redeploys.
- **Pause publishing:** delete the `PUBLISH_TOKEN` repo secret. Publishes then fail and file `publish-failed` issues.
  Restore the secret to resume.
- **Pause research:** Actions → Daily research → ⋯ → Disable workflow (and the watchdog, or it will file
  `research-stale`). Enable both to resume.
