# Site feed contract

This is the JSON shape that `POST /internal/ocean/publish` accepts and the site renders (`feed_name` `ocean-issues`).
It is stored in R2 as `feeds/latest.json` and `feeds/runs/<run_date>[-N].json`. The research lane never writes it
directly: it commits the native `ocean-intelligence` feed (`contract/ocean-intelligence.schema.json`, contract 1.0.0)
and `src/adapt.js` converts it on publish, merging an incremental run into the live feed by `id`. This document
describes the converted result, which is what every `/api/ocean/*` endpoint returns. The vocabulary (categories,
layers, components) is `src/model.js`; the geography (basins, seas, precisions, extents) is `src/geo.js`.
Unknown extra fields are kept but not shown. Missing optional fields render as "Not reported" or "None".

## Top level

| Field | Required | Notes |
|---|---|---|
| `feed_name`, `schema_version` | yes | `ocean-issues` and `agent-<contract version>` after conversion |
| `source_feed` | no | Set by the converter: `{feed_name, schema_version, run_id, mode, cursor, next_cursor}` of the run as committed |
| `sample` | no | `true` shows the sample-data banner |
| `source_report` | no | `{title, file, pages}`. `file` must already be uploaded to `reports/` (see PUBLISHING.md); the Worker sets `url`. An incremental run keeps the live one |
| `summary` | no | `{highest_risk, directional_picture, cross_cutting[{label, text}]}`. Public prose about the ocean; an incremental run without one keeps the live summary |
| `category_notes` | no | `{<category slug>: {text, sources[]}}`, shown when a category has no ranked finding |
| `milestones[]` | no | Resolved or stabilized items that are not ranked: `{title, category, status, date, text, sources[]}` |
| `generated_at` | yes | ISO timestamp |
| `run` | yes | `mode` (snapshot or incremental), `run_id`, `run_date`, `research_start`, `research_end`, `prior_run_date`, `revision` |
| `filters_applied` | no | Echo of filters actually applied |
| `records[]` | yes | See below |
| `corrections[]` | no | `{id, date, field, from, to, reason}`; cumulative across incremental runs |
| `tombstones[]` | no | `{id, change_type: "merged"/"removed", merged_into?, reason}`. The dossier URL for a tombstoned ID shows the merge or removal; cumulative |
| `coverage` | yes | `date_range`, `searched_geography[]`, `categories[{slug, researched}]`, `regions_researched[]` (sea codes, cumulative: the site unions it with the live list), `unverified_fields[]`, `gaps[]`, `exhaustive`, `scope_limits`, `baseline_note`, `statement` |
| `errors[]` | no | `{code, message}` |
| `indicators` | no | Reserved for contract 1.1.0 (monthly ocean indicators: global sea-surface temperature anomaly, sea-ice extent, sea level, surface pH, coral bleaching alert area). Not validated or shown yet; `/api/ocean/summary` returns it as `null` until then. A run without it keeps the live block |

## Record

| Field | Notes |
|---|---|
| `id` | Stable finding ID, `OC-<SEA>-<PLACE>-<ISSUE>-<YEAR>`, e.g. `OC-CORAL-GBR-BLEACHING-2026` (upper-case letters, digits and hyphens) |
| `revision`, `change_type` | `new · changed · escalated · de-escalated · resolved · reopened · unchanged` |
| `public` | `false` withholds the record from the site |
| `title`, `description` | Public-safe summary; both non-empty |
| `location` | `name` (the reef, stock, place, facility or sea, 60 characters or fewer), `type` (specific: "Coral reef system", "Fish stock", "Port", "Offshore lease area", "Treaty process"...), `sea` (one code) or `seas[]` (several), `basin` (`PAC · ATL · IND · SOU · ARC · GLOBAL`; derived from the sea when omitted, required when there is no sea), `countries[]` (ISO 3166-1 alpha-2, `ABNJ` for the high seas), `detail`, `coordinates` `{lat, lon, precision, source_ref}`, `points[]` of the same shape plus `role`, `extent` (`site · local · national_waters · regional_sea · basin · global`). Precisions: `exact · site · city · coastline · sea`. A record needs a sea, seas or a basin |
| `primary_category` | One slug (below). `secondary_categories[]` same slugs |
| `issue_layer` | `Climate & Physical · Pollution · Living Resources & Habitats · Governance & Economy` |
| `layer_rationale`, `secondary_drivers[]` | |
| `severity.components` | `harm, livelihoods, scale, duration, significance`, each 0–2. **The site computes the total and level from these** (Critical 9–10, High 7–8, Moderate 4–6, Low 0–3). A declared `severity.level` that disagrees triggers a visible warning |
| `severity.notes` | Per-component evidence sentence citing a source ref |
| `status` | Free text; preferred `Ongoing Major Issue · Corrective Action Underway · Monitoring or Emerging Risk · Resolved or Stabilized`. Anything starting with "Resolved" counts as inactive |
| `population_affected` | `{value, status: Reported/Estimated/Not reported, note}`; often null at sea |
| `key_measure` | `{status, text}`: the headline measure as the source states it |
| `measures[]` | `{name, value, unit, status, note, text}`: the figure that matters (area bleached, tonnes spilled, biomass against a reference point). A unit starting with `USD` renders as dollars. For non-numeric statements such as "about half the stock", use `text` with `value: null` |
| `economic_risk` | `{level: Severe/Elevated/Watch/Not Indicated/Unknown, signals[]}`: risk to the economic base behind the finding (a fishery, a port, a coastal economy, an operator). `business_model_risk` is accepted as an alias and renamed |
| `trend` | `{direction: Worsening/Improving/Stable/Volatile or Mixed/Insufficient History, note, projection: null, a sentence, or {statement, horizon, confidence, assumptions[], reversal_factors[]}}` |
| `responsible_bodies[]` | `{name, role, contact}`. `contact` must be an http(s) URL; other schemes are not linked |
| `public_contact` | Plain text as published by the responsible office (shown as text, never as a mailto link) |
| `corrective_actions[]` | |
| `sources[]` | `{ref, title, publisher, date, accessed, url, basis}`. `date` is when the source was published or issued, or `null` when the page shows no date (YYYY-MM or YYYY is accepted when the source gives only a month or a year); `accessed` is the day it was opened (YYYY-MM-DD). Database and dashboard lookups carry `accessed` only. Never put an access date in `date`: timelines use `date`. At least one http(s) source with `date` or `accessed` (enforced on publish) |
| `history[]` | `{date, status, score, note}`, appended each run and never erased |
| `first_seen`, `latest_seen` | |
| `verification` | `{status, last_verified, confidence}` |
| `conflicts[]` | `{field, values[], note}`; a plain sentence is accepted as a note |
| `missing_fields[]`, `related_ids[]` | |
| `network_tags[]`, `shared_ids`, `cross_refs[]` | Optional network links (contract 1.1.0): registry tag keys; public IDs by type (`epa_frs`, `eia_plant`, `eia_utility`, `pwsid`, `iaea_reactor`, `court_docket`, `fips`), each an array of strings; links `{site, id, relation, source?, basis?}` to findings on other network sites, `relation` one of `same-event`, `causes`, `caused-by`, `same-facility`, `same-policy`, `supersedes`; a cause requires `source` (name, https url, date) and `basis` (10 to 200 characters). Published at `/network/links.json` |

