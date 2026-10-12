/* oceans.exposed — sea page (sea.html?code=XXX).
   Shows one regional sea: counts by level and category, a plain equirectangular point plot of the findings that
   carry coordinates (no coastline or polygon data in version 1), and the full list as the text twin of the plot.
   Findings are placed only by location.coordinates / location.points; a finding with no coordinates is listed as
   sea-wide, multi-sea or not yet located, never pinned to an arbitrary point. Sea names and basins come from
   app.js (window.WX.SEAS), which mirrors src/geo.js. */
(function () {
  'use strict';
  // Approximate bounding boxes per sea: [west, south, east, north] in degrees. East may exceed 180 where a sea
  // crosses the antimeridian; points are unwrapped into the same frame before plotting.
  var BBOX = {
    NPAC: [140, 15, 240, 62], SPAC: [150, -55, 280, 0], BERING: [160, 51, 205, 66], JPN: [127, 33, 142, 52],
    ECS: [117, 23, 131, 41], SCS: [99, -3, 121, 25], SEA: [95, -12, 135, 21], CORAL: [142, -30, 165, -8],
    TASMAN: [147, -48, 175, -30], NEPAC: [-160, 30, -115, 62], TROPEPAC: [-120, -20, -70, 25], SEPAC: [-92, -58, -68, -4],
    NATL: [-70, 20, -5, 65], SATL: [-45, -60, 20, 0], NWATL: [-82, 30, -50, 55], GOM: [-98, 17, -80, 31],
    CAR: [-90, 8, -58, 24], NSEA: [-5, 50, 12, 62], BAL: [9, 53, 31, 66], NEATL: [-20, 35, 2, 60],
    MED: [-6, 30, 37, 46], BLK: [27, 40, 42, 48], GOG: [-20, -18, 15, 15], BRA: [-70, -56, -30, 0],
    SAFR: [10, -40, 40, -22], RED: [32, 11, 44, 31], GULF: [45, 8, 78, 31], BEN: [78, 3, 100, 24],
    WIND: [30, -32, 70, 12], EIND: [90, -45, 130, -8], SOUTHERN: [-180, -80, 180, -50], ARCTIC: [-180, 62, 180, 90]
  };
  var W = null;
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return W.esc(s); }
  function lv(l) { return 'var(--sev-' + String(l).toLowerCase() + ')'; }
  function pill(r) { return '<span class="lvl lvl-' + r._level.toLowerCase() + '">' + r._level + ' ' + r._score + '</span>'; }
  function fmtDeg(v, pos, neg) { return Math.abs(v).toFixed(1).replace(/\.0$/, '') + '°' + (v < 0 ? neg : pos); }

  /* ---------- tooltip ---------- */
  var tipEl;
  function tip(html, x, y) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'viz-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    if (html === null) { tipEl.classList.remove('on'); return; }
    tipEl.innerHTML = html; tipEl.classList.add('on');
    var r = tipEl.getBoundingClientRect(), left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    tipEl.style.left = Math.max(8, left) + 'px'; tipEl.style.top = Math.max(8, top) + 'px';
  }

  function render(code) {
    var sea = W.SEAS[code];
    if (!sea) {
      $('#sm-title').textContent = 'Unknown sea';
      $('#sm-sub').innerHTML = 'Choose a regional sea from the list. Open-ocean and global findings without a sea are in the <a href="explorer.html">Explorer</a>.';
      $('#sm-map').innerHTML = '<p class="muted">No sea selected.</p>';
      return;
    }
    var name = sea.name, basin = W.basinName(sea.basin);
    document.title = name + ' · oceans.exposed';
    $('#sm-title').textContent = name;
    $('#sm-explore').href = 'explorer.html?sea=' + code;
    var recs = W.feed.records.filter(function (r) { return W.seasOf(r).indexOf(code) >= 0; }).sort(function (a, b) { return b._score - a._score || W.cmpRank(a, b); });
    var active = recs.filter(W.isActive);
    var levels = ['Critical', 'High', 'Moderate', 'Low'].map(function (l) { return { l: l, n: active.filter(function (r) { return r._level === l; }).length }; });
    var done = (W.feed.coverage || {}).regions_researched || [];
    var researched = done.indexOf(code) >= 0, anyResearch = done.length > 0;
    $('#sm-sub').innerHTML = '<span class="tag" data-basin="' + sea.basin + '" style="border-color:var(--basin);color:var(--page-text)">' + esc(basin) + '</span> <span class="mono muted small">' + code + '</span> ' +
      (anyResearch && !researched ? '<span class="sm-pending">Not yet researched in depth: only findings from global sweeps are shown so far.</span> ' : '') +
      (recs.length ? '<b>' + active.length + '</b> active issue' + (active.length === 1 ? '' : 's') + (recs.length > active.length ? ' (+' + (recs.length - active.length) + ' resolved)' : '') + ' · ' +
        levels.filter(function (x) { return x.n; }).map(function (x) { return '<span class="lvl lvl-' + x.l.toLowerCase() + '">' + x.n + ' ' + x.l + '</span>'; }).join(' ') : 'No issues in the current feed. That does not mean there are no problems in this sea.');

    renderStats(code, recs, active);
    renderGlance(recs, active);
    renderMap(code, recs);
  }

  // Counts for the sea: findings, countries touched, categories covered, most recent source.
  function renderStats(code, recs, active) {
    var el = $('#sm-stats'); if (!el) return;
    if (!recs.length) { el.hidden = true; el.innerHTML = ''; return; }
    var countries = {}, cats = {};
    active.forEach(function (r) { W.countriesOf(r).forEach(function (c) { countries[c] = 1; }); cats[r.primary_category] = 1; });
    var newest = active.map(W.latestSourceDate).sort().pop() || '';
    var top = active[0];
    el.hidden = false;
    el.innerHTML =
      '<div class="sm-stat sm-stat-main"><span class="sm-stat-v">' + active.length + '</span><span class="sm-stat-l">Active finding' + (active.length === 1 ? '' : 's') + '</span><span class="sm-stat-s">' + (recs.length - active.length) + ' resolved or stabilized in the feed.</span></div>' +
      '<div class="sm-stat"><span class="sm-stat-v">' + Object.keys(cats).length + '</span><span class="sm-stat-l">of ' + W.CATEGORIES.length + ' categories</span><span class="sm-stat-s">Each finding is ranked within its own category only.</span></div>' +
      '<div class="sm-stat"><span class="sm-stat-v">' + Object.keys(countries).length + '</span><span class="sm-stat-l">Countr' + (Object.keys(countries).length === 1 ? 'y' : 'ies') + ' or high seas named</span><span class="sm-stat-s">' + esc(Object.keys(countries).map(W.countryName).slice(0, 6).join(', ') + (Object.keys(countries).length > 6 ? ', …' : '')) + '</span></div>' +
      (top ? '<div class="sm-stat"><span class="sm-stat-v">' + top._score + '<span class="small muted">/10</span></span><span class="sm-stat-l">Highest score</span><span class="sm-stat-s">' + esc(top.location.name) + '. Newest source in this sea: ' + esc(newest || 'undated') + '.</span></div>' : '');
  }

  // "At a glance": small multiples for this sea's issues only (severity, category, layer, status).
  function renderGlance(recs, active) {
    var el = $('#sm-glance'); if (!el) return;
    if (!recs.length) { el.innerHTML = ''; return; }
    var LV = ['Critical', 'High', 'Moderate', 'Low'];
    var lvCounts = LV.map(function (l) { return { l: l, n: active.filter(function (r) { return r._level === l; }).length }; });
    var n = active.length || 1;
    var bars = function (rows, colorFn, iconFn) {
      var max = Math.max.apply(null, rows.map(function (x) { return x.n; }).concat([1]));
      return '<div class="smg-bars">' + rows.map(function (x) {
        return '<div class="smg-row"><span class="smg-l" title="' + esc(x.label) + '">' + (iconFn ? iconFn(x) : '') + esc(x.label) + '</span><span class="smg-track"><span style="width:' + (x.n / max * 100).toFixed(1) + '%;background:' + colorFn(x) + '"></span></span><b>' + x.n + '</b></div>';
      }).join('') + '</div>';
    };
    var cats = W.CATEGORIES.map(function (c) { return { slug: c.slug, label: c.name, n: active.filter(function (r) { return r.primary_category === c.slug; }).length }; }).filter(function (x) { return x.n; }).sort(function (a, b) { return b.n - a.n; });
    var layers = W.LAYERS.map(function (l, i) { return { label: l, slot: i + 1, n: active.filter(function (r) { return r.issue_layer === l; }).length }; }).filter(function (x) { return x.n; });
    var st = {}; recs.forEach(function (r) { st[r.status || 'Unknown'] = (st[r.status || 'Unknown'] || 0) + 1; });
    var status = Object.keys(st).map(function (k) { return { label: k, n: st[k] }; }).sort(function (a, b) { return b.n - a.n; });
    el.innerHTML =
      '<div class="smg-card"><h3>Severity mix</h3><div class="smg-stack">' + lvCounts.filter(function (x) { return x.n; }).map(function (x) { return '<span style="flex:' + x.n + ';background:' + lv(x.l) + '" title="' + x.l + ': ' + x.n + '"></span>'; }).join('') + '</div>' +
        '<div class="smg-legend">' + lvCounts.map(function (x) { return '<span><i style="background:' + lv(x.l) + '"></i>' + x.l + ' <b>' + x.n + '</b> <em>' + Math.round(x.n / n * 100) + '%</em></span>'; }).join('') + '</div></div>' +
      '<div class="smg-card"><h3>By category</h3>' + bars(cats, function (x) { return 'var(--series-' + ((W.CAT_LAYER[x.slug] === undefined ? 3 : W.CAT_LAYER[x.slug]) + 1) + ')'; }, function (x) { return '<span class="smg-ic">' + W.catIcon(x.slug, 14) + '</span>'; }) + '</div>' +
      '<div class="smg-card"><h3>Issue layer</h3>' + bars(layers, function (x) { return 'var(--series-' + x.slot + ')'; }) + '</div>' +
      '<div class="smg-card"><h3>Where things stand</h3>' + bars(status, function () { return 'var(--accent-bright)'; }) + '</div>';
  }

  /* ---------- point plot ---------- */
  function renderMap(code, recs) {
    var box = BBOX[code] || [-180, -90, 180, 90];
    var west = box[0];
    var unwrap = function (lon) { return lon < west ? lon + 360 : lon; };
    // Collect the points of every finding; a point is placed wherever it is, and the frame grows to include it.
    var placed = [], unplaced = [];
    recs.forEach(function (r) {
      var l = r.location || {}, spots = [];
      (Array.isArray(l.points) ? l.points : []).concat(l.coordinates ? [l.coordinates] : []).forEach(function (p) {
        if (p && typeof p.lat === 'number' && typeof p.lon === 'number' && isFinite(p.lat) && isFinite(p.lon)) spots.push({ lat: p.lat, lon: unwrap(p.lon), prec: p.precision || 'exact', label: p.name || '' });
      });
      if (spots.length) placed.push({ r: r, spots: spots }); else unplaced.push(r);
    });
    var W0 = box[0], S0 = box[1], E0 = box[2], N0 = box[3];
    placed.forEach(function (p) { p.spots.forEach(function (s) { W0 = Math.min(W0, s.lon); E0 = Math.max(E0, s.lon); S0 = Math.min(S0, s.lat); N0 = Math.max(N0, s.lat); }); });
    var padX = Math.max(1, (E0 - W0) * 0.06), padY = Math.max(1, (N0 - S0) * 0.08);
    W0 -= padX; E0 += padX; S0 = Math.max(-90, S0 - padY); N0 = Math.min(90, N0 + padY);
    // Equirectangular with the x scale reduced by cos(mid-latitude) so a degree box keeps its true proportions.
    var midLat = (S0 + N0) / 2, kx = Math.max(0.2, Math.cos(midLat * Math.PI / 180));
    var Wd = 960, aspect = ((N0 - S0) / ((E0 - W0) * kx));
    var Hd = Math.round(Math.max(220, Math.min(620, Wd * aspect)));
    var x = function (lon) { return (lon - W0) / (E0 - W0) * Wd; }, y = function (lat) { return (N0 - lat) / (N0 - S0) * Hd; };

    // Fan out markers that share a point so each one is visible and clickable.
    var stacks = {};
    placed.forEach(function (p) { p.spots.forEach(function (s) { s.xy = [x(s.lon), y(s.lat)]; s.at = s.xy; var k = Math.round(s.xy[0] / 4) + ',' + Math.round(s.xy[1] / 4); (stacks[k] = stacks[k] || []).push(s); }); });
    Object.keys(stacks).forEach(function (k) {
      var g = stacks[k]; if (g.length < 2) return;
      g.forEach(function (s, i) { var a = i * 2.399963, rr = 9 * Math.sqrt(i + 0.6); s.xy = [s.at[0] + rr * Math.cos(a), s.at[1] + rr * Math.sin(a)]; s.stacked = g.length; });
    });

    var svg = '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" class="sm-svg" role="img" aria-label="Point plot of ' + esc(W.seaName(code)) + ' with ' + placed.length + ' placed findings">';
    // Graticule every 10° (5° for small seas), labelled along the edges.
    var step = (E0 - W0) < 25 || (N0 - S0) < 15 ? 5 : (E0 - W0) > 150 ? 30 : 10;
    svg += '<g class="sm-grat">';
    for (var lon = Math.ceil(W0 / step) * step; lon <= E0; lon += step) svg += '<line x1="' + x(lon).toFixed(1) + '" y1="0" x2="' + x(lon).toFixed(1) + '" y2="' + Hd + '"/>';
    for (var lat = Math.ceil(S0 / step) * step; lat <= N0; lat += step) svg += '<line x1="0" y1="' + y(lat).toFixed(1) + '" x2="' + Wd + '" y2="' + y(lat).toFixed(1) + '"/>';
    svg += '</g><g class="sm-grat-label" aria-hidden="true">';
    for (lon = Math.ceil(W0 / step) * step; lon <= E0; lon += step) if (x(lon) > 24 && x(lon) < Wd - 24) svg += '<text x="' + (x(lon) + 3).toFixed(1) + '" y="' + (Hd - 5) + '">' + fmtDeg(lon > 180 ? lon - 360 : lon, 'E', 'W') + '</text>';
    for (lat = Math.ceil(S0 / step) * step; lat <= N0; lat += step) if (y(lat) > 14 && y(lat) < Hd - 14) svg += '<text x="4" y="' + (y(lat) - 3).toFixed(1) + '">' + fmtDeg(lat, 'N', 'S') + '</text>';
    svg += '</g>';
    // The sea's own bounding box.
    svg += '<rect class="sm-sea" x="' + x(box[0]).toFixed(1) + '" y="' + y(box[3]).toFixed(1) + '" width="' + (x(box[2]) - x(box[0])).toFixed(1) + '" height="' + (y(box[1]) - y(box[3])).toFixed(1) + '" rx="6"><title>' + esc(W.seaName(code)) + ' (approximate extent)</title></rect>';
    svg += '<g class="sm-marks">' + placed.map(function (p, i) {
      return p.spots.map(function (s, j) {
        var approx = /coastline|sea|city/.test(s.prec);
        return '<g class="sm-mark' + (approx ? ' approx' : '') + (W.isActive(p.r) ? '' : ' resolved') + '" transform="translate(' + s.xy[0].toFixed(1) + ',' + s.xy[1].toFixed(1) + ')" data-i="' + i + '" data-j="' + j + '" tabindex="0" role="link" aria-label="' + esc(p.r.location.name + ', ' + p.r._level + ' ' + p.r._score + ', ' + (W.PRECISIONS[s.prec] || s.prec)) + '" style="--c:' + lv(p.r._level) + '">' +
          '<circle r="' + (6 + p.r._score * 1.2).toFixed(1) + '" class="halo"/><circle r="5" class="dot"/></g>';
      }).join('');
    }).join('') + '</g></svg>';
    $('#sm-map').innerHTML = svg + '<div class="sm-legends">' +
      '<div class="sm-key"><span><svg width="14" height="14"><circle cx="7" cy="7" r="4.5" class="k-exact"/></svg>exact or site location</span><span><svg width="14" height="14"><circle cx="7" cy="7" r="4.5" class="k-approx"/></svg>approximate (city, coastline or sea centre)</span>' +
      '<span><i style="background:var(--sev-critical)"></i>Critical</span><span><i style="background:var(--sev-high)"></i>High</span><span><i style="background:var(--sev-moderate)"></i>Moderate</span><span><i style="background:var(--sev-low)"></i>Low</span></div>' +
      '<p class="small muted">Plain latitude/longitude plot; the dashed box is the sea\'s approximate extent and the halo grows with the severity score. No coastline data is drawn in this version. ' +
      (placed.length ? placed.length + ' finding' + (placed.length === 1 ? '' : 's') + ' carr' + (placed.length === 1 ? 'ies' : 'y') + ' coordinates; ' : 'No finding here carries coordinates yet; ') + unplaced.length + ' listed below without a point.</p></div>';

    // interactions
    var map = $('#sm-map');
    var tipFor = function (i, j) {
      var p = placed[+i], r = p.r, s = p.spots[+j || 0];
      return '<div class="tt-title">' + esc(r.location.name) + '</div><div class="tt-sub">' + esc(r.title) + '</div><div class="tt-row">' + pill(r) + ' <span class="muted">' + esc(r.status) + '</span></div>' +
        '<div class="tt-row">' + esc(W.catName(r.primary_category)) + ' · ' + esc(W.countriesOf(r).map(W.countryName).join(', ') || 'no country given') + '</div>' +
        '<div class="tt-row muted">' + esc(fmtDeg(s.lat, 'N', 'S') + ', ' + fmtDeg(s.lon > 180 ? s.lon - 360 : s.lon, 'E', 'W') + ' · ' + (W.PRECISIONS[s.prec] || s.prec)) + (p.spots.length > 1 ? ' · ' + p.spots.length + ' points' : '') + (s.stacked ? ' · ' + s.stacked + ' findings share this point (spread out for visibility)' : '') + '</div><div class="tt-hint">Click to open the dossier</div>';
    };
    if (!map._bound) {
      map._bound = true;
      map.addEventListener('mousemove', function (e) { var el = e.target.closest('[data-i]'); if (el) tip(tipFor(el.getAttribute('data-i'), el.getAttribute('data-j')), e.clientX, e.clientY); else tip(null); });
      map.addEventListener('mouseleave', function () { tip(null); });
      map.addEventListener('focusin', function (e) { var el = e.target.closest('[data-i]'); if (el) { var b = el.getBoundingClientRect(); tip(tipFor(el.getAttribute('data-i'), el.getAttribute('data-j')), b.left + b.width / 2, b.top + b.height / 2); } });
      map.addEventListener('focusout', function () { tip(null); });
      var go = function (el) { if (el) location.href = 'dossier.html?id=' + encodeURIComponent(placed[+el.getAttribute('data-i')].r.id); };
      map.addEventListener('click', function (e) { go(e.target.closest('[data-i]')); });
      map.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(e.target.closest('[data-i]')); });
    }

    // lists (the text twin of the plot): big score, 10-step meter, the five components as a mini heat strip.
    var COMP = W.COMPONENTS.map(function (c) { return [c.key, c.name.split(' ')[0].replace(/&/, '')]; });
    var item = function (r, where) {
      var c = (r.severity || {}).components || {};
      var km = (r.key_measure && r.key_measure.text) || r.description || '';
      if (km.length > 150) km = km.slice(0, 147).replace(/\s+\S*$/, '') + '…';
      var meter = '<span class="smc-meter" aria-hidden="true">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) { return '<i' + (i <= r._score ? ' class="on"' : '') + '></i>'; }).join('') + '</span>';
      var comps = '<span class="smc-comps" role="img" aria-label="' + esc(COMP.map(function (k) { return k[1] + ' ' + (c[k[0]] || 0) + ' of 2'; }).join(', ')) + '">' +
        COMP.map(function (k) { var v = Number(c[k[0]]) || 0; return '<span class="smc-comp"><i class="hm-sw v' + v + '">' + v + '</i><em>' + k[1] + '</em></span>'; }).join('') + '</span>';
      return '<li><a class="sm-item smc' + (W.isActive(r) ? '' : ' resolved') + '" href="dossier.html?id=' + encodeURIComponent(r.id) + '" style="--c:' + lv(r._level) + '">' +
        '<span class="smc-head"><span class="smc-icon">' + W.catIcon(r.primary_category, 22) + '</span><span class="smc-score"><b>' + r._score + '</b><span>/10</span></span>' + pill(r) + '</span>' +
        meter +
        '<b class="smc-name">' + esc(r.location.name) + '</b><span class="smc-title">' + esc(r.title) + '</span>' +
        (km ? '<span class="smc-km">' + esc(km) + '</span>' : '') + comps +
        '<span class="sm-item-meta">' + esc(W.catName(r.primary_category)) + ' · ' + esc(where) + ' · ' + esc(W.countriesOf(r).map(W.countryName).join(', ') || 'no country given') + ' · ' + esc(r.status || '') + (W.isActive(r) ? '' : ' (resolved)') + '</span></a></li>';
    };
    $('#sm-placed').innerHTML = placed.length ? placed.map(function (p) { return item(p.r, p.spots.map(function (s) { return s.label || (W.PRECISIONS[s.prec] || s.prec); }).slice(0, 3).join('; ')); }).join('') : '<li class="muted">None placed on the plot.</li>';
    $('#sm-unplaced').innerHTML = unplaced.length ? unplaced.map(function (r) {
      var l = r.location || {}, seas = W.seasOf(r);
      return item(r, l.extent ? (W.EXTENTS[l.extent] || l.extent) : (seas.length > 1 ? 'multi-sea: ' + seas.join(', ') : 'no coordinates given'));
    }).join('') : '<li class="muted">None.</li>';
    $('#sm-unplaced-wrap').hidden = !unplaced.length;
  }

  function initPicker(code) {
    var sel = $('#sm-pick');
    var withIssues = {}; W.feed.records.forEach(function (r) { W.seasOf(r).forEach(function (s) { withIssues[s] = (withIssues[s] || 0) + 1; }); });
    var basinOrder = ['PAC', 'ATL', 'IND', 'SOU', 'ARC'];
    sel.innerHTML = basinOrder.map(function (b) {
      var codes = W.SEA_CODES.filter(function (c) { return W.SEAS[c].basin === b; }).sort(function (p, q) { return W.seaName(p) < W.seaName(q) ? -1 : 1; });
      return '<optgroup label="' + esc(W.basinName(b)) + '">' + codes.map(function (c) { return '<option value="' + c + '"' + (c === code ? ' selected' : '') + '>' + esc(W.seaName(c)) + (withIssues[c] ? ' (' + withIssues[c] + ')' : '') + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    if (!W.SEAS[code]) sel.insertAdjacentHTML('afterbegin', '<option value="" selected>Choose a sea…</option>');
    sel.addEventListener('change', function () { if (sel.value) location.href = 'sea.html?code=' + sel.value; });
  }

  document.addEventListener('wx:ready', function (e) {
    W = e.detail; if (W.page !== 'sea') return;
    var code = String(new URLSearchParams(location.search).get('code') || '').toUpperCase();
    initPicker(code);
    try { render(code); } catch (err) { console.error(err); $('#sm-map').innerHTML = '<p class="error-box">Could not draw the sea plot (' + esc(err.message) + '). The list below still works.</p>'; }
  });
})();
