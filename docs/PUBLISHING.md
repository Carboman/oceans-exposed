# Publishing a run (the publish API)

Base URL: `https://oceans.exposed`. Both write calls need `Authorization: Bearer <PUBLISH_TOKEN>`. The token is a
Worker secret (`npx wrangler secret put PUBLISH_TOKEN`) and the same value is the `PUBLISH_TOKEN` repository secret
the Actions use. Never put it in the repo.

In normal operation nobody calls these endpoints by hand: the research lane commits `runs/<folder>/feed.json` to
`staging/<folder>`, and the **Stage runs** and **Publish runs** Actions call them through `tools/publish-run.mjs`
(`docs/WORKFLOW.md`). This page documents what they do.

## 1. Upload the PDF (optional, do this first)

```
PUT /internal/ocean/reports/Global-Ocean-Issues-Dossier-YYYY-MM-DD.pdf
Content-Type: application/pdf
<raw PDF bytes>
```

The filename must match `[A-Za-z0-9._-]+.pdf`. The body must start with `%PDF-` and be at most 50 MB.

## 2. Publish the feed

```
POST /internal/ocean/publish            (add ?dry_run=1 to validate without writing)
Content-Type: application/json
<feed JSON per contract/ocean-intelligence.schema.json or docs/FEED_SPEC.md, with source_report.file set to the PDF filename if any>
```

On success the Worker writes `feeds/runs/<run.run_date>[-N].json` and `feeds/latest.json`.
The site shows the new run within about 5 minutes (cache TTL). Responses:
`200 {ok:true, run_date, revision, records, keys[]}` · `401` bad or missing token · `422 {errors:[...]}` invalid feed or missing PDF.

### Accepted formats

- **The research lane's native `ocean-intelligence` feed** (`feed_name: "ocean-intelligence"`) is converted by
  `src/adapt.js`. The run date is `run_date`, else `generated_at`'s date, else `research_window.end`.
  `research_window` and `coverage.date_window` give the research dates. `source_limitations` and `notes` become
  coverage gaps, `missing_fields` becomes unverified fields, and `regions_researched` is unioned with the live list.
  Category display names ("Coral Reefs", "coral bleaching", "sea level rise") map to slugs. A sea given by name is
  resolved to its code; sea, basin and country codes are upper-cased. Severity components may be numbers or
  `{score, rationale}` objects, under keys such as `health_or_environmental_harm` or `livelihoods`. Common record
  aliases (`finding_id`, `primary_issue_layer`, `current_status`, `public_summary`, `regional_sea`, `ocean`,
  `country`, `latitude`/`longitude`/`lng`, `link`/`source_date`, `business_model_risk` for `economic_risk`) are
  accepted, and near-miss enum values are corrected (`corrected` → `changed`, `Volatile Mixed` → `Volatile or Mixed`,
  risk level `High` → `Elevated`).
- **`mode: "snapshot"`** replaces the live feed. **`mode: "incremental"`** merges records by `id` into the live feed,
  applies `tombstones` (removes those ids), and keeps the live summary, milestones, category notes, indicators,
  report link and coverage detail unless new ones are sent. Every research run is incremental; a snapshot is
  reserved for recovery.
- **The site format** (docs/FEED_SPEC.md) is accepted unchanged.

### Safety rules

- Every authenticated, non-dry-run payload is archived as received under `feeds/raw/` before conversion.
- A snapshot with zero records is refused (`empty_snapshot`) unless `?allow_empty=1`.
- A run dated earlier than the live run is refused unless `?allow_older=1`.
- Always try `?dry_run=1` first. It converts and validates without writing anything.
- Publishing the same content for the same day twice reuses the snapshot key (idempotent); different content on
  the same day gets `-2`, `-3`...

## Example

```bash
curl -X PUT -H "Authorization: Bearer $PUBLISH_TOKEN" -H "Content-Type: application/pdf" \
  --data-binary @dossier.pdf https://oceans.exposed/internal/ocean/reports/Global-Ocean-Issues-Dossier-2026-11-09.pdf
curl -X POST -H "Authorization: Bearer $PUBLISH_TOKEN" -H "Content-Type: application/json" \
  --data-binary @feed.json "https://oceans.exposed/internal/ocean/publish?dry_run=1"
```

## Public read endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/ocean/feed[?run=YYYY-MM-DD[-N]]` | Full feed (latest, or a past run) |
| `GET /api/ocean/issues?category=&layer=&level=&sea=&basin=&country=&status=&economic_risk=&trend=&min_score=&q=` | Filtered records with computed `severity_score` and `issue_level`; echoes `filters_applied`. `sea` matches `location.sea` or any of `seas[]`; `basin` matches the given or derived basin; `country` matches any of `countries[]`; `q` searches id, title, description and location |
| `GET /api/ocean/issues/:id` | One record (`410` with a tombstone if merged or removed) |
| `GET /api/ocean/changes?since=YYYY-MM-DD` | Changed records, corrections, tombstones, `next_cursor` |
| `GET /api/ocean/summary` | `summary`: counts by level, category, layer, trend, basin (`by_basin`) and sea (`by_sea`, a finding spanning several seas counts in each); plus `coverage` (with `regions_researched`), `source_report`, and `indicators` (`null` until contract 1.1.0) |
| `GET /api/ocean/runs` | Published run snapshots (`run`, `run_date`, `uploaded`, `size`) |
| `POST /api/ocean/validate` | **Pre-commit check.** Post a feed.json; returns `{ok, errors[], warnings[], records, run_date, mode, bytes}` using the same conversion, validation and quality checks as publishing. No token, nothing stored, 25 MB limit. |
| `GET /reports/latest.pdf`, `GET /reports/<file>.pdf` | Report PDFs |

Responses are JSON with `access-control-allow-origin: *`, cached for 300 seconds, with an `etag` (send
`if-none-match` for a 304).