## Category slugs (display order)

`ocean-warming-heatwaves`, `sea-level-coastal-flooding`, `acidification-deoxygenation`, `coral-reefs`,
`fisheries-overfishing`, `plastics-marine-debris`, `nutrient-pollution-dead-zones`, `chemical-oil-pollution`,
`shipping-ports-noise`, `offshore-energy`, `deep-sea-mining`, `coastal-habitats`, `marine-wildlife`,
`polar-oceans-sea-ice`, `governance-treaties-disputes`, `aquaculture`, `other`

## Sea codes (display names in `src/geo.js`)

Pacific: `NPAC SPAC BERING JPN ECS SCS SEA CORAL TASMAN NEPAC TROPEPAC SEPAC`. Atlantic: `NATL SATL NWATL GOM CAR
NSEA BAL NEATL MED BLK GOG BRA SAFR`. Indian: `RED GULF BEN WIND EIND`. Southern: `SOUTHERN`. Arctic: `ARCTIC`.

## Ranking

Rank is computed per category: severity total descending, then the newest source date as a tie-breaker. No global
rank across categories is shown.

## Enforced on publish

`src/validate.js` (with `src/geo.js`) rejects a feed with HTTP 422 and per-field errors when:

- `feed_name`, `schema_version`, `run.run_date` (YYYY-MM-DD), `records[]` or `coverage` is missing
- a record has no `id`, or its `id` duplicates another record's
- `severity.components` is missing, or a component is not 0, 1 or 2
- `primary_category` is missing or not one of the slugs above
- `issue_layer` is missing or not one of the four layers
- a record has no http(s) source with `date` or `accessed`, or an `accessed` value is not YYYY-MM-DD
- `location.sea`, an entry of `location.seas[]` or `location.basin` is not in the lists, or the record has none of them
- `location.countries[]` holds anything other than ISO alpha-2 codes or `ABNJ`
- `location.coordinates` or an entry of `location.points[]` has `lat` outside -90..90, `lon` outside -180..180 or an unknown `precision`
- `location.extent` is not one of the six values

Content-quality warnings (`src/quality.js`) never block publishing; they are filed as a `data-quality` issue:
`notes-missing`, `notes-boilerplate`, `notes-template`, `description-missing`, `location-type-generic`, `name-long`,
`name-changed`, `trend-reset`, `projection-dropped`, `milestones-dropped`, `records-dropped`, `rescored-silently`,
`balance` (one sea dominates), `summary-process-notes`, `sources-dataset-only`, `location-unmappable`,
`location-approximate`.

## Nulls (contract 1.0.1)

Unknown optional fields are `null`, never an empty string or a placeholder word. In particular `responsible_bodies[].contact`
is an https URL or null, a source `date` is `YYYY[-MM[-DD]]` or null, `location.coordinates` is a point or null, and a
measure with a numeric value always has a string `unit`. The validator rejects the rest; the adapter normalises legacy
empty strings and "None" to null when older runs are republished.
