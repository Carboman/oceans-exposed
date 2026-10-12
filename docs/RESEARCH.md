# Research runs (Claude Code)

All research for oceans.exposed is done by Claude Code: the **Daily research** GitHub Action for the daily sweep, and
Claude Code sessions for the baseline pass per regional sea. Runs publish through the staging path, so a run needs
only `git push` access: no Cloudflare or publish token. This works the same in GitHub Actions, locally and in a cloud
session.

## Publishing path

1. Pick the next free folder: `git fetch origin && git ls-tree --name-only origin/main runs/ | sort -V | tail -1`,
   then `runs/<YYYY-MM-DD>-N` with the next N. Never reuse a folder, never edit a published folder.
2. Make sure no run is in flight: no `staging/*` branch on origin (`git ls-remote --heads origin 'staging/*'`).
3. Commit only `runs/<folder>/` (`feed.json`, `NOTES.md`) on a branch `staging/<folder>` cut from `origin/main`, and
   push it.
4. The **Stage runs** Action validates, then comments on the commit. If it's valid, the Action promotes the folder to
   main, publishes it, mirrors `live`, comments "Published" and deletes the branch. If it's invalid, fix the
   feed and push to the same branch again.
5. Read the verdict: `gh api repos/Carboman/oceans-exposed/commits/<sha>/comments`, or `git fetch` and check that
   the folder reached `origin/main`.

The live feed for de-duplication is always available without network access to the site:
`git show origin/live:latest.json > /tmp/live.json`.

## Scope boundary with water.exposed

Marine and coastal issues belong to oceans.exposed, including the coasts of the United States. Freshwater,
drinking water, groundwater and inland flooding stay on water.exposed. Edge cases, decided once:

- Coastal flooding from sea level or storm surge: oceans. Inland stormwater: water.
- Marine algal blooms: oceans. Freshwater blooms: water.
- A river's nutrient load counts on water; the dead zone it causes at sea counts on oceans.

A finding that belongs to the other site is left out, and noted in `NOTES.md` if it seemed important.

## Regional-sea in-depth pass (the baseline)

A sea is **researched** when all 16 categories (plus `other`) have been searched for it over the last three years at
the depth of the water.exposed per-unit baseline passes (about 80 findings and 0 warnings for a large unit). Coverage is recorded in
`coverage.regions_researched`, which `tools/research/assemble.mjs --seas` sets; the site unions it with the live list
and shows "N of 32 seas". The sea codes and names are in `src/geo.js`.

Per sea:
1. `node tools/research/brief.mjs <SEA> /tmp/live.json /tmp/<sea>-brief.md`: the brief, with the sea's existing
   findings listed so agents do not duplicate them.
2. Launch research subagents in parallel, one per category group, each told to read the brief, stay in its
   categories, write a JSON array to its own file and self-check with `node tools/research/check.mjs <file>`:
   - **A. Climate and physical:** `ocean-warming-heatwaves`, `sea-level-coastal-flooding`,
     `acidification-deoxygenation`, `polar-oceans-sea-ice`.
   - **B. Reefs, habitats and wildlife:** `coral-reefs`, `coastal-habitats`, `marine-wildlife`.
   - **C. Fisheries and aquaculture:** `fisheries-overfishing`, `aquaculture`.
   - **D. Pollution:** `plastics-marine-debris`, `nutrient-pollution-dead-zones`, `chemical-oil-pollution`.
   - **E. Industry and governance:** `shipping-ports-noise`, `offshore-energy`, `deep-sea-mining`,
     `governance-treaties-disputes`, `other`.

   Large seas (`SCS`, `MED`, `CAR`, `GOM`, `NWATL`, `NEPAC`, `CORAL`, `BEN`, `NSEA`, `BAL`) get all five agents. The
   open-ocean and polar entries (`NPAC`, `SPAC`, `NATL`, `SATL`, `SOUTHERN`, `ARCTIC`) merge A+B and C+D+E. The other
   seas get five agents, or four with D and E merged when the brief shows little to find.
   Every agent also checks the **high-visibility list** for its categories and covers any item in the sea that is not
   already live: the 2023 to 2026 global coral bleaching event and marine heatwaves, record sea-surface temperatures,
   sea-ice records, major oil and chemical spills and shipwreck leaks, dead-zone forecasts and sewage discharges,
   fishery closures and stock assessments below reference points, illegal fishing cases and vessel detentions, mass
   strandings and entanglements, offshore wind and oil-and-gas conflicts, seabed-mining permits and moratoria, plastics
   treaty and BBNJ ratification steps, marine protected area designations and 30x30 progress, maritime boundary
   rulings, port expansions and dredging, aquaculture escapes and disease, and emergency declarations.
