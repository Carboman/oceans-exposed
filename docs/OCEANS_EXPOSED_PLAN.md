# oceans.exposed: plan and setup instructions

Status: proposal, 2026-10-12. Nothing in this document is built yet. Section 2 lists the decisions the owner makes;
section 10 is the owner's setup checklist; everything else is what Claude Code builds once the repository exists.

## 1. Recommendation in short

Build **oceans.exposed** as a second site made from the water.exposed code, in its own repository
(`Carboman/oceans-exposed`), with its own Cloudflare Worker, R2 bucket, publish token, Claude API workspace and
daily research Action. It keeps the whole operating model that already works here: a code lane and a research lane,
runs published through `staging/<folder>` branches, incremental feeds merged by `id`, a quality check that files
issues, a watchdog, and a versioned publishing contract.

What changes is the subject matter, and three things that are U.S.-specific in water.exposed:

| Area | water.exposed | oceans.exposed |
|---|---|---|
| Geography unit | U.S. state (56), EPA system ID | Regional sea (32), ocean basin (5), country (ISO code) or high seas |
| Categories | 13 freshwater categories | 16 ocean categories plus `other` (section 4) |
| Baseline indicator | EPA "no health-based violation" share | Monthly ocean indicators: global sea-surface temperature anomaly, sea-ice extent, sea level, surface pH, coral bleaching alert area (version 1.1, after launch) |
| Financial evidence | Utility bills, rate cases, capital stages | Dropped in version 1 (the field is accepted and ignored) |
| Map | State tile map and state pages | Sea tile map and sea pages; world point map later |
| Research sources | EPA, state agencies, utilities | NOAA, Copernicus Marine, FAO, UNEP, IMO, ISA, IUCN, regional fisheries bodies, national maritime and environment agencies, courts, news |

Everything else (Worker, R2 layout, validation, API shape, explorer, dossier, updates, methodology, theme, the
sponsor footer, the Actions) is reused with names changed.

## 2. Decisions for the owner

Reply with the numbers and any changes. Recommended choices are first.

1. **Repository.** Separate repository `Carboman/oceans-exposed` (recommended), or a second site inside this
   repository. Separate is simpler: the research lane is defined by the `runs/**` path and one `staging/*` branch at
   a time, the daily Action is one job per repository, and each site keeps its own secrets, spend limit and deploy.
   The code is about 6,000 lines, so carrying fixes across by hand is cheap. A shared package can come later if both
   sites keep diverging.
2. **Categories.** Approve or edit the 16 categories in section 4.
3. **Geography.** Approve the regional-sea list in section 5 as the unit for the map, the side panel, coverage and the
   daily re-verification rotation.
4. **Scope boundary with water.exposed.** Marine and coastal issues belong to oceans.exposed, including U.S. coasts.
   Freshwater, drinking water, groundwater and inland flooding stay on water.exposed. Edge cases, decided once:
   coastal flooding from sea level or storm surge goes to oceans; inland stormwater goes to water; marine algal blooms
   go to oceans, freshwater blooms to water; a river's nutrient load counts on water, the dead zone it causes at sea
   counts on oceans.
5. **Version 1 drops financial evidence and the EPA baseline**, and adds the ocean indicators baseline in 1.1.
6. **Budget.** A new Console workspace `oceans-exposed` with its own monthly spend limit (start at $150 as for water),
   plus a one-time budget for the baseline research pass (section 9; rough estimate $300 to $600 at list price).
7. **Branding.** Wordmark `oceans.exposed` in the same style, title "Global Ocean Issues Tracker", same footer
   credit "Sponsored by Carbotura", same theme with a different accent colour.

## 3. Architecture: what is copied, renamed, rewritten or dropped

