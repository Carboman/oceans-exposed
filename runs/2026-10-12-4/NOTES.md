# Baseline pass: South China Sea (SCS) and Mediterranean Sea (MED), 2026-10-12-4

First two in-depth sea passes (docs/RESEARCH.md). Ten research agents ran in parallel, five per sea, one per category
group (A climate and physical, B reefs, habitats and wildlife, C fisheries and aquaculture, D pollution, E industry and
governance), each from a per-sea brief with the record format, allowed values and severity rubric.

- Records: 107 new (SCS 52, MED 55) across 15 of 17 categories; 353 distinct sources; feed 563 KB. VALID, no quality warnings.
- Merged overlaps (sources combined, merge noted in `conflicts`): Malaysia 2024 bleaching (climate and reef groups),
  Pearl River estuary hypoxia (climate and pollution groups), Medes Islands and Portofino gorgonian die-offs (climate and
  wildlife groups), Po Delta blue crab (wildlife and aquaculture groups).
- Spot check of 24 cited URLs: 22 answered 200; timesofisrael.com returns 403 to automated requests (opened by the agent
  during research) and Wikipedia returned 429 under rate limiting.
- Every agent's web search allowance ran out partway through its pass, so breadth is below target in places. Topics not
  covered this pass, for a follow-up pass: SCS offshore wind and seabed mining, Hainan and Sanya bleaching, Mekong delta
  coastal subsidence, Gulf of Thailand and Cambodian fisheries, Hong Kong port and noise; MED Adriatic small pelagics,
  swordfish, Turkish aquaculture, Thau and Ebro shellfish closures, dumped munitions, Lebanon, Syria, Egypt and Algeria
  incidents, Venice and cable incidents, Greek marine parks.
- Known caveats carried in the records' `missing_fields`, `conflicts` and `verification.confidence`: coordinates mostly
  from reference pages (precision set to city, coastline or sea where the source gives no point); several single-source
  records marked Low; Gulf of Thailand and Sea of Marmara findings filed under SCS and MED because the sea list has no
  separate codes for them.
- Pending-record outcomes: none pending.
