# Correction run, 2026-10-12: contract 1.0.1 (nulls, not empty strings)

Code-lane correction, no research. Contract 1.0.1 made the schema and the publish validator agree: an unknown
`responsible_bodies[].contact` is `null` (never an empty string) and a source `date` is `YYYY[-MM[-DD]]` or `null`.
This run republishes every live record that carried an empty-string or placeholder ("Not found") contact or the word "None" as a source date, with
`revision` + 1, `change_type` `changed`, a history entry naming each field, and a `corrections[]` entry per field.
Findings, scores, sources and locations are unchanged. The run folders that first carried these values stay exactly as
published and are listed as historical in `site.config.json`.

- Records republished: 31
- Corrections: 46