| Path | Action | Notes |
|---|---|---|
| `wrangler.jsonc` | Rename | `name: oceans-exposed`, route `oceans.exposed` (custom domain), binding `OCEAN_REPORTS` → bucket `oceans-exposed-reports` |
| `src/worker.js` | Rename | Routes become `/api/ocean/*`, `/internal/ocean/*`, `/reports/*`. Filters: `category`, `layer`, `level`, `sea`, `basin`, `country`, `status`, `trend`, `min_score`, `q`. The `financial` block of `/api/ocean/summary` goes; `systems` becomes `indicators` in 1.1 |
| `src/validate.js`, `src/adapt.js` | Rewrite the maps | Feed name `ocean-intelligence`; category names; location fields in section 5; no PWSID rules |
| `src/geo.js` | Rewrite | Sea and basin code lists, precisions, extents (section 5) |
| `src/quality.js` | Adapt | Drop the two PWSID rules; "one state dominates" becomes "one sea dominates"; "unmappable" means no coordinates and no sea or basin extent |
| `src/finance.js`, `src/baselines.js`, `public/assets/finview.js` | Drop | `baselines.js` returns as `indicators.js` in 1.1 |
| `public/index.html`, `app.js`, `charts.js`, `styles.css` | Adapt | "All states" panel becomes "All seas"; KPIs, category rail and ranked lists unchanged |
| `public/state.html`, `statemap.js` | Rewrite | `sea.html?code=` and a sea tile map (same technique as the state tile map, so no polygon data is needed in v1) |
| `public/explorer.html`, `dossier.html`, `updates.html` | Adapt | Filter names and columns |
| `public/methodology.html` | Rewrite the text | New rubric, layers, categories, sources and API table |
| `public/infographic.html` | Later | Not in version 1 |
| `contract/` | New | `ocean-intelligence.schema.json`, `VERSION` 1.0.0, changelog, one example record |
| `docs/FEED_SPEC.md`, `PUBLISHING.md`, `WORKFLOW.md`, `OPERATIONS.md`, `RESEARCH.md`, `RESEARCH_PROMPT.md`, `CLAUDE.md`, `README.md` | Rewrite | Same structure, ocean content. The retired research-agent instruction files are not carried over |
| `tools/*.mjs`, `core/tools/mirror-live.sh` | Rename | Site URL, feed name, bucket; `site-check` looks for the `oceans.exposed` wordmark and canonical |
| `tools/research/BRIEF.template.md`, `assemble.mjs`, `brief.mjs`, `check.mjs` | Rewrite | Per-sea brief, `--seas` instead of `--states`, `regions_researched` |
| `tools/epa-baseline.py`, `ucmr5-pfas.py` | Drop | Replaced in 1.1 by `tools/ocean-indicators.py` |
| `.github/workflows/*` | Rename | Same six workflows; URLs, feed name, bot name. Daily research at a different minute (e.g. 09:41 UTC) so the two sites never share a window of API load |
| `tests/` | Adapt | API, geo and quality tests; finance and baselines tests dropped |
| `runs/` | Start empty | The first run is the sample feed used by `site-check`, then the baseline passes |

## 4. Research categories

Sixteen categories plus `other`. Display order as listed. Rank is computed per category, never nationally or
globally across categories (the same methodology rule as water.exposed).

