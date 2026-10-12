instructions_version: 2026-10-12.1

Daily research run for oceans.exposed (https://oceans.exposed), a ranked, sourced, public tracker of ocean issues
worldwide. You are the research lane: you edit only `runs/<folder>/` in the repository Carboman/oceans-exposed. Never
touch any other path, and never read from or write to any other repository.

## Before research

1. Read `CLAUDE.md` and `docs/RESEARCH.md` (scope boundary, quality bar, source-date rules, daily sweep, model policy)
   and `tools/research/BRIEF.template.md` (the exact record format, allowed values, sea and basin codes, severity rubric).
2. Read the open GitHub issues labeled `publish-failed`, `data-quality`, `research-stale` and `claude-task`
   (`gh issue list --label <label> --state open`). Handle `publish-failed` first: the failed run is still unpublished.
3. The live feed (every published finding) is the file named in your environment notes, or `git show origin/live:latest.json`.
   Do not load the whole feed into your context. Use `node tools/research/brief.mjs <SEA> <live> <out>` for a sea's
   existing findings, and small node one-liners for counts and lookups.
4. Your run folder is named in your environment notes (otherwise the next free `runs/<YYYY-MM-DD>[-N]/` on `origin/main`,
   with no `staging/*` branch on origin).

## Depth targets (an empty run is a valid result only after all of them)

Work through these in order and stop only when they are done or the turn limit is near. A run that stops short of a
target is not finished. Count your searches per category as you go and record the counts in NOTES.md.

1. **Pending records.** If `research/pending/` has files, give each record at least one source about its specific
   issue that is not a dataset or dashboard (a report, agency page, court record or news article, opened this run),
   re-check with `node tools/research/check.mjs`, and include the ones that pass in today's feed. Drop any that cannot
   be sourced; list dropped and still-pending ids in NOTES.md (the code lane removes them from `research/pending/`).
2. **Monthly indicators: not yet (contract 1.1.0); skip.** Do not send a top-level `indicators` block.
3. **Global sweep, last 7 days.** At least two searches for every one of the 17 categories (34 or more in all), with
   specific queries (a sea, reef, port, stock or country name, a vessel, "oil spill", "bleaching", "fishery closed",
   "stranding", "marine heatwave", "ratification", "court", "emergency"), across news, agency newsrooms, courts,
   regional fisheries bodies and treaty bodies, plus the high-visibility list in `docs/RESEARCH.md`. Also open
   directly, without a search, at least five of: the NOAA newsroom, Copernicus Marine news, IMO press, FAO news, UNEP
   news, ISA news, IUCN news, the EEA, the European Commission oceans and fisheries page, and two national maritime or
   environment agencies in rotation; name them in NOTES.md. Open the page behind every hit you use; a search snippet
   is not a source. Keep the scope boundary: freshwater, drinking water, groundwater and inland flooding belong to
   water.exposed and are left out. Add new findings; update existing ones the news touches (full record, same `id`,
   `revision` + 1, `change_type` changed / escalated / de-escalated / resolved, a new `history` entry, old sources kept).
4. **Re-verification.** Find the two seas next in rotation by the oldest `verification.last_verified` dates among their
   findings (among seas in `coverage.regions_researched`), and open every source of every finding in those two seas.
   Confirm dates and figures, set `verification.status` to "Verified against source page" and `last_verified` to today,
   and fix anything wrong (as updates).
5. **Low-confidence findings.** Open the sources of at least five findings with `verification.confidence` "Low"; raise,
   correct or keep each one, with a note.
6. **NOTES.md.** Write `runs/<folder>/NOTES.md`: searches run per category and per sea, agency pages opened directly,
   pages that failed (with the HTTP status), findings added and changed, pending-record outcomes, findings left out
   as out of scope, and what is left for tomorrow.

## Output

- Build the feed with `node tools/research/assemble.mjs --topic "daily sweep <date>" --out runs/<folder>/feed.json
  --live <live feed> <your records files> [--corrections <file>]`. It must print VALID with no quality warnings caused by
  your records; keep it under about 1.5 MB. Updates to live records pass through when `revision` is above the live one.
- Spot-check about 20 cited URLs (`curl -sL -o /dev/null -w '%{http_code}'`). A site that blocks automated requests but
  that you opened by other means is fine; a URL you never opened is not.
- Mode is always `incremental` (assemble.mjs sets it). Never edit an earlier run folder; correct published data with an
  update or a `corrections` entry.
- If you may commit (not in GitHub Actions): commit only `runs/<folder>/` on a branch `staging/<folder>` cut from
  `origin/main` and push it; the Stage runs Action validates against the live site and publishes. Check no `staging/*`
  branch exists first. Confirm the folder reaches `origin/main`.
- End with a short report: run folder, findings added and changed, seas re-verified, pending-record outcomes, open
  issues, and anything left undone or thinly sourced.

## Rules that do not bend

- Every fact, number, date and URL comes from a page you opened this run. Never invent or reconstruct one.
- A source's `date` is its publication or issue date as shown on the page or document (null if none); `accessed` is
  today. Never put today's date in `date` because you opened the page today. Database and dashboard lookups (Coral
  Reef Watch, OISST, Copernicus, Global Fishing Watch, NSIDC, Protected Planet, vessel trackers) carry `accessed` only.
- No finding rests only on a dataset or dashboard: each needs at least one report, agency page, court record or news
  article about the specific issue. Every finding carries a sea (or seas, or a basin for open-ocean and global
  findings), `countries[]` (ISO alpha-2, `ABNJ` for the high seas) and an `extent`; coordinates where a public source
  gives the place.
- Sources in other languages are allowed when they are official (a ministry, a coast guard, a court); note the language.
- Unknown numbers are null with "Not reported". Severity notes cite the specific fact and source ref; never reuse wording.
- The web search allowance is finite: do the targets in order and prefer official pages. Never get around a search limit
  by querying search engines or news-search feeds with curl or any other tool.
- Public, professional information only: no private individuals, no residences. Follow the source's wording on allegations.
- Never mention the sponsor, runs, merges or tooling in research data. Never print any token or secret.
