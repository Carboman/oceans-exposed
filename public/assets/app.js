/* oceans.exposed — client renderer.
   Reads /api/ocean/feed and renders the page named by <body data-page="...">.
   CATEGORIES mirrors src/model.js and SEAS / BASINS mirror src/geo.js; keep them in step. */
(function () {
  'use strict';

  var FEED_URL = '/api/ocean/feed';

  var CATEGORIES = [
    { slug: 'ocean-warming-heatwaves', name: 'Ocean Warming & Marine Heatwaves' },
    { slug: 'sea-level-coastal-flooding', name: 'Sea Level & Coastal Flooding' },
    { slug: 'acidification-deoxygenation', name: 'Acidification & Deoxygenation' },
    { slug: 'coral-reefs', name: 'Coral Reefs' },
    { slug: 'fisheries-overfishing', name: 'Fisheries & Overfishing' },
    { slug: 'plastics-marine-debris', name: 'Plastics & Marine Debris' },
    { slug: 'nutrient-pollution-dead-zones', name: 'Nutrient Pollution & Dead Zones' },
    { slug: 'chemical-oil-pollution', name: 'Chemical & Oil Pollution' },
    { slug: 'shipping-ports-noise', name: 'Shipping, Ports & Noise' },
    { slug: 'offshore-energy', name: 'Offshore Energy' },
    { slug: 'deep-sea-mining', name: 'Deep-Sea Mining' },
    { slug: 'coastal-habitats', name: 'Coastal Habitats' },
    { slug: 'marine-wildlife', name: 'Marine Wildlife' },
    { slug: 'polar-oceans-sea-ice', name: 'Polar Oceans & Sea Ice' },
    { slug: 'governance-treaties-disputes', name: 'Governance, Treaties & Disputes' },
    { slug: 'aquaculture', name: 'Aquaculture' },
    { slug: 'other', name: 'Other Ocean Issues' }
  ];
  var CAT_BY_SLUG = {};
  CATEGORIES.forEach(function (c, i) { c.order = i + 1; CAT_BY_SLUG[c.slug] = c; });

  var LAYERS = ['Climate & Physical', 'Pollution', 'Living Resources & Habitats', 'Governance & Economy'];
  // The layer each category usually belongs to; used only for colour grouping in charts.
  var CAT_LAYER = {
    'ocean-warming-heatwaves': 0, 'sea-level-coastal-flooding': 0, 'acidification-deoxygenation': 0, 'polar-oceans-sea-ice': 0,
    'plastics-marine-debris': 1, 'nutrient-pollution-dead-zones': 1, 'chemical-oil-pollution': 1,
    'coral-reefs': 2, 'fisheries-overfishing': 2, 'coastal-habitats': 2, 'marine-wildlife': 2, 'aquaculture': 2,
    'shipping-ports-noise': 3, 'offshore-energy': 3, 'deep-sea-mining': 3, 'governance-treaties-disputes': 3, 'other': 3
  };

  var WAVE = '<path d="M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>';
  var CAT_ICONS = {
    'ocean-warming-heatwaves': '<circle cx="12" cy="8" r="3.5"/><path d="M12 1.5v2M12 12.5v1.5M5.5 8h2M16.5 8h2M7.4 3.4l1.4 1.4M15.2 11.2l1.4 1.4M7.4 12.6l1.4-1.4M15.2 4.8l1.4-1.4"/>' + WAVE,
    'sea-level-coastal-flooding': '<path d="M4 11l8-7 8 7"/><path d="M6.5 9.5V15"/><path d="M17.5 9.5V15"/><path d="M10 15v-4h4v4"/>' + WAVE,
    'acidification-deoxygenation': '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><circle cx="12" cy="16" r="1.2"/><circle cx="9.5" cy="18.5" r=".8"/><circle cx="14.5" cy="18.8" r=".7"/>',
    'coral-reefs': '<path d="M12 21v-8"/><path d="M12 13c-3 0-5-2-5-5"/><path d="M7 8c-1 0-2-1-2-2"/><path d="M7 8c0-1.5 1-2.5 2-3"/><path d="M12 13c3 0 5-2 5-5"/><path d="M17 8c1 0 2-1 2-2"/><path d="M17 8c0-1.5-1-2.5-2-3"/><path d="M12 13V8"/><path d="M4 21h16"/>',
    'fisheries-overfishing': '<path d="M3 12c3-4 6-6 9-6s5.5 2 7.5 6c-2 4-4.5 6-7.5 6S6 16 3 12z"/><path d="M19.5 12l2.5-3.5v7z"/><circle cx="15" cy="11" r=".9"/><path d="M8 12h4"/>',
    'plastics-marine-debris': '<path d="M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3z"/><path d="M8 12h8"/><path d="M8 16h8"/>',
    'nutrient-pollution-dead-zones': '<circle cx="8" cy="8" r="2.5"/><circle cx="15" cy="6" r="2"/><circle cx="12" cy="12.5" r="2.5"/><circle cx="17.5" cy="12" r="1.8"/><circle cx="6" cy="14" r="1.4"/>' + WAVE,
    'chemical-oil-pollution': '<path d="M6 4h12"/><path d="M7 4v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4"/><path d="M7 9h10"/><path d="M7 15h10"/><path d="M12 11v2"/>',
    'shipping-ports-noise': '<path d="M3 16l1.5 4h15L21 16"/><path d="M4 16l1-5h14l1 5"/><path d="M8 11V6h8v5"/><path d="M12 3v3"/><path d="M2 16h20"/>',
    'offshore-energy': '<circle cx="12" cy="9" r="1.5"/><path d="M12 10.5V16"/><path d="M10.8 8.2L5.5 5"/><path d="M13.3 8.3l6-2"/><path d="M12 7.5V2"/><path d="M9 16h6"/>' + WAVE,
    'deep-sea-mining': '<path d="M2 5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M12 7v9"/><path d="M9 13l3 3 3-3"/><path d="M3 21h18"/><path d="M4 21l2-3h12l2 3"/>',
    'coastal-habitats': '<path d="M12 21V9"/><path d="M12 9c-4 0-6 3-6 6"/><path d="M12 9c4 0 6 3 6 6"/><path d="M12 9c0-3 1-5 3-6"/><path d="M12 9c0-3-1-5-3-6"/><path d="M3 21h18"/>',
    'marine-wildlife': '<path d="M12 21c0-6 1.5-10 2-14"/><path d="M14 7c-3-3-6-4-10-3 2 2 4 2 6 4"/><path d="M14 7c3-3 6-4 10-3-2 2-4 2-6 4"/><path d="M6 21c2-2 4-2 6 0"/>',
    'polar-oceans-sea-ice': '<path d="M12 3v18"/><path d="M4.2 7.5l15.6 9"/><path d="M4.2 16.5l15.6-9"/><path d="M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2"/>',
    'governance-treaties-disputes': '<path d="M12 3v17"/><path d="M6 21h12"/><path d="M5 7h14"/><path d="M5 7l-2.5 6a3 3 0 0 0 5 0L5 7z"/><path d="M19 7l-2.5 6a3 3 0 0 0 5 0L19 7z"/>',
    'aquaculture': '<path d="M3 6h18"/><path d="M5 6v12"/><path d="M19 6v12"/><path d="M5 18h14"/><path d="M8 12.5c1.5-2 3-3 5-3s3 1 4 3c-1 2-2 3-4 3s-3.5-1-5-3z"/><path d="M11 9v7M14 9v7"/>',
    'other': '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
  };
  function catIcon(slug, size) {
    return '<svg class="cat-icon" viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (CAT_ICONS[slug] || CAT_ICONS.other) + '</svg>';
  }

  var LEVELS = ['Critical', 'High', 'Moderate', 'Low'];
  var RISK_LEVELS = ['Severe', 'Elevated', 'Watch', 'Not Indicated', 'Unknown'];
  var TRENDS = ['Worsening', 'Improving', 'Stable', 'Volatile or Mixed', 'Insufficient History'];
  var CHANGE_TYPES = ['new', 'changed', 'escalated', 'de-escalated', 'resolved', 'reopened', 'unchanged', 'merged', 'removed'];
  var EXTENTS = { site: 'Site', local: 'Local', national_waters: 'National waters (EEZ)', regional_sea: 'Regional sea', basin: 'Ocean basin', global: 'Global' };
  var PRECISIONS = { exact: 'exact location', site: 'site location', city: 'city or port centre', coastline: 'coastline (approximate)', sea: 'sea centre (approximate)' };
  // Severity components, 0-2 each, with the rubric wording for each value (docs/OCEANS_EXPOSED_PLAN.md section 6).
  var COMPONENTS = [
    { key: 'harm', name: 'Ecological or human-health harm', rubric: ['None documented', 'Potential or limited ecological or human-health harm', 'Documented mass mortality, habitat loss, contamination above a standard, or human harm'] },
    { key: 'livelihoods', name: 'Livelihoods & services', rubric: ['No disruption', 'Restrictions, closures or advisories (fishery closure, beach closure, shipping restriction)', 'Loss of a fishery, displacement of a community, or a port or route out of use'] },
    { key: 'scale', name: 'Geographic scale', rubric: ['A site or a single reef, bay or stock', 'A regional sea or a national coastline', 'Basin-wide or global'] },
    { key: 'duration', name: 'Duration or persistence', rubric: ['Days to weeks', 'Months', 'A year or more, chronic or recurring'] },
    { key: 'significance', name: 'Formal significance', rubric: ['Informal reports', 'Formal notice, listing, violation or advisory', 'Enforcement order, court ruling, treaty action, emergency declaration, IUCN status change'] }
  ];

  /* ---------- geography (mirrors src/geo.js) ---------- */
  var BASINS = { PAC: 'Pacific Ocean', ATL: 'Atlantic Ocean', IND: 'Indian Ocean', SOU: 'Southern Ocean', ARC: 'Arctic Ocean', GLOBAL: 'Global ocean' };
  var SEAS = {
    NPAC: { name: 'North Pacific (open ocean)', basin: 'PAC' },
    SPAC: { name: 'South Pacific (open ocean)', basin: 'PAC' },
    BERING: { name: 'Bering Sea', basin: 'PAC' },
    JPN: { name: 'Sea of Japan / East Sea', basin: 'PAC' },
    ECS: { name: 'East China & Yellow Seas', basin: 'PAC' },
    SCS: { name: 'South China Sea', basin: 'PAC' },
    SEA: { name: 'Indonesian & Philippine seas', basin: 'PAC' },
    CORAL: { name: 'Coral Sea & Great Barrier Reef', basin: 'PAC' },
    TASMAN: { name: 'Tasman Sea', basin: 'PAC' },
    NEPAC: { name: 'Northeast Pacific (US & Canada west coast)', basin: 'PAC' },
    TROPEPAC: { name: 'Eastern tropical Pacific', basin: 'PAC' },
    SEPAC: { name: 'Southeast Pacific (Humboldt)', basin: 'PAC' },
    NATL: { name: 'North Atlantic (open ocean)', basin: 'ATL' },
    SATL: { name: 'South Atlantic (open ocean)', basin: 'ATL' },
    NWATL: { name: 'Northwest Atlantic (US & Canada east coast)', basin: 'ATL' },
    GOM: { name: 'Gulf of Mexico', basin: 'ATL' },
    CAR: { name: 'Caribbean Sea', basin: 'ATL' },
    NSEA: { name: 'North Sea', basin: 'ATL' },
    BAL: { name: 'Baltic Sea', basin: 'ATL' },
    NEATL: { name: 'Northeast Atlantic (Celtic Seas, Biscay, Iberia)', basin: 'ATL' },
    MED: { name: 'Mediterranean Sea', basin: 'ATL' },
    BLK: { name: 'Black Sea', basin: 'ATL' },
    GOG: { name: 'Gulf of Guinea & West Africa', basin: 'ATL' },
    BRA: { name: 'Southwest Atlantic (Brazil & Argentina)', basin: 'ATL' },
    SAFR: { name: 'Southern Africa', basin: 'ATL' },
    RED: { name: 'Red Sea', basin: 'IND' },
    GULF: { name: 'Persian Gulf & Arabian Sea', basin: 'IND' },
    BEN: { name: 'Bay of Bengal & Andaman Sea', basin: 'IND' },
    WIND: { name: 'Western Indian Ocean', basin: 'IND' },
    EIND: { name: 'Eastern Indian Ocean', basin: 'IND' },
    SOUTHERN: { name: 'Southern Ocean', basin: 'SOU' },
    ARCTIC: { name: 'Arctic Ocean', basin: 'ARC' }
  };
  var SEA_CODES = Object.keys(SEAS);
  // Sea tile map: [row, col, colspan] on a 12-column grid. Arctic on top, Southern at the bottom; Pacific in
  // columns 0-3 (east Asia at the left edge), Atlantic in 4-8 (Americas to Europe and Africa), Indian in 9-11.
  var SEA_TILES = {
    ARCTIC: [0, 4, 4],
    JPN: [1, 0], BERING: [1, 2], NATL: [1, 5, 2], NSEA: [1, 7], BAL: [1, 8],
    ECS: [2, 0], NPAC: [2, 1, 2], NEPAC: [2, 3], NWATL: [2, 4], NEATL: [2, 6], MED: [2, 7], BLK: [2, 8], RED: [2, 9], GULF: [2, 10], BEN: [2, 11],
    SCS: [3, 0], TROPEPAC: [3, 3], GOM: [3, 4], CAR: [3, 5], GOG: [3, 8],
    SEA: [4, 0], CORAL: [4, 1], SPAC: [4, 2], SEPAC: [4, 3], BRA: [4, 5], SATL: [4, 6, 2], WIND: [4, 9], EIND: [4, 11],
    TASMAN: [5, 1], SAFR: [5, 8],
    SOUTHERN: [6, 3, 6]
  };
  // Basin labels sit in the open-ocean gaps of each group.
  var SEA_TILE_LABELS = [['Pacific', 3, 1, 2], ['Atlantic', 3, 6, 2], ['Indian', 3, 9, 3]];

  function seasOf(r) { var l = (r && r.location) || {}; return l.seas && l.seas.length ? l.seas : (l.sea ? [l.sea] : []); }
  function basinOf(r) { var l = (r && r.location) || {}; if (l.basin) return l.basin; var s = seasOf(r)[0]; return s && SEAS[s] ? SEAS[s].basin : undefined; }
  function countriesOf(r) { var l = (r && r.location) || {}; return Array.isArray(l.countries) ? l.countries : []; }
  function seaName(code) { return (SEAS[code] || {}).name || code; }
  function basinName(code) { return BASINS[code] || code || ''; }
  var regionNames = null;
  function countryName(code) {
    if (!code) return '';
    if (code === 'ABNJ') return 'High seas';
    try {
      if (!regionNames) regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(code) || code;
    } catch (e) { return code; }
  }
  // "Coral Sea & Great Barrier Reef · Australia" style place line for lists and tables.
  function whereLine(r) {
    var seas = seasOf(r).map(seaName), c = countriesOf(r).map(countryName);
    var parts = [];
    if (seas.length) parts.push(seas.join(', ')); else if (basinOf(r)) parts.push(basinName(basinOf(r)));
    if (c.length) parts.push(c.slice(0, 3).join(', ') + (c.length > 3 ? ' +' + (c.length - 3) : ''));
    return parts.join(' · ');
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : null; }
  function link(url, text) {
    var u = safeUrl(url);
    return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(text || u) + '</a>' : esc(text || '');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function qs() { return new URLSearchParams(location.search); }

  function total(r) {
    var c = (r.severity && r.severity.components) || {};
    return COMPONENTS.reduce(function (s, k) { return s + (Number(c[k.key]) || 0); }, 0);
  }
  function levelOf(score) { return score >= 9 ? 'Critical' : score >= 7 ? 'High' : score >= 4 ? 'Moderate' : 'Low'; }
  function lvlPill(score) { var l = levelOf(score); return '<span class="lvl lvl-' + l.toLowerCase() + '">' + l + ' ' + score + '</span>'; }
  function catName(slug) { return (CAT_BY_SLUG[slug] || { name: slug || 'Uncategorized' }).name; }
  // Any status beginning with "Resolved" (e.g. "Resolved or Stabilized") is not an active issue.
  function isActive(r) { return !/^resolved\b/i.test((r.status || '').trim()); }

  function fmtNum(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    if (!isFinite(n)) return esc(v);
    // Keep up to 3 significant decimals so reported figures (e.g. $21.35M) are not re-rounded.
    var trim = function (x) { return String(Number(x.toFixed(3))); };
    if (Math.abs(n) >= 1e9) return trim(n / 1e9) + 'B';
    if (Math.abs(n) >= 1e6) return trim(n / 1e6) + 'M';
    return n.toLocaleString('en-US');
  }
  function fmtValue(m) {
    if (m.text) return esc(m.text);
    var v = fmtNum(m.value);
    if (v === null) return null;
    var unit = m.unit || '';
    if (/^usd/i.test(unit)) {
      var neg = Number(m.value) < 0;
      return (neg ? '−$' + fmtNum(Math.abs(m.value)) : '$' + v) + esc(unit.replace(/^usd/i, ''));
    }
    return v + (unit ? ' ' + esc(unit) : '');
  }
  function fmtMeasure(m) {
    if (!m) return '<span class="muted">Not reported</span>';
    var v = fmtValue(m);
    if (v === null || m.status === 'Not reported') return '<span class="muted">' + esc(m.name) + ': Not reported</span>';
    return esc(m.name) + ': <b>' + v + '</b>';
  }
  function keyMeasure(r) {
    if (r.key_measure && r.key_measure.text) return { html: esc(r.key_measure.text), status: r.key_measure.status };
    var m = (r.measures || [])[0];
    return m ? { html: fmtMeasure(m), status: m.status } : { html: '<span class="muted">Not reported</span>', status: 'Not reported' };
  }
  function fmtPop(p) {
    if (!p || p.value === null || p.value === undefined) return '<span class="muted">Not reported</span>';
    return Number(p.value).toLocaleString('en-US') + ' <span class="tag">' + esc(p.status || '') + '</span>';
  }
  function fmtPopLong(p) {
    if (!p) return '<span class="muted">Not reported</span>';
    var head = (p.value === null || p.value === undefined) ? '<span class="muted">Not reported</span>' : Number(p.value).toLocaleString('en-US') + ' <span class="tag">' + esc(p.status || '') + '</span>';
    return head + (p.note ? '<div class="small muted">' + esc(p.note) + '</div>' : '');
  }
  function fmtCoord(c) {
    if (!c || typeof c.lat !== 'number' || typeof c.lon !== 'number') return '';
    var lat = Math.abs(c.lat).toFixed(2) + '°' + (c.lat < 0 ? 'S' : 'N'), lon = Math.abs(c.lon).toFixed(2) + '°' + (c.lon < 0 ? 'W' : 'E');
    return lat + ', ' + lon + (c.precision ? ' <span class="tag">' + esc(PRECISIONS[c.precision] || c.precision) + '</span>' : '');
  }
  function latestSourceDate(r) {
    return (r.sources || []).map(function (s) { return s.date || ''; }).sort().pop() || r.latest_seen || '';
  }
  function cmpRank(a, b) {
    var d = total(b) - total(a);
    if (d) return d;
    return (latestSourceDate(b) > latestSourceDate(a)) ? 1 : (latestSourceDate(b) < latestSourceDate(a) ? -1 : 0);
  }
  // Category rank: rank within primary category by score, recency as tie-breaker. Never ranked across categories.
  function assignRanks(records) {
    var by = {};
    records.forEach(function (r) { (by[r.primary_category] = by[r.primary_category] || []).push(r); });
    Object.keys(by).forEach(function (k) { by[k].sort(cmpRank).forEach(function (r, i) { r._rank = i + 1; }); });
    records.forEach(function (r) { r._score = total(r); r._level = levelOf(r._score); });
    return by;
  }

  function loadFeed() {
    return fetch(FEED_URL, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Feed request failed (' + res.status + ')');
      return res.json();
    }).then(function (feed) {
      feed.records = (feed.records || []).filter(function (r) { return r && r.id && r.public !== false; }).map(function (r) { r.location = r.location || {}; return r; });
      feed._byCat = assignRanks(feed.records);
      return feed;
    });
  }

  function showRunMeta(feed) {
    var r = feed.run || {};
    document.querySelectorAll('[data-run-meta]').forEach(function (el) {
      el.innerHTML =
        '<span>Research window <b>' + esc(r.research_start) + '</b> to <b>' + esc(r.research_end) + '</b></span>' +
        (r.update_window_start ? '<span>Update window <b>' + esc(r.update_window_start) + '</b> to <b>' + esc(r.update_window_end) + '</b></span>' : '') +
        '<span>Run date <b>' + esc(r.run_date) + '</b></span>' +
        '<span>Feed <b>' + esc(feed.schema_version) + '</b> rev <b>' + esc(r.revision) + '</b></span>' +
        (feed.source_report && feed.source_report.url ? '<span><a href="' + esc(feed.source_report.url) + '" target="_blank" rel="noopener">Full report (PDF)</a></span>' : '');
    });
    var banner = $('#sample-banner');
    if (banner && feed.sample) banner.hidden = false;
  }

  function fail(err) {
    var main = $('main');
    if (main) main.insertAdjacentHTML('afterbegin', '<div class="error-box">Could not load the findings feed: ' + esc(err.message) + '</div>');
    console.error(err);
  }

  /* ---------- chrome: theme + mobile nav ---------- */
  function initChrome() {
    var root = document.documentElement;
    try { var saved = localStorage.getItem('oe-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}
    var btn = $('.theme-toggle');
    if (btn) btn.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('oe-theme', next); } catch (e) {}
      document.dispatchEvent(new Event('wx:theme'));
    });
    var nt = $('.nav-toggle'), nav = $('.topnav');
    if (nt && nav) nt.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      nt.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function catNote(feed, slug) {
    var n = (feed.category_notes || {})[slug];
    if (!n) return '';
    return ' ' + esc(n.text) + (n.sources || []).map(function (s) { return ' ' + link(s.url, '[' + (s.ref || 'source') + ']'); }).join('');
  }
  function milestonesHtml(list) {
    return (list || []).map(function (m) {
      return '<div class="card" style="margin-bottom:10px"><div class="dossier-head"><span class="tag">' + esc(m.status) + '</span><span class="tag">' + esc(catName(m.category)) + '</span><span class="mono small muted">' + esc(m.date) + '</span></div>' +
        '<h3 style="margin:.5em 0 .3em">' + esc(m.title) + '</h3><p style="margin:0">' + esc(m.text) + '</p>' +
        ((m.sources || []).length ? '<p class="small" style="margin:.5em 0 0">' + m.sources.map(function (s) { return link(s.url, s.publisher + ' — ' + s.title + ' (' + s.date + ')'); }).join('<br>') + '</p>' : '') + '</div>';
    }).join('');
  }

  // Sea tile map (overview and anywhere else with #tilemap): fill = highest active score in the sea.
  function renderTileMap(mount, records) {
    var best = {}, n = {};
    records.forEach(function (r) { seasOf(r).forEach(function (s) { best[s] = Math.max(best[s] || 0, r._score); n[s] = (n[s] || 0) + 1; }); });
    mount.innerHTML = SEA_TILE_LABELS.map(function (l) {
      return '<span class="tile-label" style="grid-row:' + (l[1] + 1) + ';grid-column:' + (l[2] + 1) + ' / span ' + l[3] + '" aria-hidden="true">' + l[0] + '</span>';
    }).join('') + SEA_CODES.map(function (s) {
      var pos = SEA_TILES[s], sc = best[s], sea = SEAS[s];
      if (!pos) return '';
      var style = 'grid-row:' + (pos[0] + 1) + ';grid-column:' + (pos[1] + 1) + (pos[2] ? ' / span ' + pos[2] : '');
      var title = sea.name + ' (' + basinName(sea.basin) + ')' + (sc !== undefined ? ': ' + n[s] + ' active finding' + (n[s] === 1 ? '' : 's') + ', highest score ' + sc + ' (' + levelOf(sc) + ')' : ': no active findings in feed');
      var inner = s + (sc !== undefined ? '<span class="tn">' + n[s] + '</span>' : '');
      return sc !== undefined
        ? '<a class="tile' + (pos[2] ? ' span' : '') + ' lvl-' + levelOf(sc).toLowerCase() + '" data-basin="' + sea.basin + '" style="' + style + '" href="sea.html?code=' + s + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + inner + '</a>'
        : '<a class="tile' + (pos[2] ? ' span' : '') + '" data-basin="' + sea.basin + '" style="' + style + '" href="sea.html?code=' + s + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + inner + '</a>';
    }).join('');
  }

  /* ---------- overview ---------- */
  function renderOverview(feed) {
    var recs = feed.records, active = recs.filter(isActive);
    var seaSet = {}, catSet = {};
    active.forEach(function (r) { seasOf(r).forEach(function (s) { seaSet[s] = 1; }); if (r.primary_category) catSet[r.primary_category] = 1; });
    var count = function (fn) { return active.filter(fn).length; };
    var cov = feed.coverage || {};
    var done = (cov.regions_researched || []).filter(function (c) { return SEAS[c]; });

    $('#kpis').innerHTML = [
      [active.length, 'Active findings'],
      [count(function (r) { return r._level === 'Critical'; }), 'Critical (9–10)'],
      [count(function (r) { return r._level === 'High'; }), 'High (7–8)'],
      [Object.keys(seaSet).length + ' <span class="small muted">of ' + SEA_CODES.length + '</span>', 'Regional seas with findings'],
      [done.length + ' <span class="small muted">of ' + SEA_CODES.length + '</span>', 'Seas researched in depth'],
      [Object.keys(catSet).length + ' <span class="small muted">of ' + CATEGORIES.length + '</span>', 'Categories covered'],
      [recs.filter(function (r) { return r.change_type && r.change_type !== 'unchanged'; }).length, (feed.run || {}).prior_run_date ? 'Changed since prior run' : 'New baseline records']
    ].map(function (k) { return '<div class="kpi"><div class="v">' + k[0] + '</div><div class="l">' + k[1] + '</div></div>'; }).join('');

    renderTileMap($('#tilemap'), active);

    // categories
    $('#categories').innerHTML = CATEGORIES.map(function (c) {
      var list = (feed._byCat[c.slug] || []).slice(0, 5);
      var all = (feed._byCat[c.slug] || []).length;
      var body = list.length ? list.map(function (r) {
        return '<a class="finding-line" href="dossier.html?id=' + encodeURIComponent(r.id) + '">' +
          '<span class="rk">#' + r._rank + '</span>' +
          '<span><span class="t">' + esc(r.location.name) + '</span> — ' + esc(r.title) +
          '<br><span class="sub">' + esc(whereLine(r)) + ' · ' + esc(r.issue_layer) + ' · ' + esc(r.status) + '</span></span>' +
          lvlPill(r._score) + '</a>';
      }).join('') : '<div class="none-found">' + (catNote(feed, c.slug).trim() || 'No qualifying findings located.') + '</div>';
      return '<section class="cat-section" id="cat-' + c.slug + '"><div class="cat-head"><span class="cat-badge">' + catIcon(c.slug, 22) + '</span><span class="cat-num">' + String(c.order).padStart(2, '0') + '</span><h3>' + esc(c.name) + '</h3>' +
        (all ? '<a class="small" href="explorer.html?category=' + c.slug + '">All ' + all + ' →</a>' : '') + '</div>' + body + '</section>';
    }).join('');

    var sm = feed.summary || {};
    var PROCESS_NOTES = /\b(research process(es)?|reconcil\w*|duplicate ids?|merged into|data-quality|warnings? (repair|fix)|cell completion|cells? (complete|incomplete|remain)|staging|commit\w*|publish\w*|run id|this run|prior run|feed\.json|schema|tombstones?|instructions? version)\b/i;  // mirrors src/quality.js
    if ((sm.highest_risk || sm.directional_picture) && !PROCESS_NOTES.test([sm.highest_risk, sm.directional_picture].join(' '))) {
      $('#exec').hidden = false;
      $('#exec-risk').textContent = sm.highest_risk || '';
      $('#exec-direction').textContent = sm.directional_picture || '';
    }
    if ((feed.milestones || []).length) { $('#milestones-wrap').hidden = false; $('#milestones').innerHTML = milestonesHtml(feed.milestones); }
    $('#coverage-statement').textContent = cov.statement || '';
    if ($('#coverage-seas')) {
      var pending = SEA_CODES.filter(function (c) { return done.indexOf(c) < 0; });
      $('#coverage-seas').hidden = false;
      $('#coverage-seas').innerHTML = 'Researched in depth: <b>' + done.length + ' of ' + SEA_CODES.length + '</b> regional seas.' +
        (pending.length ? ' Pending: ' + pending.map(function (c) { return '<a href="sea.html?code=' + c + '">' + esc(seaName(c)) + '</a>'; }).join(', ') + '. Until a sea is researched, only findings from global sweeps appear for it.' : '');
    }
  }

  /* ---------- explorer ---------- */
  function renderExplorer(feed) {
    var recs = feed.records;
    var seaOpts = {}, basinOpts = {}, countryOpts = {}, statusOpts = {};
    recs.forEach(function (r) {
      seasOf(r).forEach(function (s) { seaOpts[s] = 1; });
      var b = basinOf(r); if (b) basinOpts[b] = 1;
      countriesOf(r).forEach(function (c) { countryOpts[c] = 1; });
      if (r.status) statusOpts[r.status] = 1;
    });

    function opts(list, labelFn) {
      return '<option value="">All</option>' + list.map(function (v) {
        var val = typeof v === 'object' ? v.slug : v;
        return '<option value="' + esc(val) + '">' + esc(labelFn ? labelFn(v) : v) + '</option>';
      }).join('');
    }
    var byName = function (fn) { return function (a, b) { return fn(a) < fn(b) ? -1 : fn(a) > fn(b) ? 1 : 0; }; };
    $('#f-category').innerHTML = opts(CATEGORIES, function (c) { return c.name; });
    $('#f-layer').innerHTML = opts(LAYERS);
    $('#f-level').innerHTML = opts(LEVELS);
    $('#f-sea').innerHTML = opts(Object.keys(seaOpts).sort(byName(seaName)), function (s) { return seaName(s) + ' (' + s + ')'; });
    $('#f-basin').innerHTML = opts(Object.keys(basinOpts).sort(byName(basinName)), basinName);
    $('#f-country').innerHTML = opts(Object.keys(countryOpts).sort(byName(countryName)), function (c) { return countryName(c) + ' (' + c + ')'; });
    $('#f-status').innerHTML = opts(Object.keys(statusOpts).sort());
    $('#f-risk').innerHTML = opts(RISK_LEVELS);
    $('#f-trend').innerHTML = opts(TRENDS);
    $('#f-min').innerHTML = '<option value="">Any</option>' + [9, 7, 4, 1].map(function (n) { return '<option value="' + n + '">' + n + '+ (' + levelOf(n) + (n === 1 ? ' or above' : ' and above') + ')</option>'; }).join('');
    $('#f-change').innerHTML = opts(CHANGE_TYPES);

    // Field names match the /api/ocean/issues query parameters, so a filtered page URL maps onto the API.
    var FIELDS = { q: '#f-q', category: '#f-category', layer: '#f-layer', level: '#f-level', sea: '#f-sea', basin: '#f-basin', country: '#f-country', status: '#f-status', economic_risk: '#f-risk', trend: '#f-trend', min_score: '#f-min', change: '#f-change' };
    var p = qs();
    Object.keys(FIELDS).forEach(function (k) { if (p.get(k)) $(FIELDS[k]).value = /^(sea|basin|country)$/.test(k) ? p.get(k).toUpperCase() : p.get(k); });

    var sortKey = 'score', sortDir = -1;
    var sorters = {
      rank: function (r) { return (CAT_BY_SLUG[r.primary_category] || { order: 99 }).order * 1000 + r._rank; },
      loc: function (r) { return (r.location.name || '').toLowerCase(); },
      sea: function (r) { return seasOf(r).map(seaName).join(', ').toLowerCase() || '~' + basinName(basinOf(r)).toLowerCase(); },
      cat: function (r) { return (CAT_BY_SLUG[r.primary_category] || { order: 99 }).order; },
      score: function (r) { return r._score; },
      pop: function (r) { return (r.population_affected && r.population_affected.value) || -1; },
      date: function (r) { return latestSourceDate(r); }
    };

    function current() {
      var f = {};
      Object.keys(FIELDS).forEach(function (k) { f[k] = $(FIELDS[k]).value.trim(); });
      return f;
    }
    function match(r, f) {
      if (f.category && r.primary_category !== f.category) return false;
      if (f.layer && r.issue_layer !== f.layer) return false;
      if (f.level && r._level !== f.level) return false;
      if (f.sea && seasOf(r).indexOf(f.sea) < 0) return false;
      if (f.basin && basinOf(r) !== f.basin) return false;
      if (f.country && countriesOf(r).indexOf(f.country) < 0) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.economic_risk && (r.economic_risk || {}).level !== f.economic_risk) return false;
      if (f.trend && (r.trend || {}).direction !== f.trend) return false;
      if (f.min_score && r._score < Number(f.min_score)) return false;
      if (f.change && r.change_type !== f.change) return false;
      if (f.q) {
        var hay = [r.id, r.title, r.description, r.location.name, r.location.detail, r.location.type, seasOf(r).map(seaName).join(' '), countriesOf(r).map(countryName).join(' '), catName(r.primary_category), r.key_measure && r.key_measure.text]
          .concat((r.measures || []).map(function (m) { return m.name; })).join(' ').toLowerCase();
        if (hay.indexOf(f.q.toLowerCase()) < 0) return false;
      }
      return true;
    }
    var lastRows = [];
    function draw() {
      var f = current();
      var np = new URLSearchParams();
      Object.keys(f).forEach(function (k) { if (f[k]) np.set(k, f[k]); });
      history.replaceState(null, '', location.pathname + (np.toString() ? '?' + np : ''));

      var rows = recs.filter(function (r) { return match(r, f); });
      var key = sorters[sortKey];
      rows.sort(function (a, b) { var x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * sortDir || cmpRank(a, b); });
      lastRows = rows;
      document.dispatchEvent(new CustomEvent('wx:rows', { detail: rows }));
      $('#result-count-n').textContent = rows.length + ' of ' + recs.length + ' findings';
      var sm = $('#sea-map-link'); if (sm) { sm.hidden = !(f.sea && SEAS[f.sea]); if (f.sea) sm.href = 'sea.html?code=' + f.sea; }
      $('#rows').innerHTML = rows.length ? rows.map(function (r) {
        var er = r.economic_risk || {};
        var km = keyMeasure(r);
        var seas = seasOf(r), countries = countriesOf(r);
        return '<tr data-id="' + esc(r.id) + '" tabindex="0">' +
          '<td class="num">' + r._rank + '</td>' +
          '<td class="loc"><a href="dossier.html?id=' + encodeURIComponent(r.id) + '">' + esc(r.location.name) + '</a><div class="small muted">' + esc(r.title) + '</div></td>' +
          '<td>' + (seas.length ? seas.map(function (s) { return '<a href="sea.html?code=' + s + '">' + esc(seaName(s)) + '</a>'; }).join(', ') : '<span class="muted">' + esc(basinName(basinOf(r)) || 'No sea given') + '</span>') +
            '<div class="small muted">' + esc(countries.map(countryName).join(', ') || (r.location.type || '')) + '</div></td>' +
          '<td>' + esc(catName(r.primary_category)) + '</td>' +
          '<td>' + esc(r.issue_layer) + '</td>' +
          '<td>' + lvlPill(r._score) + '</td>' +
          '<td>' + esc(r.status) + '</td>' +
          '<td class="num">' + fmtPop(r.population_affected) + '</td>' +
          '<td class="small" style="min-width:260px">' + km.html + ' <span class="tag">' + esc(km.status) + '</span></td>' +
          '<td>' + esc(er.level || 'Not assessed') + '</td>' +
          '<td>' + esc((r.trend || {}).direction || 'Insufficient History') + '</td>' +
          '<td class="num">' + esc(latestSourceDate(r)) + '</td></tr>';
      }).join('') : '<tr><td colspan="12" class="none-found">No findings match these filters.</td></tr>';
    }

    Object.keys(FIELDS).forEach(function (k) { $(FIELDS[k]).addEventListener(k === 'q' ? 'input' : 'change', draw); });
    $('#reset').addEventListener('click', function () { Object.keys(FIELDS).forEach(function (k) { $(FIELDS[k]).value = ''; }); draw(); });
    document.querySelectorAll('[data-sort]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sort');
        sortDir = sortKey === k ? -sortDir : (k === 'loc' || k === 'rank' || k === 'cat' || k === 'sea' ? 1 : -1);
        sortKey = k; draw();
      });
    });
    $('#rows').addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      var tr = e.target.closest('tr[data-id]'); if (tr) location.href = 'dossier.html?id=' + encodeURIComponent(tr.dataset.id);
    });
    $('#rows').addEventListener('keydown', function (e) {
      var tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') location.href = 'dossier.html?id=' + encodeURIComponent(tr.dataset.id);
    });
    $('#export').addEventListener('click', function () {
      var cols = ['id', 'category_rank', 'location', 'location_type', 'seas', 'basin', 'countries', 'extent', 'lat', 'lon', 'primary_category', 'issue_layer', 'issue_level', 'severity_score', 'harm', 'livelihoods', 'scale', 'duration', 'significance', 'status', 'population_affected', 'population_status', 'economic_risk', 'trend', 'latest_source_date', 'source_url'];
      var csv = [cols.join(',')].concat(lastRows.map(function (r) {
        var c = (r.severity || {}).components || {}, pop = r.population_affected || {}, co = r.location.coordinates || {};
        var vals = [r.id, r._rank, r.location.name, r.location.type, seasOf(r).join(' '), basinOf(r), countriesOf(r).join(' '), r.location.extent, co.lat, co.lon, catName(r.primary_category), r.issue_layer, r._level, r._score, c.harm, c.livelihoods, c.scale, c.duration, c.significance, r.status, pop.value, pop.status, (r.economic_risk || {}).level, (r.trend || {}).direction, latestSourceDate(r), ((r.sources || [])[0] || {}).url];
        return vals.map(function (v) { v = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
      })).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'ocean-findings-' + ((feed.run || {}).run_date || 'export') + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    });
    draw();
  }

  /* ---------- dossier ---------- */
  function renderDossier(feed) {
    var id = qs().get('id');
    var r = feed.records.filter(function (x) { return x.id === id; })[0];
    var tomb = (feed.tombstones || []).filter(function (t) { return t.id === id; })[0];
    var el = $('#dossier');
    if (!r) {
      el.innerHTML = tomb
        ? '<h1>Finding ' + esc(id) + ' was ' + esc(tomb.change_type || 'removed') + '</h1><p>' + (tomb.merged_into ? 'Merged into <a href="dossier.html?id=' + encodeURIComponent(tomb.merged_into) + '">' + esc(tomb.merged_into) + '</a>. ' : '') + esc(tomb.reason || '') + '</p>'
        : '<h1>Finding not found</h1><p>No finding with ID <span class="mono">' + esc(id || '(none)') + '</span> is in the current feed. <a href="explorer.html">Browse all findings</a>.</p>';
      return;
    }
    document.title = (r.location.name || r.id) + ' · oceans.exposed';
    var sev = r.severity || {}, comps = sev.components || {}, notes = sev.notes || {};
    var er = r.economic_risk || {}, tr = r.trend || {}, v = r.verification || {}, l = r.location;
    var declared = sev.level && sev.level !== r._level
      ? '<p class="callout warn">Feed-declared level (' + esc(sev.level) + ') does not match the component total; the computed level is shown.</p>' : '';

    var html = '';
    html += '<p class="eyebrow eyebrow-icon">' + catIcon(r.primary_category, 18) + esc(catName(r.primary_category)) + ' · Category rank #' + r._rank + '</p>';
    html += '<h1>' + esc(r.location.name) + '</h1>';
    html += '<p class="lede" style="margin-top:0">' + esc(r.title) + '</p>';
    html += '<div class="dossier-head">' + lvlPill(r._score) + '<span class="tag">' + esc(r.status) + '</span><span class="tag">' + esc(r.issue_layer) + '</span><span class="tag mono">' + esc(r.id) + (r.revision ? ' · rev ' + esc(r.revision) : '') + '</span>' +
      (r.change_type ? '<span class="tag">This run: ' + esc(r.change_type) + '</span>' : '') + (feed.sample ? '<span class="tag tag-sample">Sample record</span>' : '') + '</div>';
    html += declared;
    html += '<div class="dossier-viz"><div class="card" id="viz-score"></div><div class="card" id="viz-rank"></div></div>';
    html += '<h2>Summary</h2><p>' + esc(r.description) + '</p>';

    // Severity: one cell per component with the rubric wording for the value given, then the analyst's note.
    html += '<h2>Severity ' + r._score + ' / 10</h2><div class="score-grid">' + COMPONENTS.map(function (c) {
      var val = Math.max(0, Math.min(2, Number(comps[c.key]) || 0));
      return '<div class="score-cell"><div class="k">' + esc(c.name) + '</div><div class="pips"><span class="pip' + (val >= 1 ? ' on' : '') + '"></span><span class="pip' + (val >= 2 ? ' on' : '') + '"></span><b style="margin-left:6px">' + val + '</b></div>' +
        '<div class="note"><b>' + esc(c.rubric[val]) + '</b>' + (notes[c.key] ? '<br>' + esc(notes[c.key]) : '') + '</div></div>';
    }).join('') + '</div>';
    html += '<p class="small muted">Each component is 0 to 2 on the <a href="methodology.html#severity">published rubric</a>; the level is computed from the total.</p>';

    html += '<h2>Issue layer</h2><div class="kv">' +
      '<div>Primary layer</div><div><b>' + esc(r.issue_layer) + '</b></div>' +
      '<div>Rationale</div><div>' + esc(r.layer_rationale) + '</div>' +
      '<div>Secondary drivers</div><div>' + ((r.secondary_drivers || []).length ? esc(r.secondary_drivers.join('; ')) : '<span class="muted">None recorded</span>') + '</div>' +
      '<div>Secondary categories</div><div>' + ((r.secondary_categories || []).length ? r.secondary_categories.map(catName).map(esc).join('; ') : '<span class="muted">None</span>') + '</div></div>';

    var seas = seasOf(r), countries = countriesOf(r), points = Array.isArray(l.points) ? l.points.filter(function (p) { return p && typeof p.lat === 'number'; }) : [];
    html += '<h2>Location &amp; scale</h2><div class="kv">' +
      '<div>Location type</div><div>' + esc(l.type) + '</div>' +
      '<div>Regional sea' + (seas.length > 1 ? 's' : '') + '</div><div>' + (seas.length ? seas.map(function (s) { return '<a href="sea.html?code=' + s + '">' + esc(seaName(s)) + '</a> <span class="mono muted small">' + s + '</span>'; }).join('; ') : '<span class="muted">None (open-ocean or global finding)</span>') + '</div>' +
      '<div>Ocean basin</div><div>' + (basinOf(r) ? esc(basinName(basinOf(r))) + ' <span class="mono muted small">' + esc(basinOf(r)) + '</span>' : '<span class="muted">Not given</span>') + '</div>' +
      '<div>Countries</div><div>' + (countries.length ? countries.map(function (c) { return '<a href="explorer.html?country=' + encodeURIComponent(c) + '">' + esc(countryName(c)) + '</a>' + (c === 'ABNJ' ? ' <span class="muted small">(areas beyond national jurisdiction)</span>' : ' <span class="mono muted small">' + c + '</span>'); }).join('; ') : '<span class="muted">None given</span>') + '</div>' +
      '<div>Extent</div><div>' + (l.extent ? esc(EXTENTS[l.extent] || l.extent) : '<span class="muted">Not given</span>') + '</div>' +
      (l.detail ? '<div>Location detail</div><div>' + esc(l.detail) + '</div>' : '') +
      '<div>Coordinates</div><div>' + (fmtCoord(l.coordinates) || '<span class="muted">None given</span>') + (points.length ? '<div class="small muted">' + points.length + ' further point' + (points.length === 1 ? '' : 's') + ' recorded' + (seas[0] ? '; see the <a href="sea.html?code=' + seas[0] + '">sea map</a>' : '') + '</div>' : '') + '</div>' +
      '<div>Population affected</div><div>' + fmtPopLong(r.population_affected) + '</div></div>';

    if (r.key_measure && r.key_measure.text) html += '<h2>Key quantitative measure</h2><p class="callout"><span class="tag">' + esc(r.key_measure.status) + '</span> ' + esc(r.key_measure.text) + '</p>';
    if ((r.measures || []).length) html += '<h2>Quantitative evidence</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Measure</th><th>Value</th><th>Status</th><th>Note / conversion</th></tr></thead><tbody>' +
      (r.measures || []).map(function (m) {
        var val = fmtValue(m);
        var pct = (m.unit === '%' && Number(m.value) >= 0 && Number(m.value) <= 100) ? '<span class="pct-meter" role="img" aria-label="' + esc(m.value) + ' percent"><span style="width:' + Number(m.value) + '%"></span></span>' : '';
        // Text values (e.g. "Exceeds $450 million") wrap; only numbers stay on one line.
        return '<tr><td>' + esc(m.name) + '</td><td class="' + (m.text ? 'measure-text' : 'num') + '">' + (val === null ? '<span class="muted">Not reported</span>' : val) + pct + '</td><td><span class="tag">' + esc(m.status) + '</span></td><td class="small">' + esc(m.note || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    html += '<h2>Economic risk</h2><p class="small muted" style="margin-top:-8px">Risk to a fishery, a port, a coastal economy or an operator, from the cited evidence.</p><div class="kv">' +
      '<div>Risk level</div><div><b>' + esc(er.level || 'Not assessed') + '</b></div>' +
      '<div>Signals</div><div>' + ((er.signals || []).length ? '<ul class="clean">' + er.signals.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '<span class="muted">None identified</span>') + '</div></div>';

    html += '<h2>Trend &amp; projection</h2><div class="kv"><div>Observed trend</div><div>' + esc(tr.direction || 'Insufficient History') + '</div>';
    if (tr.projection) {
      var pj = typeof tr.projection === 'string' ? { statement: tr.projection } : tr.projection;
      var asList = function (x) { return Array.isArray(x) ? x : x ? [x] : []; };
      html += '<div>Projection <span class="tag">Analyst judgment</span></div><div>' + esc(pj.statement) + '</div>' +
        (pj.horizon ? '<div>Horizon</div><div>' + esc(pj.horizon) + '</div>' : '') + (pj.confidence ? '<div>Confidence</div><div>' + esc(pj.confidence) + '</div>' : '') +
        (asList(pj.assumptions).length ? '<div>Assumptions / evidence</div><div>' + esc(asList(pj.assumptions).join('; ')) + '</div>' : '') +
        (asList(pj.reversal_factors).length ? '<div>Reversal factors</div><div>' + esc(asList(pj.reversal_factors).join('; ')) + '</div>' : '');
    } else {
      html += '<div>Projection</div><div class="muted">None. Comparable history is insufficient for a defensible projection.</div>';
    }
    if (tr.note) html += '<div>Note</div><div>' + esc(tr.note) + '</div>';
    html += '</div>';

    html += '<h2>Responsible bodies</h2><div class="kv"><div>Bodies</div><div><ul class="clean">' + (r.responsible_bodies || []).map(function (b) {
      return '<li><b>' + esc(b.name) + '</b>' + (b.role ? ' <span class="muted">(' + esc(b.role) + ')</span>' : '') + (safeUrl(b.contact) ? ' · ' + link(b.contact, 'Public contact') : '') + '</li>';
    }).join('') + '</ul></div>' + (r.public_contact ? '<div>Public contact</div><div>' + esc(r.public_contact) + '</div>' : '') + '</div>';

    html += '<h2>Corrective actions</h2>' + ((r.corrective_actions || []).length ? '<ul class="clean">' + r.corrective_actions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' : '<p class="muted">None documented.</p>');

    html += '<h2>Evidence timeline</h2><div class="card" id="viz-timeline"></div>';
    html += '<h2>Sources</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Source</th><th>Publisher</th><th>Basis</th></tr></thead><tbody>' +
      (r.sources || []).map(function (s) { return '<tr><td class="num">' + (s.date ? esc(s.date) : '<span class="muted">Undated</span>') + (s.accessed ? '<div class="small muted">accessed ' + esc(s.accessed) + '</div>' : '') + '</td><td>' + (s.ref ? '<span class="mono muted">[' + esc(s.ref) + ']</span> ' : '') + link(s.url, s.title) + '</td><td>' + esc(s.publisher) + '</td><td>' + esc(s.basis) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    html += '<p class="small muted">Date is the source\'s own publication date; "accessed" is the day it was opened for this tracker. Database and dashboard lookups carry an accessed date only.</p>';

    if ((r.conflicts || []).length) {
      html += '<h2>Conflicting evidence</h2>' + r.conflicts.map(function (c) {
        if (typeof c === 'string') c = { note: c };
        var vals = Array.isArray(c.values) ? c.values : c.values ? [c.values] : [];
        return '<p class="callout">' + (c.field ? '<b>' + esc(c.field) + ':</b> ' : '') + esc(vals.join(' vs. ')) + (c.note ? (c.field || vals.length ? '<br><span class="small">' : '<span>') + esc(c.note) + '</span>' : '') + '</p>';
      }).join('');
    }

    html += '<h2>History</h2><ul class="timeline">' + (r.history || []).slice().reverse().map(function (h) {
      return '<li><span class="mono small">' + esc(h.date) + '</span> · ' + esc(h.status) + (h.score !== undefined ? ' · score ' + esc(h.score) : '') + '<br><span class="small muted">' + esc(h.note || '') + '</span></li>';
    }).join('') + '</ul>';

    html += '<h2>Verification &amp; gaps</h2><div class="kv">' +
      '<div>Verification</div><div>' + esc(v.status || 'Unverified') + (v.last_verified ? ' · last verified ' + esc(v.last_verified) : '') + '</div>' +
      (v.confidence ? '<div>Confidence</div><div>' + esc(v.confidence) + '</div>' : '') +
      '<div>First / latest seen</div><div>' + esc(r.first_seen) + ' / ' + esc(r.latest_seen) + '</div>' +
      '<div>Missing fields</div><div>' + ((r.missing_fields || []).length ? esc(r.missing_fields.join('; ')) : '<span class="muted">None flagged</span>') + '</div>' +
      '<div>Related findings</div><div>' + ((r.related_ids || []).length ? r.related_ids.map(function (x) { return '<a href="dossier.html?id=' + encodeURIComponent(x) + '">' + esc(x) + '</a>'; }).join(', ') : '<span class="muted">None</span>') + '</div></div>';

    el.innerHTML = html;
  }

  /* ---------- updates & coverage ---------- */
  function renderUpdates(feed) {
    var recs = feed.records, run = feed.run || {};
    $('#prior-run').textContent = run.prior_run_date || 'none (baseline run)';
    var groups = CHANGE_TYPES.map(function (t) { return [t, recs.filter(function (r) { return r.change_type === t; })]; }).filter(function (g) { return g[1].length; });
    $('#changes').innerHTML = groups.map(function (g) {
      return '<h3 style="text-transform:capitalize">' + esc(g[0]) + ' (' + g[1].length + ')</h3>' + g[1].sort(cmpRank).map(function (r) {
        var h = r.history || [], last = h[h.length - 1] || {};
        return '<a class="finding-line" href="dossier.html?id=' + encodeURIComponent(r.id) + '"><span class="rk mono small">' + esc(r.id.replace(/^OC-/, '')) + '</span><span><span class="t">' + esc(r.location.name) + '</span> — ' + esc(r.title) + '<br><span class="sub">' + esc(last.note || '') + '</span></span>' + lvlPill(r._score) + '</a>';
      }).join('');
    }).join('') || '<p class="muted">No changes recorded.</p>';

    var cov0 = feed.coverage || {};
    if (cov0.baseline_note) $('#baseline-note').innerHTML = '<p class="callout">' + esc(cov0.baseline_note) + '</p>';
    $('#milestones').innerHTML = milestonesHtml(feed.milestones) || '<p class="muted">None recorded.</p>';
    var cc = (feed.summary || {}).cross_cutting || [];
    $('#cross').innerHTML = cc.length ? '<div class="kv">' + cc.map(function (x) { return '<div>' + esc(x.label) + '</div><div>' + esc(x.text) + '</div>'; }).join('') + '</div>' : '<p class="muted">None provided.</p>';
    var cor = feed.corrections || [];
    $('#corrections').innerHTML = cor.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Finding</th><th>Field</th><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>' +
      cor.map(function (c) { return '<tr><td class="num">' + esc(c.date) + '</td><td><a href="dossier.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.id) + '</a></td><td>' + esc(c.field) + '</td><td>' + esc(c.from) + '</td><td>' + esc(c.to) + '</td><td>' + esc(c.reason) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '<p class="muted">No corrections this run.</p>';

    var cov = feed.coverage || {}, researched = {};
    (cov.categories || []).forEach(function (c) { researched[c.slug] = c.researched; });
    $('#cov-range').textContent = cov.date_range || '';
    // Seas researched in depth (cumulative), N of SEA_CODES.length (32 codes in src/geo.js).
    var done = (cov.regions_researched || []).filter(function (c) { return SEAS[c]; });
    var pending = SEA_CODES.filter(function (c) { return done.indexOf(c) < 0; });
    $('#cov-seas').innerHTML = '<b>' + done.length + ' of ' + SEA_CODES.length + '</b> regional seas researched in depth.' +
      (done.length ? '<div class="small" style="margin-top:4px">Done: ' + done.map(function (c) { return '<a href="sea.html?code=' + c + '">' + esc(seaName(c)) + '</a>'; }).join(', ') + '</div>' : '') +
      (pending.length ? '<div class="small muted" style="margin-top:4px">Pending: ' + pending.map(seaName).map(esc).join(', ') + '</div>' : '');
    $('#cov-cats').innerHTML = CATEGORIES.map(function (c) {
      var n = (feed._byCat[c.slug] || []).length;
      return '<tr><td>' + c.order + '</td><td>' + esc(c.name) + '</td><td>' + (researched[c.slug] ? 'Yes' : '<span class="muted">Not stated</span>') + '</td><td class="num">' + (n || '<span class="muted">No qualifying findings located</span>') + '</td><td class="small">' + catNote(feed, c.slug).trim() + '</td></tr>';
    }).join('');
    var list = function (sel, arr) { $(sel).innerHTML = (arr || []).length ? arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li class="muted">None stated</li>'; };
    list('#cov-unverified', cov.unverified_fields);
    list('#cov-gaps', cov.gaps);
    $('#cov-scope').textContent = cov.scope_limits || 'Not stated';
    $('#cov-statement').textContent = cov.statement || '';
    var errs = feed.errors || [];
    $('#cov-errors').innerHTML = errs.length ? errs.map(function (e) { return '<li>' + esc(e.code || '') + ' ' + esc(e.message || JSON.stringify(e)) + '</li>'; }).join('') : '<li class="muted">None</li>';
  }

  /* ---------- boot ---------- */
  var PAGES = { overview: renderOverview, explorer: renderExplorer, dossier: renderDossier, updates: renderUpdates };
  function boot() {
    initChrome();
    var page = document.body.getAttribute('data-page');
    loadFeed().then(function (feed) {
      showRunMeta(feed);
      if (PAGES[page]) PAGES[page](feed);
      window.WX = { feed: feed, page: page, CATEGORIES: CATEGORIES, CAT_BY_SLUG: CAT_BY_SLUG, CAT_LAYER: CAT_LAYER, LAYERS: LAYERS, LEVELS: LEVELS, RISK_LEVELS: RISK_LEVELS, TRENDS: TRENDS, COMPONENTS: COMPONENTS,
        SEAS: SEAS, SEA_CODES: SEA_CODES, BASINS: BASINS, SEA_TILES: SEA_TILES, EXTENTS: EXTENTS, PRECISIONS: PRECISIONS,
        esc: esc, catName: catName, catIcon: catIcon, seasOf: seasOf, basinOf: basinOf, countriesOf: countriesOf, seaName: seaName, basinName: basinName, countryName: countryName, whereLine: whereLine,
        isActive: isActive, levelOf: levelOf, latestSourceDate: latestSourceDate, cmpRank: cmpRank, renderTileMap: renderTileMap, reload: loadFeed };
      document.dispatchEvent(new CustomEvent('wx:ready', { detail: window.WX }));
    }).catch(fail);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
