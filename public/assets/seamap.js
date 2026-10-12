/* oceans.exposed — sea page (sea.html?code=XXX).
   One regional sea: stat tiles, a zoomed map (Equal Earth fitted to the sea's approximate outline, Natural Earth
   50m coastline loaded lazily, the sea highlighted, located findings as glowing points, graticule labels and an
   inset world map), a severity spine and category bars for the sea, then the full list as the text twin of the map.
   Findings are placed only by location.coordinates / location.points; a finding with no coordinates is listed as
   sea-wide, multi-sea or not yet located, never pinned to an arbitrary point. Sea names and basins come from app.js
   (window.WX.SEAS); outlines and helpers from geo.js (window.OEGeo); shared charts from charts.js (window.OECharts). */
(function () {
  'use strict';
  var W = null, G = window.OEGeo;
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return W.esc(s); }
  function lv(l) { return 'var(--sev-' + String(l).toLowerCase() + ')'; }
  function lvlKey(l) { return String(l).toLowerCase(); }
  function pill(r) { return '<span class="lvl lvl-' + lvlKey(r._level) + '">' + r._level + ' ' + r._score + '</span>'; }
  function fmtDeg(v, pos, neg) { v = Math.round(v * 10) / 10; if (Math.abs(v) === 180) return '180°'; return Math.abs(v).toFixed(1).replace(/\.0$/, '') + '°' + (v < 0 ? neg : pos); }
  function plural(n, s) { return n + ' ' + s + (n === 1 ? '' : 's'); }

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
    $('#sm-sub').innerHTML = '<span class="tag basin-tag" data-basin="' + sea.basin + '"><i class="basin-chip" data-basin="' + sea.basin + '"></i>' + esc(basin) + '</span> <span class="mono muted small">' + code + '</span> ' +
      (anyResearch && !researched ? '<span class="sm-pending">Not yet researched in depth: only findings from global sweeps are shown so far.</span> ' : '') +
      (recs.length ? '<b>' + active.length + '</b> active issue' + (active.length === 1 ? '' : 's') + (recs.length > active.length ? ' (+' + (recs.length - active.length) + ' resolved)' : '') + ' · ' +
        levels.filter(function (x) { return x.n; }).map(function (x) { return '<span class="lvl lvl-' + x.l.toLowerCase() + '">' + x.n + ' ' + x.l + '</span>'; }).join(' ') : 'No issues in the current feed. That does not mean there are no problems in this sea.');

    renderStats(code, recs, active);
    renderGlance(code, recs, active);
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

  // "At a glance": severity spine (0-10), category bars, issue layer and status, for this sea only.
  function renderGlance(code, recs, active) {
    var el = $('#sm-glance'); if (!el) return;
    if (!recs.length) { el.innerHTML = ''; return; }
    var C = window.OECharts;
    var bars = function (rows, colorFn) {
      var max = Math.max.apply(null, rows.map(function (x) { return x.n; }).concat([1]));
      return '<div class="smg-bars">' + rows.map(function (x) {
        return '<div class="smg-row"><span class="smg-l" title="' + esc(x.label) + '">' + esc(x.label) + '</span><span class="smg-track"><span style="width:' + (x.n / max * 100).toFixed(1) + '%;background:' + colorFn(x) + '"></span></span><b>' + x.n + '</b></div>';
      }).join('') + '</div>';
    };
    var layers = W.LAYERS.map(function (l, i) { return { label: l, slot: i + 1, n: active.filter(function (r) { return r.issue_layer === l; }).length }; }).filter(function (x) { return x.n; });
    var st = {}; recs.forEach(function (r) { st[r.status || 'Unknown'] = (st[r.status || 'Unknown'] || 0) + 1; });
    var status = Object.keys(st).map(function (k) { return { label: k, n: st[k] }; }).sort(function (a, b) { return b.n - a.n; });
    el.innerHTML =
      '<div class="smg-card smg-wide"><h3>Severity spine</h3><p class="viz-sub">Active findings in this sea at each score from 0 to 10.</p><div id="smg-hist"></div></div>' +
      '<div class="smg-card smg-wide"><h3>By category</h3><p class="viz-sub">Active findings per category, split by level.</p><div id="smg-cats"></div></div>' +
      '<div class="smg-card"><h3>Issue layer</h3>' + bars(layers, function (x) { return 'var(--series-' + x.slot + ')'; }) + '</div>' +
      '<div class="smg-card"><h3>Where things stand</h3>' + bars(status, function () { return 'var(--accent)'; }) + '</div>';
    if (C) {
      C.renderHist($('#smg-hist'), active, { href: 'explorer.html?sea=' + code });
      C.renderCatBars($('#smg-cats'), active, { hideEmpty: true, href: 'explorer.html?sea=' + code, caption: 'Findings by category in ' + W.seaName(code) });
    }
  }

  /* ---------- the map ---------- */
  function projectionFor(code, geom) {
    var proj;
    if (code === 'ARCTIC') proj = d3.geoAzimuthalEqualArea().rotate([0, -90]);
    else if (code === 'SOUTHERN') proj = d3.geoAzimuthalEqualArea().rotate([0, 90]);
    else proj = d3.geoEqualEarth().rotate([-G.centroid(code)[0], 0]);
    return proj;
  }
  function niceStep(span) { return span > 150 ? 30 : span > 60 ? 10 : span > 25 ? 5 : span > 10 ? 2 : 1; }

  function renderMap(code, recs) {
    var mount = $('#sm-map');
    if (!G || !G.libsReady()) { mount.innerHTML = '<p class="error-box">The map library did not load; the lists below still work.</p>'; renderLists(code, recs, [], recs); return; }
    var feat = G.feature(code, d3);
    // Collect the points of every finding; a point is placed wherever it is, and the frame grows to include it.
    var placed = [], unplaced = [];
    recs.forEach(function (r) { var spots = G.pointsOf(r); if (spots.length) placed.push({ r: r, spots: spots }); else unplaced.push(r); });
    var allPts = []; placed.forEach(function (p) { p.spots.forEach(function (s) { allPts.push([s.lon, s.lat]); }); });
    var fitGeom = { type: 'GeometryCollection', geometries: [feat.geometry].concat(allPts.length ? [{ type: 'MultiPoint', coordinates: allPts }] : []) };

    var VW = 960, VH = code === 'ARCTIC' || code === 'SOUTHERN' ? 620 : 520, PAD = 36;
    var proj = projectionFor(code, feat.geometry);
    proj.fitExtent([[PAD, PAD], [VW - PAD, VH - PAD]], fitGeom);
    var path = d3.geoPath(proj);
    var inv = function (xy) { var p = proj.invert(xy); return p && isFinite(p[0]) && isFinite(p[1]) ? p : null; };
    var bl = inv([PAD, VH - PAD]), br = inv([VW - PAD, VH - PAD]), tl = inv([PAD, PAD]), bc = inv([VW / 2, VH - 6]), lc = inv([6, VH / 2]), rc = inv([VW - 6, VH / 2]);
    var polar = code === 'ARCTIC' || code === 'SOUTHERN';
    var lonSpan = (bl && br) ? (((br[0] - bl[0]) % 360) + 360) % 360 : 360, latSpan = (tl && bl) ? Math.abs(tl[1] - bl[1]) : 180;
    var step = polar ? 30 : niceStep(Math.max(lonSpan, latSpan));
    var latStep = polar ? 10 : step;
    var grat = d3.geoGraticule().step([step, latStep]).precision(1);

    mount.innerHTML = '<p class="muted small map-loading">Loading coastline…</p>';
    Promise.all([G.loadTopo(G.LAND_50).catch(function () { return G.loadTopo(G.LAND_110); }), G.loadTopo(G.LAND_110).catch(function () { return null; })]).then(function (res) {
      var land = res[0], land110 = res[1];
      var landPath = path(topojson.feature(land, land.objects.land));
      // Graticule labels: longitudes along the bottom edge, latitudes along the left edge (skipped for polar views).
      var labels = '';
      if (!polar && bc && lc) {
        var lonA = Math.ceil(bl[0] / step) * step, lonB = br[0] < bl[0] ? br[0] + 360 : br[0];
        for (var lon = lonA; lon <= lonB; lon += step) { var xy = proj([((lon + 180) % 360 + 360) % 360 - 180, bc[1]]); if (xy && xy[0] > 30 && xy[0] < VW - 30) labels += '<text x="' + xy[0].toFixed(1) + '" y="' + (VH - 6) + '" text-anchor="middle">' + fmtDeg(((lon + 180) % 360 + 360) % 360 - 180, 'E', 'W') + '</text>'; }
        var latA = Math.ceil(bl[1] / latStep) * latStep, latB = tl[1];
        for (var lat = latA; lat <= latB; lat += latStep) { var yx = proj([lc[0], lat]); if (yx && yx[1] > 16 && yx[1] < VH - 16) labels += '<text x="6" y="' + (yx[1] - 3).toFixed(1) + '">' + fmtDeg(lat, 'N', 'S') + '</text>'; }
      } else if (polar) {
        for (var la = code === 'ARCTIC' ? 60 : -60; code === 'ARCTIC' ? la < 90 : la > -90; la += code === 'ARCTIC' ? 10 : -10) { var pxy = proj([0, la]); if (pxy && pxy[1] > 16 && pxy[1] < VH - 16 && pxy[0] > 0 && pxy[0] < VW) labels += '<text x="' + (pxy[0] + 4).toFixed(1) + '" y="' + (pxy[1] - 3).toFixed(1) + '">' + fmtDeg(la, 'N', 'S') + '</text>'; }
      }
      // Neighbouring seas, faint, with their codes, for orientation.
      var others = W.SEA_CODES.filter(function (c) { return c !== code; }).map(function (c) {
        var f = G.feature(c, d3), d = f && path(f); if (!d) return '';
        var lp = G.LABELS[c] ? proj(G.LABELS[c]) : null;
        return '<a class="sm-other" href="sea.html?code=' + c + '" aria-label="' + esc(W.seaName(c)) + '"><path d="' + d + '"/>' + (lp && lp[0] > 20 && lp[0] < VW - 20 && lp[1] > 20 && lp[1] < VH - 20 ? '<text x="' + lp[0].toFixed(1) + '" y="' + lp[1].toFixed(1) + '" text-anchor="middle">' + c + '</text>' : '') + '</a>';
      }).join('');

      // Points: project, fan out stacks so each marker is visible and clickable.
      var cells = {};
      placed.forEach(function (p) { p.spots.forEach(function (s) { var xy = proj([s.lon, s.lat]); s.xy = xy && isFinite(xy[0]) ? xy : null; s.at = s.xy; if (s.xy) { var k = Math.round(s.xy[0] / 6) + ',' + Math.round(s.xy[1] / 6); (cells[k] = cells[k] || []).push(s); } }); });
      Object.keys(cells).forEach(function (k) { var g = cells[k]; if (g.length < 2) return; g.forEach(function (s, i) { var a = i * 2.399963, rr = 9 * Math.sqrt(i + 0.6); s.xy = [s.at[0] + rr * Math.cos(a), s.at[1] + rr * Math.sin(a)]; s.stacked = g.length; }); });
      var marks = placed.map(function (p, i) {
        return p.spots.map(function (s, j) {
          if (!s.xy) return '';
          var approx = /coastline|sea|city/.test(s.precision), hr = 6 + p.r._score * 1.3;
          return '<a class="sm-mark' + (approx ? ' approx' : '') + (W.isActive(p.r) ? '' : ' resolved') + ' lvl-' + lvlKey(p.r._level) + '" href="dossier.html?id=' + encodeURIComponent(p.r.id) + '" transform="translate(' + s.xy[0].toFixed(1) + ',' + s.xy[1].toFixed(1) + ')" data-i="' + i + '" data-j="' + j + '" data-tip="1" tabindex="0" role="link" aria-label="' + esc(p.r.location.name + ', ' + p.r._level + ' ' + p.r._score + ', ' + (W.PRECISIONS[s.precision] || s.precision)) + '">' +
            '<circle class="sm-hit" r="' + Math.max(hr, 12) + '"/><circle class="halo" r="' + hr.toFixed(1) + '" fill="url(#sm-halo-' + lvlKey(p.r._level) + ')"/><circle class="dot" r="5.5"/></a>';
        }).join('');
      }).join('');

      var defs = '<defs><linearGradient id="sm-ocean" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--map-ocean-1)"/><stop offset="1" stop-color="var(--map-ocean-2)"/></linearGradient>' +
        '<filter id="sm-feather" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>' +
        ['Critical', 'High', 'Moderate', 'Low'].map(function (l) { return '<radialGradient id="sm-halo-' + lvlKey(l) + '"><stop offset="0" stop-color="' + lv(l) + '" stop-opacity=".5"/><stop offset=".65" stop-color="' + lv(l) + '" stop-opacity=".16"/><stop offset="1" stop-color="' + lv(l) + '" stop-opacity="0"/></radialGradient>'; }).join('') + '</defs>';
      var svg = '<svg viewBox="0 0 ' + VW + ' ' + VH + '" class="sm-svg" role="group" aria-label="Map of ' + esc(W.seaName(code)) + ' with ' + placed.length + ' placed findings">' + defs +
        '<rect class="sm-ocean" width="' + VW + '" height="' + VH + '" fill="url(#sm-ocean)"/>' +
        '<path class="sm-grat" d="' + path(grat()) + '"/>' +
        '<g class="sm-others">' + others + '</g>' +
        '<path class="sm-sea-fill" d="' + path(feat) + '" filter="url(#sm-feather)"/>' +
        '<path class="sm-land" d="' + landPath + '"/>' +
        '<path class="sm-sea" d="' + path(feat) + '"><title>' + esc(W.seaName(code)) + ' (approximate extent)</title></path>' +
        '<g class="sm-grat-label" aria-hidden="true">' + labels + '</g>' +
        '<g class="sm-marks">' + marks + '</g></svg>';

      // Inset: where this sea is on the globe.
      var inset = '';
      if (land110) {
        var IW = 200, ip = d3.geoEqualEarth().rotate([-G.centroid(code)[0], 0]).fitWidth(IW, { type: 'Sphere' }), ipath = d3.geoPath(ip);
        var ib = ipath.bounds({ type: 'Sphere' }), IH = Math.ceil(ib[1][1] - ib[0][1]) + 2;
        ip.fitExtent([[1, 1], [IW - 1, IH - 1]], { type: 'Sphere' });
        inset = '<svg class="sm-inset" viewBox="0 0 ' + IW + ' ' + IH + '" aria-label="Inset: where ' + esc(W.seaName(code)) + ' is on the globe" role="img"><path class="in-sphere" d="' + ipath({ type: 'Sphere' }) + '"/><path class="in-land" d="' + ipath(topojson.feature(land110, land110.objects.land)) + '"/><path class="in-sea" d="' + ipath(feat) + '"/></svg>';
      }

      mount.innerHTML = '<div class="sm-map-stage">' + svg + inset + '</div><div class="sm-legends">' +
        '<div class="sm-key"><span><svg width="14" height="14"><circle cx="7" cy="7" r="4.5" class="k-exact"/></svg>exact or site location</span><span><svg width="14" height="14"><circle cx="7" cy="7" r="4.5" class="k-approx"/></svg>approximate (city, coastline or sea centre)</span>' +
        '<span><i style="background:var(--sev-critical)"></i>Critical</span><span><i style="background:var(--sev-high)"></i>High</span><span><i style="background:var(--sev-moderate)"></i>Moderate</span><span><i style="background:var(--sev-low)"></i>Low</span><span><i class="k-sea"></i>Approximate extent of the sea</span></div>' +
        '<p class="small muted">Equal Earth projection fitted to the sea; coastline from Natural Earth. The halo grows with the severity score. ' +
        (placed.length ? placed.length + ' finding' + (placed.length === 1 ? '' : 's') + ' carr' + (placed.length === 1 ? 'ies' : 'y') + ' coordinates; ' : 'No finding here carries coordinates yet; ') + unplaced.length + ' listed below without a point.</p></div>';

      if (!mount._bound) {
        mount._bound = true;
        G.bindTips(mount, function (el) {
          var p = placed[+el.getAttribute('data-i')], r = p.r, s = p.spots[+el.getAttribute('data-j') || 0];
          return '<div class="tt-title">' + esc(r.location.name) + '</div><div class="tt-sub">' + esc(r.title) + '</div><div class="tt-row">' + pill(r) + ' <span class="muted">' + esc(r.status) + '</span></div>' +
            '<div class="tt-row">' + esc(W.catName(r.primary_category)) + ' · ' + esc(W.countriesOf(r).map(W.countryName).join(', ') || 'no country given') + '</div>' +
            '<div class="tt-row muted">' + esc(fmtDeg(s.lat, 'N', 'S') + ', ' + fmtDeg(s.lon, 'E', 'W') + ' · ' + (W.PRECISIONS[s.precision] || s.precision)) + (p.spots.length > 1 ? ' · ' + p.spots.length + ' points' : '') + (s.stacked ? ' · ' + s.stacked + ' findings share this point (spread out for visibility)' : '') + '</div><div class="tt-hint">Open the dossier</div>';
        });
        mount.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var a = e.target.closest('a[href]'); if (a) location.href = a.getAttribute('href'); } });
      }
      renderLists(code, recs, placed, unplaced);
    }).catch(function (err) {
      console.error(err);
      mount.innerHTML = '<p class="error-box">Could not draw the sea map (' + esc(err.message) + '). The list below still works.</p>';
      renderLists(code, recs, [], recs);
    });
  }

  // Lists (the text twin of the map): big score, 10-step meter, the five components as a mini heat strip.
  function renderLists(code, recs, placed, unplaced) {
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
    $('#sm-placed').innerHTML = placed.length ? placed.map(function (p) { return item(p.r, p.spots.map(function (s) { return s.name || (W.PRECISIONS[s.precision] || s.precision); }).slice(0, 3).join('; ')); }).join('') : '<li class="muted">None placed on the map.</li>';
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
    try { render(code); } catch (err) { console.error(err); $('#sm-map').innerHTML = '<p class="error-box">Could not draw the sea map (' + esc(err.message) + '). The list below still works.</p>'; }
  });
})();