| # | Slug | Covers | Starting sources |
|---|---|---|---|
| 1 | `ocean-warming-heatwaves` | Marine heatwaves, record sea-surface temperatures, thermal stress events | NOAA OISST and Coral Reef Watch, Copernicus Marine, national met offices |
| 2 | `sea-level-coastal-flooding` | Sea-level rise, coastal erosion, storm surge, tidal flooding, subsidence, managed retreat | NASA and NOAA sea level, PSMSL, national coastal agencies, city plans |
| 3 | `acidification-deoxygenation` | Ocean acidification, oxygen-minimum zones, hypoxia at sea | GOA-ON, NOAA PMEL, IOC-UNESCO, IPCC |
| 4 | `coral-reefs` | Bleaching, mortality, reef disease (SCTLD), reef restoration failures | NOAA Coral Reef Watch, GCRMN, AIMS, ICRI, reef park authorities |
| 5 | `fisheries-overfishing` | Stock collapse, overfishing, illegal fishing (IUU), bycatch, subsidies, fishing disputes and closures | FAO SOFIA, regional fisheries bodies (ICCAT, WCPFC, NAFO, CCAMLR), ICES, NOAA Fisheries, Global Fishing Watch, courts |
| 6 | `plastics-marine-debris` | Plastic pollution, microplastics, ghost gear, nurdle spills, treaty negotiations | UNEP, plastics treaty INC, Ocean Conservancy, national coast guards |
| 7 | `nutrient-pollution-dead-zones` | Eutrophication, hypoxic dead zones, marine harmful algal blooms, sewage discharge to sea | NOAA hypoxia forecasts, HELCOM, OSPAR, EEA, state and national water agencies |
| 8 | `chemical-oil-pollution` | Oil spills, chemical and mercury contamination, treated nuclear water discharge, ocean dumping, shipwreck leaks | ITOPF, IMO, IAEA, national coast guards and environment agencies, courts |
| 9 | `shipping-ports-noise` | Shipping emissions, underwater noise, ship strikes, groundings, ballast water, port expansion and dredging | IMO, port authorities, national maritime regulators, IWC |
| 10 | `offshore-energy` | Offshore oil and gas leasing and incidents, offshore wind conflicts and build-out, decommissioning | BOEM and BSEE, national energy regulators, operators, courts |
| 11 | `deep-sea-mining` | ISA licences and rules, national seabed permits, moratoria, exploration incidents | International Seabed Authority, IUCN, DSCC, national governments |
| 12 | `coastal-habitats` | Mangrove, seagrass, kelp, salt-marsh and wetland loss, coastal development, land reclamation | Global Mangrove Watch, Ramsar, national environment agencies, satellite studies |
| 13 | `marine-wildlife` | Whale and dolphin strandings and entanglement, sea turtles, seabirds, sharks, marine disease, invasive species, extinction risk | IUCN Red List, IWC, CITES, NOAA, stranding networks |
| 14 | `polar-oceans-sea-ice` | Arctic and Antarctic sea ice, ice shelves, Southern Ocean krill, Arctic shipping routes | NSIDC, CCAMLR, Arctic Council, NASA, national polar programmes |
| 15 | `governance-treaties-disputes` | UNCLOS and BBNJ (High Seas Treaty) ratification, marine protected areas and 30x30, maritime boundary disputes, enforcement, ocean finance | UN, ITLOS and ICJ, Protected Planet, IUCN, national foreign and environment ministries |
| 16 | `aquaculture` | Fish-farm escapes, disease and sea lice, shrimp farming and mangrove loss, seaweed farming, antibiotic use | FAO, national aquaculture regulators, courts, news |
| 17 | `other` | Ocean issues that fit none of the above (for example tourism pressure, marine archaeology, cable damage) | |

**Issue layers** (replacing Infrastructure / Water Quality/Quantity / Both / Systemic/Financial):
`Climate & Physical`, `Pollution`, `Living Resources & Habitats`, `Governance & Economy`.

## 5. Geography model

The regional sea is the "state" of oceans.exposed: it drives the side panel, the tile map, coverage counts and the
daily re-verification rotation. Coordinates and the free-text location stay as on water.exposed.

| Field | Values |
|---|---|
| `location.basin` | `PAC`, `ATL`, `IND`, `SOU` (Southern), `ARC`, or `GLOBAL` |
| `location.sea` | One code from the list below; `location.seas[]` for findings spanning several |
| `location.countries[]` | ISO 3166-1 alpha-2 codes of the coastal states involved; `ABNJ` for the high seas (areas beyond national jurisdiction) |
| `location.extent` | `site`, `local`, `national_waters` (an EEZ), `regional_sea`, `basin`, `global` |
| `location.coordinates` | `{lat, lon, precision}` as today; precisions `exact`, `site`, `city`, `coastline`, `sea` |
| `id` | `OC-<SEA>-<PLACE>-<ISSUE>-<YEAR>`, e.g. `OC-CORAL-GBR-BLEACHING-2026` |

Regional seas (32; codes are the identifiers, names are display names):

| Basin | Seas |
|---|---|
| Pacific | `NPAC` North Pacific open ocean, `SPAC` South Pacific open ocean, `BERING` Bering Sea, `JPN` Sea of Japan / East Sea, `ECS` East China and Yellow Seas, `SCS` South China Sea, `SEA` Indonesian and Philippine seas, `CORAL` Coral Sea and Great Barrier Reef, `TASMAN` Tasman Sea, `NEPAC` U.S. and Canadian west coast, `TROPEPAC` Eastern tropical Pacific (Mexico to Peru, Galápagos), `SEPAC` Humboldt / Chile |
| Atlantic | `NATL` North Atlantic open ocean, `SATL` South Atlantic open ocean, `NWATL` U.S. and Canadian east coast, `GOM` Gulf of Mexico, `CAR` Caribbean, `NSEA` North Sea, `BAL` Baltic Sea, `NEATL` Northeast Atlantic (Celtic Seas, Bay of Biscay, Iberia), `MED` Mediterranean, `BLK` Black Sea, `GOG` Gulf of Guinea and West Africa, `BRA` Brazil and Argentina coasts, `SAFR` Southern Africa |
| Indian | `RED` Red Sea, `GULF` Persian Gulf and Arabian Sea, `BEN` Bay of Bengal and Andaman Sea, `WIND` Western Indian Ocean (East Africa, Madagascar, islands), `EIND` Eastern Indian Ocean (Australia west) |
| Southern | `SOUTHERN` Southern Ocean |
| Arctic | `ARCTIC` Arctic Ocean and marginal seas |

