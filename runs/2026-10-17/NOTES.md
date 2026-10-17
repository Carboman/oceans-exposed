# Run notes 2026-10-17

Feed: 62 records (6 new, 56 updates). Validates with no quality warnings; merged with live 1028 records.

## Depth targets
1. Pending records: `research/pending/` holds only its README. Nothing pending.
2. Monthly indicators: skipped (contract 1.1.0).
3. Global sweep, last 7 days. Searches per category: ocean-warming-heatwaves 3, sea-level-coastal-flooding 3,
   acidification-deoxygenation 3, polar-oceans-sea-ice 3, coral-reefs 4, coastal-habitats 4, marine-wildlife 6,
   fisheries-overfishing 9, aquaculture 4, plastics-marine-debris 3, nutrient-pollution-dead-zones 4,
   chemical-oil-pollution 8, shipping-ports-noise 3, offshore-energy 4, deep-sea-mining 3,
   governance-treaties-disputes 7, other 2. Total about 73; every category has at least two.
   Pages opened directly without a search: NOAA newsroom, Copernicus Marine news, IUCN news, UNEP news, FAO newsroom,
   European Commission oceans and fisheries news, EEA newsroom, UK MCA, AMSA, IMO press briefings, ISA news.
   Most showed nothing new in the window.
4. Re-verification: Red Sea (RED, 23 findings; 22 in this run, the Somalia piracy record is carried by WIND) and
   Western Indian Ocean (WIND, 21 findings); every source URL opened. Both seas had the oldest `last_verified`
   (2026-10-12) among seas in the rotation.
   - RED: 12 verified unchanged; corrected: Chios Lion (distances, attribution), Sounion (unsupported claims removed),
     Magic Seas, Aqaba heatwave, Bab el-Mandeb sinkings (crew figure), Egypt sea level (rounding conflict).
     Unreadable PDF sources (IMO, UN, GCRMN, policy briefs) are noted in missing_fields. HEPCA page returned 403, so
     OC-RED-EGYPT-NORTHERNBLEACHING-2024 is "Partly verified" at Low confidence; medianama 403 (cable cuts Feb 2024).
   - WIND: 19 of 21 corrected or updated (UNEP COP12 outcome added, GCRMN date, Wakashio and St Brandon coordinates,
     piracy wording, Chagos payment note, Aldabra dates and others). AJOL pages, compressed PDFs and
     nairobiconvention.org, westminsterbrief.org and Wiley (403) could not be read; affected confidence lowered.
5. Low-confidence: 8 re-checked (Nile Delta raised to Medium; Cyprus MPA vessels, Med escapees, San Vicente turtles
   corrected; Italy hake, Tunisia posidonia, Ca Mau mangrove, Akumal turtles kept Low with notes).
   Med escapees sources MDPI and Feed and Additive returned 403.

## Findings added (6)
OC-GLOBAL-CORALS-REDLIST-2026, OC-BLK-NOVOROSSIYSK-RIOTANKERSLICK-2026, OC-SEA-SELANGOR-LICENCEFISHING-2026,
OC-SEA-ILOILO-TRAWLING-2026, OC-NEPAC-SOUTHEASTALASKA-DUNGENESS-2026, OC-NEPAC-ESCANABA-SULFIDECOMBUSTION-2026,
Updated by news: OC-GLOBAL-EPAC-ELNINO-HEAT-2026,
OC-GLOBAL-POLAR-SEAICE-2026, OC-NEPAC-CALIFORNIA-MPAREVIEW-2026, OC-NWATL-RIOFFSHORE-REVWINDHALT-2025,
OC-CAR-JAM-ISAMININGCODE-2026.

## Failed pages
Maritime NZ 403, US Coast Guard news 403, ABF Scott Reef 403, newsfromthestates 403, mining.com 403, NRDC 403,
CT News Junkie 429, nature.com login redirect, Federal Register and ADF&G PDFs unreadable.

## Left out
Freshwater spills (Lake Champlain, Lake Sunapee) as out of scope. Items seen only in snippets or unopened pages
(Gulf of Alaska perch closure, Gulf red snapper closure, Maputo dredging, Roberts Bank, Florida Keys Alert 4/5 via
Taucher.net) as unsourced. NOAA 2025 entanglement report: counts conflict across secondary sources. Global
Mangrove Alliance briefs: governance only, no quantified harm.

## Network tags
No proposed new keys.

## For tomorrow
CCAMLR meeting outcomes (krill, MPAs); NOAA ENSO update and marine heatwave page; BBNJ COP1 date and ratification
count; Black Sea Rio slick updates; Revolution Wind court docket; NOAA permit step for The Metals Company; Florida
king tide and Puerto Rico reports. Next re-verification seas: those with the oldest `last_verified` (BEN, BAL, SPAC,
SEPAC, NATL, all 2026-10-12).
