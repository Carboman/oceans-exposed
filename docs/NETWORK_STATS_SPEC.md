# The network stats contract (version 1.0.0)

Every site in the earth.exposed network publishes two files at fixed paths. The hub fetches them twice a day,
validates them (`src/validate.js`, schemas in `contract/`), and shows what they say. A file that fails validation is
ignored and the site's last good data stays on the hub, marked stale.

Both files: `Content-Type: application/json` (the layer may use `application/geo+json`),
`Cache-Control: public, max-age=300`, `Access-Control-Allow-Origin: *`, under 3 MB.

## `GET /network/stats.json`

| Field | Required | Rule |
|---|---|---|
| `schema` | yes | `"earth.exposed/network-stats/1"` |
| `site` | yes | The host, like `oceans.exposed` |
| `url` | yes | `https://` origin of the site |
| `tagline` | yes | 3 to 120 characters |
| `scope` | no | One sentence, up to 300 characters: what the site covers |
| `headline` | yes | A **fact** (below) |
| `facts` | no | Up to 5 more facts |
| `records` | yes | Integer: public records currently on the site |
| `sources` | no | Integer: cited sources behind those records |
| `last_run` | yes | `YYYY-MM-DD` of the site's last published run |
| `map_layer` | no | `https://` URL of the site's layer file (normally `/network/layer.geojson`) |
| `generated_at` | yes | ISO 8601 UTC, like `2026-10-12T18:00:00Z` |
| `derived` | no | Only the hub's adapter sets this (how the file was derived) |

A **fact** is `{ text, value, unit, source: { name, url, date }, pulled }`:

- `text`: 5 to 160 characters, a plain statement of the number ("7 sourced ocean findings across 5 regional seas").
- `value`: a number; `unit`: 1 to 40 characters ("findings", "sources", "km", "percent").
- `source.name`: the public source as a reader would cite it; `source.url`: an `https` link to it; `source.date`:
  `YYYY-MM-DD` of the source document, not in the future.
- `pulled`: `YYYY-MM-DD` the value was taken from the source.

Unknown fields are rejected. The whole file is rejected if it contains any term in the hub's forbidden list
(`network/sites.json` → `forbidden_terms`: company names and credit lines).

What makes a good headline: a number from a named public body with a dated document is best ("NOAA: 2025 global
sea surface temperature..."), and the site's own public data feed is acceptable for counts of what the site tracks
("7 sourced ocean findings", source: the site's `/api/.../feed`, date: the run date). A number without a source is
not a fact for this network.

## `GET /network/layer.geojson`

A GeoJSON `FeatureCollection` with optional `site` and `generated_at`. Up to 5,000 features. Each feature:

- `geometry`: a `Point` `[lon, lat]`, **or** `null` with `properties.region` `{ "type": "us-state", "code": "AL" }`
  (the hub places it at the state centroid and labels it as placed).
- `properties`: `site`, `id`, `title` (up to 200 characters), `url` (`https`, the finding on the site); optional
  `level`, `category`, `date`, `count` (for an aggregated feature; the hub scales the point by it).

A site with thousands of records may aggregate (one feature per state or sea with a `count` and a link to that
state's or sea's page). A site with coordinates should publish one feature per public record.

## Changing the contract

Propose a change as a pull request on `contract/` in the hub's repository with a `contract-change` label. A change
that would reject a file a site currently publishes is `breaking` and needs the owner's approval. Bump
`contract/VERSION` and add to `contract/CHANGELOG.md`.
