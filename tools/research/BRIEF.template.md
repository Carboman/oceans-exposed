# {{SEA_NAME}} research brief (oceans.exposed)

You are researching **documented ocean and coastal issues in the {{SEA_NAME}} ({{SEA}}, basin {{BASIN}})** for
oceans.exposed, a public, sourced tracker. Your output is a JSON array of finding records in the exact format below.
Accuracy beats volume: every fact must come from a source you actually opened (WebFetch or curl) in this session.
Never invent a URL, a date, a number or a quote. If you cannot verify something, leave it null with status "Not reported".

**Research window:** issues active or documented between {{WINDOW_START}} and {{TODAY}} (today is {{TODAY}}).
Older issues count only if still unresolved inside the window.

**What counts as a finding:** a specific, documented problem at a named reef, stock, bay, coast, port, platform,
protected area, country's waters or treaty process, with official or reputable sourcing: NOAA, Copernicus Marine,
FAO, UNEP, IMO, the ISA, IUCN, regional fisheries bodies, regional sea conventions (HELCOM, OSPAR, UNEP regional
seas), national maritime and environment agencies and coast guards, courts and tribunals (ITLOS, ICJ, national
courts), port and reef park authorities, peer-reviewed studies, and credible regional and national news. Sources in
other languages are allowed when they are official (a ministry, a coast guard, a court); say so in `basis`.
Prefer primary sources; add news for context. Two sources or more per finding where possible. **No finding may rest
only on a dataset or dashboard** (Coral Reef Watch, OISST, Copernicus, Global Fishing Watch, NSIDC, Protected
Planet, a vessel tracker): each needs a report, agency page, court record or news article about the specific issue.

**Scope:** marine and coastal only. Freshwater, drinking water, groundwater and inland flooding belong to the sister
site water.exposed. Coastal flooding from sea level or storm surge, marine algal blooms and the dead zone a river
causes at sea are in scope; inland stormwater, freshwater blooms and the river's own nutrient load are not.

**Do not duplicate these existing {{SEA_NAME}} findings** (already on the site; you may cite them in `related_ids`):
{{EXISTING_IDS}}
Other agents cover the other categories in parallel; stay in your assigned categories. A finding that spans several
seas is one record with `seas[]`, not one per sea.

## Starting sources by category

| Category | Start from |
|---|---|
| `ocean-warming-heatwaves` | NOAA OISST and Coral Reef Watch, Copernicus Marine, national met offices |
| `sea-level-coastal-flooding` | NASA and NOAA sea level, PSMSL, national coastal agencies, city plans |
| `acidification-deoxygenation` | GOA-ON, NOAA PMEL, IOC-UNESCO, IPCC |
| `coral-reefs` | NOAA Coral Reef Watch, GCRMN, AIMS, ICRI, reef park authorities |
| `fisheries-overfishing` | FAO SOFIA, regional fisheries bodies (ICCAT, WCPFC, NAFO, CCAMLR), ICES, NOAA Fisheries, Global Fishing Watch, courts |
| `plastics-marine-debris` | UNEP, the plastics treaty INC, Ocean Conservancy, national coast guards |
| `nutrient-pollution-dead-zones` | NOAA hypoxia forecasts, HELCOM, OSPAR, EEA, national environment agencies |
| `chemical-oil-pollution` | ITOPF, IMO, IAEA, national coast guards and environment agencies, courts |
| `shipping-ports-noise` | IMO, port authorities, national maritime regulators, IWC |
| `offshore-energy` | BOEM and BSEE, national energy regulators, operators, courts |
| `deep-sea-mining` | International Seabed Authority, IUCN, DSCC, national governments |
| `coastal-habitats` | Global Mangrove Watch, Ramsar, national environment agencies, satellite studies |
| `marine-wildlife` | IUCN Red List, IWC, CITES, NOAA, stranding networks |
| `polar-oceans-sea-ice` | NSIDC, CCAMLR, Arctic Council, NASA, national polar programmes |
| `governance-treaties-disputes` | UN, ITLOS and ICJ, Protected Planet, IUCN, national foreign and environment ministries |
| `aquaculture` | FAO, national aquaculture regulators, courts, news |
| `other` | Anything that fits none of the above (tourism pressure, marine archaeology, cable damage) |