`coverage.regions_researched` (cumulative) replaces `states_researched`, reported as "N of 32 seas". Polygons are not
needed for version 1: the tile map places the 32 seas on a fixed grid, the way the state tile map does. A world
point map from `coordinates` can follow, using Natural Earth coastlines.

## 6. Severity rubric and record shape

The five components stay 0 to 2 each (total 0 to 10; Critical 9 to 10, High 7 to 8, Moderate 4 to 6, Low 0 to 3), so
the site's scoring, levels and charts work unchanged. Their meaning is redefined:

| Component | 0 | 1 | 2 |
|---|---|---|---|
| `harm` | None documented | Potential or limited ecological or human-health harm | Documented mass mortality, habitat loss, contamination above a standard, or human harm |
| `livelihoods` (was `service`) | No disruption | Restrictions, closures or advisories (fishery closure, beach closure, shipping restriction) | Loss of a fishery, displacement of a community, or a port or route out of use |
| `scale` | A site or a single reef, bay or stock | A regional sea or a national coastline | Basin-wide or global |
| `duration` | Days to weeks | Months | A year or more, chronic or recurring |
| `significance` | Informal reports | Formal notice, listing, violation or advisory | Enforcement order, court ruling, treaty action, emergency declaration, IUCN status change |

Other record fields are kept as on water.exposed (`title`, `description`, `status`, `population_affected`,
`key_measure`, `measures[]`, `trend`, `responsible_bodies[]`, `corrective_actions[]`, `sources[]`, `history[]`,
`verification`, `conflicts[]`, `related_ids[]`). `business_model_risk` is renamed `economic_risk` with the same levels
(for a fishery, a port, a coastal economy or an operator). `population_affected` is kept and may be null more often;
`measures[]` carries the figure that matters (area bleached, tonnes spilled, stock biomass against reference points).

Source rules carry over unchanged: every fact from a page opened during the run, `date` is the publication date and
`accessed` the day it was opened, database and dashboard lookups carry `accessed` only. The "no EPA-only finding" rule
becomes "no finding rests only on a dataset or dashboard: each needs a report, agency page, court record or news
article about the specific issue".

## 7. Publishing contract

- `contract/ocean-intelligence.schema.json`, `VERSION` 1.0.0, `CHANGELOG.md`, `examples/finding.feed.json`.
- `feed_name: "ocean-intelligence"`, `mode: "incremental"` for every research run, `snapshot` reserved for recovery.
- Validation on publish, as today: feed name and schema version, run date, unique ids, severity components 0 to 2,
  primary category and issue layer present, at least one dated http(s) source. Plus: `location.sea` or `basin` present
  and from the list.
- The contract process (`contract/README.md`) is kept: proposals by pull request or `contract-change` issue, the
  Contract check workflow, breaking changes only with the owner's own words.

## 8. Site

Pages: Overview (KPIs, executive summary, sea panel, sea tile map, ranked findings by category), Explorer (filters
persist in the URL, CSV export), Dossier, Changes & Coverage, Methodology, and `sea.html?code=` in place of
`state.html`. The API keeps the water.exposed shape under `/api/ocean/`:

| Endpoint | Returns |
|---|---|
| `GET /api/ocean/feed[?run=]` | Full feed |
| `GET /api/ocean/issues?category=&layer=&level=&sea=&basin=&country=&status=&trend=&min_score=&q=` | Filtered records with computed score and level |
| `GET /api/ocean/issues/:id` | One record (410 with a tombstone if merged or removed) |
| `GET /api/ocean/changes?since=` | Changed records, corrections, tombstones |
| `GET /api/ocean/summary` | Counts by level, category, layer, trend, sea and basin, plus coverage; `indicators` from 1.1 |
| `GET /api/ocean/runs` | Published runs |
| `POST /api/ocean/validate` | Pre-commit check without a token |
| `POST /internal/ocean/publish`, `PUT /internal/ocean/reports/<file>.pdf` | Publish (bearer token) |