3. Review the agents' reports. Merge overlaps: when one event comes back under two ids, keep the
   better-sourced record, add the other's sources, and note any disagreement in `conflicts`. A finding spanning
   several seas uses `location.seas[]` once rather than one record per sea.
4. `node tools/research/assemble.mjs --seas XX[,YY] --out runs/<folder>/feed.json --live /tmp/live.json <files>`.
   The result must be VALID with no warnings before staging.
5. Spot-check about 20 cited URLs (`curl -sL -o /dev/null -w '%{http_code}'`; strip `\r` from any list
   written on Windows). Then stage.

Two or three seas can share one run (up to about 1.5 MB). One run at a time.

**Global topical passes** (the plastics treaty, BBNJ ratification, deep-sea mining licences, the global bleaching
event, multi-basin events) assemble with `--topic "<label>"` in place of `--seas`. That leaves
`coverage.regions_researched` untouched, since a topical pass does not make a sea researched.

**Sea order:** the ten large seas first, `SCS MED CAR GOM NWATL NEPAC CORAL BEN NSEA BAL`, then the rest:
`ECS JPN SEA RED GULF NEATL BLK GOG BRA SAFR WIND EIND TROPEPAC SEPAC TASMAN BERING ARCTIC SOUTHERN NPAC SPAC NATL SATL`.
At the water.exposed rate this is about 12 to 15 sessions.

## Daily sweep

The sweep runs as the **Daily research** GitHub Action with the prompt in `docs/RESEARCH_PROMPT.md`, which lists the
depth targets a run must finish (pending records, the global sweep with at least two searches per category and five
agency newsrooms opened directly, two seas re-verified by opening every source, five low-confidence findings
re-checked, and a `NOTES.md`). Cost, missed runs and backups: `docs/OPERATIONS.md`. The sweep is worth running from
the first day, but its re-verification rotation only covers seas already in `regions_researched`.

Once a day, run an incremental global sweep of events from the last 7 days in every basin: news, agency newsrooms
(NOAA, Copernicus Marine, IMO, FAO, UNEP, ISA, IUCN, EEA, the European Commission's oceans and fisheries page,
national maritime and environment agencies), courts, regional fisheries bodies and treaty bodies. Add new findings,
and update status, trend, sources and `history` on existing findings that the news touches. To update an existing
record, send it in full with the same `id`, `change_type` `changed`, `escalated`, `de-escalated` or `resolved`, and
`revision` + 1. Re-verify two seas a day in rotation by the oldest `verification.last_verified`.

## Monthly indicators

Not yet. Contract 1.1.0 adds the monthly ocean indicators (global sea-surface temperature anomaly, sea-ice extent,
sea level, surface pH, coral bleaching alert area) as the feed's top-level `indicators` block, with a tool to build
it. Until then the block is reserved: a run must not send it, and the prompt skips the target.

## Quality bar

- Every fact comes from a page opened during the run. Never invent a URL, date, number or quote.
- Source `date` is the publication or issue date shown by the source (null if none); `accessed` is the day it was
  opened. Database and dashboard lookups carry `accessed` only. Timelines are built from `date`, so an access date
  there is an error.
- No finding rests only on a dataset or dashboard (NOAA Coral Reef Watch, OISST, Copernicus, Global Fishing Watch,
  NSIDC, Protected Planet, a port or vessel tracker): each needs a report, agency page, court record or news article
  about the specific issue.
- Every record names its sea (or seas, or a basin for open-ocean and global findings), the coastal states involved
  in `countries[]` (ISO alpha-2, `ABNJ` for the high seas) and an `extent`; give `lat`/`lon` coordinates from a
  public source where one gives the location (a reef, platform, port, wreck, outfall or coastal city), never a
  residence.
- Severity notes must be specific to each finding and cite source refs (rubric in `tools/research/BRIEF.template.md`).
- `measures[]` carries the figure that matters (area bleached, tonnes spilled, stock biomass against reference
  points); `population_affected` is often null with "Not reported", which is fine.
- Sources in other languages are allowed when they are official (a ministry, a coast guard, a court, a regional
  fisheries body); the record notes the language in the source `basis` or the finding's `missing_fields` note.
- The executive summary (`summary`) is public prose about the ocean. Never mention runs, merges or tooling in it.

## Model policy (cost)

- The coordinating session the owner works in runs on the strongest available model.
- Everything else uses lower-cost models: the Daily research Action, any routine and child sessions run on Sonnet
  (`claude-sonnet-5-5`); research subagents launched with the Agent tool use `model: "sonnet"`; purely
  mechanical jobs (fetching tables, URL checks, transcribing data into records) use `model: "haiku"`.
- Lower-cost models follow the same quality bar: every fact from a page opened in the session, no dataset-only
  records, no getting around the search limit.