## Record format (exact field names)

```json
{
  "id": "OC-{{SEA}}-<PLACE>-<ISSUE>-<YEAR>",
  "revision": 1,
  "change_type": "new",
  "title": "Mass coral bleaching across the northern reef sector after the 2026 marine heatwave",
  "description": "2-3 sentence public-safe summary of the documented facts. The reef authority's aerial survey found bleaching on most surveyed reefs after four months of thermal stress. No unsupported accusations.",
  "location": {
    "name": "Northern reef sector (max 60 chars)",
    "type": "Coral reef system",
    "sea": "{{SEA}}", "seas": ["{{SEA}}"],
    "basin": "{{BASIN}}",
    "countries": ["AU"],
    "detail": "Country, coast and regional context",
    "coordinates": { "lat": -14.67, "lon": 145.45, "precision": "site", "source_ref": 1 },
    "points": [],
    "extent": "regional_sea"
  },
  "primary_category": "coral-reefs",
  "secondary_categories": ["ocean-warming-heatwaves"],
  "issue_layer": "Living Resources & Habitats",
  "layer_rationale": "One sentence: habitat loss driven by thermal stress.",
  "secondary_drivers": ["Marine heatwave"],
  "severity": {
    "components": { "harm": 2, "livelihoods": 1, "scale": 1, "duration": 1, "significance": 1 },
    "notes": { "harm": "...", "livelihoods": "...", "scale": "...", "duration": "...", "significance": "..." }
  },
  "status": "Ongoing Major Issue",
  "population_affected": { "value": null, "status": "Not reported", "note": "No population figure in the cited sources." },
  "key_measure": { "status": "Reported", "text": "The headline measure exactly as the source states it, e.g. 73% of surveyed reefs showed bleaching." },
  "measures": [ { "name": "Reefs with bleaching", "value": 73, "unit": "%", "status": "Reported", "note": "Aerial survey, March 2026 (ref 1)." } ],
  "economic_risk": { "level": "Watch", "signals": ["Reef tour operators reported cancellations (ref 2)."] },
  "trend": { "direction": "Insufficient History", "note": "" },
  "responsible_bodies": [ { "name": "<reef park authority, ministry, regulator or treaty body>", "role": "Reef manager", "contact": "https://..." } ],
  "public_contact": "Office's published general channel, plain text, no mailto",
  "corrective_actions": ["..."],
  "sources": [
    { "ref": 1, "title": "...", "publisher": "...", "date": "YYYY-MM-DD", "accessed": "{{TODAY}}", "url": "https://...", "basis": "Agency report" },
    { "ref": 2, "title": "...", "publisher": "...", "date": "YYYY-MM-DD", "accessed": "{{TODAY}}", "url": "https://...", "basis": "News" }
  ],
  "history": [ { "date": "{{TODAY}}", "status": "Ongoing Major Issue", "score": 6, "note": "New record ({{SEA}} in-depth pass)." } ],
  "first_seen": "{{TODAY}}", "latest_seen": "{{TODAY}}",
  "verification": { "status": "Verified through cited source date(s)", "last_verified": "{{TODAY}}", "confidence": "Medium" },
  "conflicts": [], "missing_fields": [], "related_ids": []
}
```

The values above show the format; replace every one of them with what your sources say. A global or open-ocean
finding with no single sea uses `"basin": "GLOBAL"` (or the basin code), `"countries": ["ABNJ"]` and
`"extent": "global"` or `"basin"`, and omits `sea`.

**Allowed values**
- `primary_category`: ocean-warming-heatwaves, sea-level-coastal-flooding, acidification-deoxygenation, coral-reefs,
  fisheries-overfishing, plastics-marine-debris, nutrient-pollution-dead-zones, chemical-oil-pollution,
  shipping-ports-noise, offshore-energy, deep-sea-mining, coastal-habitats, marine-wildlife, polar-oceans-sea-ice,
  governance-treaties-disputes, aquaculture, other
- `issue_layer`: Climate & Physical, Pollution, Living Resources & Habitats, Governance & Economy
- `status`: Ongoing Major Issue, Corrective Action Underway, Monitoring or Emerging Risk, Resolved or Stabilized
  (use Resolved only when a cited source shows resolution)