## 9. Research operations

**Baseline pass (before the daily sweep is worth running).** One in-depth pass per regional sea, at the depth of the
Texas pass on water.exposed: a brief per sea listing existing findings, five research subagents in parallel by
category group, a self-check with `check.mjs`, merge by `assemble.mjs --seas`, URL spot-check, stage. Groups:

- A. Climate and physical: 1, 2, 3, 14
- B. Reefs, habitats and wildlife: 4, 12, 13
- C. Fisheries and aquaculture: 5, 16
- D. Pollution: 6, 7, 8
- E. Industry and governance: 9, 10, 11, 15, 17

Large seas (`SCS`, `MED`, `CAR`, `GOM`, `NWATL`, `NEPAC`, `CORAL`, `BEN`, `NSEA`, `BAL`) get all five agents; the open-ocean
and polar entries can merge A+B and C+D+E. Two or three seas per session, one run at a time, each run under about
1.5 MB. Order: the ten large seas first, then the rest. At the water.exposed rate this is about 12 to 15 sessions.
Global topical passes (plastics treaty, BBNJ ratification, deep-sea mining licences, the 2023 to 2026 global bleaching
event) run with `--topic` and do not mark a sea researched.

**Daily sweep** (the Daily research Action, prompt `docs/RESEARCH_PROMPT.md` of the new repository): the same depth
targets as water.exposed, retargeted:

1. Pending records, if any.
2. Monthly indicators (from 1.1).
3. Global sweep of the last 7 days: at least two searches per category (34 or more), across news, agency newsrooms,
   courts, regional fisheries bodies and treaty bodies; open directly, without a search, at least five of: NOAA
   newsroom, Copernicus Marine news, IMO press, FAO news, UNEP news, ISA news, IUCN news, EEA, the European Commission
   oceans and fisheries page, and two national agencies in rotation; name them in `NOTES.md`.
4. Re-verify two seas a day in rotation by the oldest `verification.last_verified`.
5. Re-check five low-confidence findings.
6. `NOTES.md` with searches per category and per sea, pages opened and failed, and what is left.

Sources in other languages are allowed when they are official (a ministry, a coast guard, a court); the record notes
the language. Model policy as on water.exposed: Sonnet for the Action and child sessions, Haiku for mechanical jobs,
the owner's coordinating session on the strongest model.

**Cost.** The first water.exposed daily run cost $1.49 at list price for 73 turns and did not reach its targets; a run
that does should land between about $5 and $15. Budget the workspace at $150 a month to start and read the first
week of `RUN.json` files.

## 10. Owner setup checklist

Do these in order. Each step is short; the whole list is about 45 minutes. Never paste any token into chat, the
repository or a file.

**A. GitHub repository (5 min)**

1. Create `Carboman/oceans-exposed` on GitHub, empty (no README), same visibility as `water-exposed`.
2. Create the labels: `claude-task`, `data-quality`, `publish-failed`, `research-stale`, `contract-change`,
   `breaking`. (Claude Code can do this with `gh label create` once it has the repository.)
3. In the Claude Code web app, start a session on `Carboman/oceans-exposed` (or add it to a session with the
   repository picker) and give it this document: `docs/OCEANS_EXPOSED_PLAN.md` in `water-exposed`, plus your answers
   to section 2. It does the port (section 11, phase 1). If the repository does not show up, GitHub access for the
   Claude app must include it: https://github.com/apps/claude/installations/select_target.

**B. Cloudflare (15 min)**

1. The zone `oceans.exposed` is already in the account (`a0268f33dbddbfc9ca056d7575f661b3`). Open DNS for it and make
   sure the apex (`oceans.exposed`) has no A, AAAA or CNAME record, and no proxied placeholder. Wrangler creates the
   custom-domain record itself on the first deploy and fails if one is in the way. A `www` record is optional; if you
   want `www.oceans.exposed`, add it as a second route later.
