# Contract changelog

## 1.0.0 (2026-10-12): first ocean contract

- `ocean-intelligence.schema.json` codifies what the research lane commits as `runs/<folder>/feed.json`:
  `feed_name` `ocean-intelligence`, `schema_version` 1.x, `mode` snapshot or incremental (every research run is
  incremental; snapshot is reserved for recovery), the envelope (`summary`, `category_notes`, `milestones`,
  `corrections`, `tombstones`, `coverage`), and the record: severity components 0 to 2, a primary category and an
  issue layer from the lists, at least one http(s) source with `date` or `accessed`.
- Derived from the water.exposed contract 1.4.1, with these differences:
  - **Geography.** `location.sea` (one of the regional-sea codes in `src/geo.js`) or `location.seas[]`, `location.basin`
    (`PAC`, `ATL`, `IND`, `SOU`, `ARC`, `GLOBAL`), `location.countries[]` (ISO 3166-1 alpha-2, `ABNJ` for the high
    seas), `location.extent` (`site`, `local`, `national_waters`, `regional_sea`, `basin`, `global`) and coordinate
    precisions `exact`, `site`, `city`, `coastline`, `sea` replace the state, county, system-ID and county-based
    fields. A record needs a sea (or seas) or a basin. `coverage.regions_researched[]` (sea codes, cumulative)
    replaces the per-state coverage list.
  - **Categories.** Sixteen ocean categories plus `other` (`src/model.js`), in place of the thirteen freshwater ones.
  - **Issue layers.** `Climate & Physical`, `Pollution`, `Living Resources & Habitats`, `Governance & Economy`.
  - **Severity.** The component `service` becomes `livelihoods`; all five keep the 0 to 2 scale with the rubric
    redefined for the ocean (`docs/OCEANS_EXPOSED_PLAN.md` section 6), so scoring, levels and charts are unchanged.
  - **Economic risk.** `business_model_risk` is renamed `economic_risk` with the same levels and `signals[]`;
    the old name is accepted as an alias and renamed on publish.
  - **Dropped.** The per-record financial evidence block, the run-level financial coverage and the system baselines
    of the water contract are not part of this one; if sent, they are kept as unknown fields and never shown.
  - **Reserved.** Top-level `indicators` for contract 1.1.0 (monthly ocean indicators: global sea-surface temperature
    anomaly, sea-ice extent, sea level, surface pH, coral bleaching alert area). Not validated or shown yet; a run
    without it keeps the live block.
  - **Ids.** `OC-<SEA>-<PLACE>-<ISSUE>-<YEAR>`.
- Carried over unchanged from 1.4.1: source `date` is the publication or issue date (null, month or year precision
  allowed) and `accessed` the day it was opened; the tolerant shapes (`conflicts[]` and `trend.projection` as a
  sentence, list fields as one string, non-numeric `measures[].value` moved to `text`, near-miss enum values); `status`
  as free text with four preferred values; `public_contact` never a mailto link.
- Validation on publish (`src/validate.js`, `src/geo.js`): feed name, schema version, run date, unique ids, severity
  components 0 to 2, primary category and issue layer from the lists, at least one dated http(s) source, sea, basin,
  country, coordinate and extent values from the lists, and a sea or basin present.
- Governance: owner, proposer (Claude Code or the owner) and implementer roles; proposal flow in `contract/README.md`.