- `*.status` for numbers: Reported, Estimated (method in note), Not reported (value null)
- `economic_risk.level`: Severe, Elevated, Watch, Not Indicated, Unknown (the fishery, port, coastal economy or
  operator behind the finding)
- `trend.direction`: Worsening, Improving, Stable, Volatile or Mixed, Insufficient History
- `location.sea` / `seas[]`: NPAC, SPAC, BERING, JPN, ECS, SCS, SEA, CORAL, TASMAN, NEPAC, TROPEPAC, SEPAC, NATL,
  SATL, NWATL, GOM, CAR, NSEA, BAL, NEATL, MED, BLK, GOG, BRA, SAFR, RED, GULF, BEN, WIND, EIND, SOUTHERN, ARCTIC
  (names in `src/geo.js`). This brief is for {{SEA}}; use `seas[]` only when the issue really spans several.
- `location.basin`: PAC, ATL, IND, SOU, ARC, GLOBAL
- `location.countries[]`: ISO 3166-1 alpha-2 codes of every coastal state involved (e.g. AU, ID, US), or ABNJ for
  the high seas. Take them from a public source that names the place; an EEZ, a port, a reef or an MPA listing
  gives the country.
- `location.coordinates.precision`: exact, site, city, coastline, sea. Use **`lat` and `lon`** (not
  latitude/longitude), decimal degrees. Take them from a public source (an agency map, a port or platform listing,
  a reef or MPA register, a stranding report, the article's named place) and cite it with `source_ref`. Public
  facilities, named reefs, platforms, wrecks, outfalls and coastal cities only, never residences. `points[]`
  (same shape plus `role`) lists several sites. A whole-sea issue uses precision `sea` or no coordinates with
  `extent` `regional_sea`.
- `location.extent`: site, local, national_waters (one country's EEZ), regional_sea, basin, global

**Source dates (accurate timelines)**
- `date` is the date the source itself was published, issued or last updated, as shown on the page or in the
  document (article date, order date, notice date, report date). If the page shows no date, set `date` to null.
- `accessed` is today ({{TODAY}}), the day you opened it. Every source gets `accessed`.
- Never put today's date in `date` just because you opened the page today. Database and dashboard lookups (Coral
  Reef Watch, OISST, Copernicus, Global Fishing Watch, NSIDC, Protected Planet, vessel trackers) have no
  publication date: `date: null`, `accessed` only, and they never stand alone.

**Severity rubric** (each component 0, 1 or 2; total 0-10; Critical 9-10, High 7-8, Moderate 4-6, Low 0-3)
- harm: 0 none documented, 1 potential or limited ecological or human-health harm, 2 documented mass mortality,
  habitat loss, contamination above a standard, or human harm
- livelihoods: 0 no disruption, 1 restrictions, closures or advisories (fishery closure, beach closure, shipping
  restriction), 2 loss of a fishery, displacement of a community, or a port or route out of use
- scale: 0 a site or a single reef, bay or stock, 1 a regional sea or a national coastline, 2 basin-wide or global
- duration: 0 days to weeks, 1 months, 2 a year or more, chronic or recurring
- significance: 0 informal reports, 1 formal notice, listing, violation or advisory, 2 enforcement order, court
  ruling, treaty action, emergency declaration, IUCN status change
Each of the five notes must state the specific cited fact behind that score for this finding, with the source
ref, e.g. "Coral Reef Watch recorded Bleaching Alert Level 2 over 80% of the reef in March 2026 (ref 1)." Never
reuse note wording across findings.

## Output and checking

1. Write the array to the output file named in your task.
2. Check it from the repo root: `node tools/research/check.mjs <your file>`
3. Fix every ERROR. Fix warnings where you can (location-unmappable: add `sea` or `basin`, coordinates or an
   `extent`; sources-dataset-only: add a dated report, agency page, court record or news article;
   location-type-generic: name the specific type; notes-template: reword).
4. Report back: count of records, list of ids with title and score, and anything you could not verify.
Do not edit any tracked file in the repository. Do not run git.