2. Create the R2 bucket `oceans-exposed-reports` (dashboard: R2 Object Storage → Create bucket; or
   `npx wrangler r2 bucket create oceans-exposed-reports` from a machine logged in to Wrangler). Location hint: leave
   automatic. No public access.
3. Create an API token for the deploy, following `docs/AUTO_DEPLOY_SETUP.md` Part 1 exactly, with two differences:
   name it `github-actions-oceans-exposed`, and in Zone Resources include the zone **oceans.exposed** (not
   water.exposed). A separate token means rotating one site's token never breaks the other. Copy the token once.
4. Generate a publish token on your own machine: `openssl rand -hex 32`. Keep it for steps C2 and C3.

**C. GitHub secrets for the new repository (5 min)**

At https://github.com/Carboman/oceans-exposed/settings/secrets/actions add:

1. `CLOUDFLARE_API_TOKEN`: the token from B3.
2. `PUBLISH_TOKEN`: the value from B4.
3. `ANTHROPIC_API_KEY`: a key created inside a **new** Console workspace named `oceans-exposed` (Console → Settings →
   Workspaces → Create, set its monthly spend limit; then Settings → API Keys → Create Key in that workspace). Never
   reuse the water.exposed or waste.exposed key: the spend limits and cost reports are per workspace.
   Optional variables: `RESEARCH_MODEL` (default `claude-sonnet-5-5`), `RESEARCH_FALLBACK_AUTO` (leave unset until a
   few clean daily runs).

**D. The Worker secret (2 min, after the first deploy)**

The Worker reads the publish token from its own secret, separate from the GitHub secret. After the first Deploy site run
succeeds, set it once from a machine logged in to Wrangler, in the new repository's checkout:
`npx wrangler secret put PUBLISH_TOKEN` and paste the value from B4. (Or: Cloudflare dashboard → Workers & Pages →
`oceans-exposed` → Settings → Variables and Secrets → Add → type Secret.) Until this is set, publishes return 401 and
the Stage runs Action files a `publish-failed` issue, which is harmless.

**E. Check (5 min)**

1. Actions → Deploy site shows `Uploaded oceans-exposed` and `oceans.exposed (custom domain)`.
2. https://oceans.exposed renders the sample feed with the sample-data banner.
3. `curl -s https://oceans.exposed/api/ocean/summary` answers.
4. Actions → Daily research → Run workflow once by hand, with the note "first run: global sweep only". Read the job
   summary and `runs/<folder>/RUN.json` for the cost.

## 11. Phases

| Phase | Who | What | Done when |
|---|---|---|---|
| 0. Setup | Owner | Section 10 A to C | Repository, bucket, token and secrets exist |
| 1. Port | Claude Code, one session | Section 3: copy the code, rebrand, replace geography and categories, write contract 1.0.0, docs, tools, workflows, tests; sample feed; deploy | `npm run check` clear; Deploy site green; site live with the sample banner; owner does 10 D and E |
| 2. Baseline research | Claude Code sessions, 12 to 15 of them | Section 9: in-depth pass per sea, large seas first; global topical passes | `coverage.regions_researched` 32 of 32; sample banner off |
| 3. Daily operation | Daily research Action | Daily sweep, watchdog, cost report | Seven clean daily runs; then turn on `RESEARCH_FALLBACK_AUTO` |
| 4. Version 1.1 | Claude Code | Ocean indicators baseline (`tools/ocean-indicators.py`, `indicators` in the summary API, the KPI tile), world point map, infographic | Contract 1.1.0 shipped |

## 12. Risks and how the design handles them

- **Thin or dashboard-only sourcing.** The rule that every finding needs a report, agency page, court record or news
  article about the specific issue, enforced by the quality check and the research prompt.
- **Duplicate or overlapping findings across seas.** Ids carry the sea; `assemble.mjs` drops ids already live; a
  finding spanning seas uses `seas[]` once rather than one record per sea.
- **Scope creep into water.exposed.** The boundary in decision 4 goes into both sites' `RESEARCH.md`.
- **Cost.** Workspace spend limit, `RUN.json` per run, `cost-report.mjs`, one run at a time, 700-turn cap.
- **Two sites diverging.** Fixes to shared logic (validation, quality, publish tools, workflows) are ported by hand in
  the session that makes them; `docs/OPERATIONS.md` of each site names the other.
