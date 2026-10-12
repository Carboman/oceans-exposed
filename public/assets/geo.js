/* oceans.exposed — shared map geography and helpers (no rendering here).
   Hand-drawn, approximate polygons for the 32 regional seas in [lon, lat], a label point per sea, and small helpers
   used by worldmap.js (overview), seamap.js (sea page) and locator.js (dossier). The sea codes mirror src/geo.js and
   app.js; polygons are illustrative outlines that roughly follow the coasts, not legal or hydrographic boundaries.
   Polygons that cross the antimeridian (NPAC, SPAC, BERING, the polar caps) are left whole: d3-geo clips them. */
(function () {
  'use strict';

  // Each ring is drawn roughly clockwise on a north-up map; normaliseRing() fixes the winding d3 expects.
  var POLYS = {
    ARCTIC: ring(66, [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]),
    SOUTHERN: ring(-55, [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]),
    NPAC: [[141, 34], [145, 42], [150, 48], [160, 52], [172, 52], [180, 51], [-168, 52.5], [-160, 53], [-155, 54], [-150, 50], [-140, 45], [-130, 38], [-125, 30], [-120, 22], [-125, 15], [-140, 13], [-160, 13], [-180, 14], [160, 15], [145, 20], [140, 28]],
    SPAC: [[160, -10], [170, -12], [180, -10], [-170, -5], [-160, -2], [-140, 0], [-120, 0], [-100, -5], [-90, -12], [-88, -25], [-90, -40], [-100, -50], [-120, -55], [-140, -55], [-160, -53], [-175, -50], [175, -47], [170, -46], [172, -40], [173, -33], [170, -27], [168, -22], [163, -17]],
    BERING: [[163, 55.5], [165, 60.5], [172, 61], [180, 65], [-172, 65.8], [-168, 65.5], [-165, 62], [-162, 59], [-158, 57.5], [-160, 55.5], [-166, 53.5], [-176, 52], [180, 51.5], [172, 52.5], [165, 54]],
    JPN: [[129.5, 34.5], [134, 35.8], [136.5, 37], [139, 39], [140.3, 41], [140, 43.2], [141.5, 45.4], [142, 47], [141.5, 49], [142, 51.5], [140.5, 51.8], [139, 48.5], [137, 46], [134, 43.2], [131.5, 42.8], [129.5, 40.5], [128.5, 38.5], [129.3, 36]],
    ECS: [[117.8, 40.8], [121.5, 40.6], [122.5, 39.5], [124.5, 39.8], [126, 37.5], [126.3, 34.5], [128.5, 34], [130.5, 32], [129.5, 29.5], [126, 25.5], [122.5, 24], [120.5, 25.5], [120, 27.5], [121.8, 30.5], [120.5, 33.5], [119.3, 35], [120, 37.3], [118, 38.5]],
    SCS: [[100.5, 13], [104, 9.5], [108.5, 11], [109, 15.5], [107.5, 20], [111, 21], [117.5, 23], [120.3, 22], [120, 14], [117, 8.5], [113.5, 4.5], [109, 1.5], [104.5, 2], [103, 7], [101, 10]],
    SEA: [[103, 0], [105, -3], [106, -7], [110, -8.5], [116, -9.5], [122, -11], [128, -9.5], [134, -8], [135, -4], [134, 2], [130, 8], [126, 13], [124, 19], [121.5, 21], [120.5, 18], [119.5, 12], [117, 7], [114, 4.5], [110, 2]],
    CORAL: [[142.5, -10.5], [145, -8.5], [150, -10], [155, -9], [160, -10], [165, -15], [167, -21], [165, -25], [158, -29], [153.5, -27.8], [153, -25], [150.5, -22], [147, -19], [145.5, -15.5], [144, -13]],
    TASMAN: [[150, -37.5], [148, -41], [147, -43.5], [150, -45], [160, -47], [167, -47], [170, -45], [172, -41], [173, -38], [172, -34], [165, -30], [158, -29], [153.5, -29], [152, -33], [150.5, -35]],
    NEPAC: [[-152, 60.5], [-146, 61], [-140, 59.5], [-135, 57], [-130, 54], [-127, 50], [-125, 46], [-124, 41], [-122, 36.5], [-118, 33], [-117.5, 31.5], [-121, 30], [-126, 34], [-130, 40], [-135, 45], [-142, 50], [-150, 52], [-158, 55.5], [-155, 58]],
    TROPEPAC: [[-117, 31], [-110, 24], [-105, 20], [-95, 16], [-88, 13], [-82, 8], [-78, 5], [-80, 0], [-81, -5], [-82, -10], [-90, -10], [-100, -8], [-110, -5], [-120, 0], [-122, 10], [-120, 20], [-118, 26]],
    SEPAC: [[-81, -5], [-78, -8], [-76.5, -13], [-74, -17], [-70.5, -20], [-70.5, -27], [-71.5, -33], [-73.5, -40], [-74.5, -46], [-75.5, -52], [-72, -56], [-78, -57], [-83, -50], [-85, -40], [-86, -30], [-88, -20], [-88, -10]],
    NATL: [[-65, 22], [-68, 30], [-62, 38], [-55, 43], [-50, 47], [-42, 52], [-35, 57], [-28, 62], [-20, 62], [-16, 56], [-18, 50], [-20, 42], [-22, 35], [-25, 28], [-35, 22], [-50, 20]],
    SATL: [[-30, -3], [-20, -2], [-5, -3], [2, -8], [8, -15], [10, -22], [8, -30], [2, -38], [-10, -45], [-25, -52], [-40, -55], [-50, -50], [-45, -42], [-40, -32], [-38, -22], [-35, -14]],
    NWATL: [[-80, 25.5], [-81, 30], [-78, 34], [-75, 36], [-73, 40.5], [-69, 42], [-66, 44.5], [-62, 46], [-58, 48], [-55, 51.5], [-58, 54], [-50, 54], [-48, 48], [-55, 43], [-62, 40], [-68, 36], [-72, 32], [-76, 27]],
    GOM: [[-97.5, 26], [-97, 21], [-94, 18.5], [-90, 19.5], [-87.5, 21.5], [-86, 22], [-85, 24], [-83, 25.5], [-81.5, 26.5], [-82.5, 29], [-85, 30], [-89, 30], [-94, 29.5], [-97, 28]],
    CAR: [[-88, 21], [-85, 21.5], [-82, 23], [-77, 21], [-73, 20], [-68, 19], [-64, 18.5], [-60, 15], [-61, 11], [-65, 10.5], [-71, 11.5], [-75, 10], [-77.5, 8], [-82, 9], [-84, 11.5], [-86, 16], [-88, 18]],
    NSEA: [[-4, 58.5], [-1.5, 60.5], [2, 61.5], [5, 62], [8, 58], [10.5, 57.5], [8.5, 55], [8, 53.5], [5, 53], [2, 51], [1.5, 51.3], [-1.5, 53], [-2, 56], [-3, 57.5]],
    BAL: [[10, 54.5], [12, 54], [14.5, 54], [19, 54.5], [21, 55.5], [21, 57], [23.5, 58.5], [24, 59.5], [30, 60], [28, 60.5], [23, 60.2], [21.3, 60.5], [21, 62.5], [23, 65.5], [25, 65.2], [22.5, 64], [19.5, 63], [18, 61.5], [17, 59.5], [16.5, 57.5], [14.5, 56.5], [12.5, 56]],
    NEATL: [[-11, 58], [-6, 58.5], [-5, 55], [-6, 50], [-3, 48.5], [-1.5, 46], [-1.5, 44], [-5, 43.5], [-9, 43.5], [-9.5, 40], [-9.5, 37], [-7, 36], [-10, 35], [-15, 37], [-16, 44], [-14, 50], [-13, 55]],
    MED: [[-5.5, 36], [0, 38.5], [3, 43], [8, 44], [14, 45.5], [19, 42], [22, 39], [26, 40], [29, 36.5], [36, 36.5], [35, 31.5], [30, 31.5], [25, 32], [19, 30.5], [11, 34], [10, 37], [2, 36]],
    BLK: [[28, 42], [28.5, 44.5], [30.5, 46.5], [33, 46], [34, 44.5], [36.5, 45.5], [38, 46.5], [41, 43], [41.5, 41.5], [39, 41], [35, 42], [32, 41.5], [29, 41.2]],
    GOG: [[-17.5, 14.7], [-15, 10.5], [-11, 6.5], [-5, 5], [2, 5.5], [8.5, 4.5], [9, -1], [12, -6], [12.5, -12], [12, -17.5], [8, -18], [3, -11], [-2, -1], [-8, 1.5], [-14, 4], [-20, 9], [-20, 14]],
    BRA: [[-50, 0], [-42, -2], [-35, -6], [-38, -13], [-40, -20], [-45, -24], [-49, -29], [-55, -35], [-62, -40], [-65, -45], [-68, -51], [-66, -55], [-58, -54], [-52, -44], [-46, -34], [-38, -26], [-31, -16], [-32, -5], [-42, 2]],
    SAFR: [[12, -22], [14.5, -26], [15, -29], [17, -33], [19, -35], [22, -35], [26, -34.5], [30, -31], [32.5, -28.5], [35, -25], [36, -22], [40, -24], [38, -30], [34, -34], [28, -38], [22, -39], [16, -37], [11, -30], [10, -24]],
    RED: [[32.5, 30], [34.5, 29], [35, 27], [37, 24], [38.5, 21.5], [40, 17.5], [42, 14.5], [43.5, 12.5], [43, 11.8], [41, 14.5], [39.5, 16], [37.5, 19], [36.5, 22.5], [35, 25], [33.5, 27.5], [32.5, 29.5]],
    GULF: [[48, 30], [51, 27.5], [55, 26.5], [57.5, 25], [62, 25], [67, 24.5], [70, 21], [73, 16], [74, 11], [72, 8], [65, 9], [58, 13], [51, 14], [54, 17], [58, 20], [59, 22.5], [56, 25], [50, 25.5]],
    BEN: [[80, 10], [80.3, 15], [82, 17], [85, 19.5], [88, 21.5], [91.5, 22.5], [94, 19], [94.5, 16], [97.5, 16.5], [98.5, 12], [98, 8.5], [96, 6], [93, 4], [88, 5], [84, 6], [81.5, 6.5], [79.5, 8]],
    WIND: [[51, 11], [55, 8], [62, 2], [66, -5], [68, -15], [64, -25], [55, -30], [47, -30], [42, -27], [36, -24], [36, -18], [40, -12], [39, -6], [41, -1], [43, 4], [46, 8], [50, 11]],
    EIND: [[90, -8], [96, -5], [100, -3], [105, -7], [110, -9], [118, -10], [124, -11], [128, -13], [128, -20], [122, -22], [116, -28], [115, -34], [118, -37], [125, -38], [130, -40], [128, -45], [115, -45], [100, -40], [90, -30], [88, -18]]
  };
  // A ring of constant latitude: a polar cap when the polygon is closed around the pole.
  function ring(lat, lons) {
    return lons.map(function (l) { return [l, lat]; });
  }

  // Hand-chosen label anchor per sea (lon, lat): inside the fill, away from coasts where possible.
  var LABELS = {
    ARCTIC: [60, 80], SOUTHERN: [-60, -64], NPAC: [-150, 32], SPAC: [-125, -28], BERING: [177, 58], JPN: [135, 40.5], ECS: [124.5, 30],
    SCS: [113, 14], SEA: [124, 1], CORAL: [153, -18], TASMAN: [161, -40], NEPAC: [-134, 47], TROPEPAC: [-103, 7], SEPAC: [-79, -30],
    NATL: [-40, 40], SATL: [-18, -30], NWATL: [-66, 42], GOM: [-90, 25], CAR: [-76, 15], NSEA: [3.5, 57], BAL: [20, 58.5], NEATL: [-11, 46],
    MED: [17, 36], BLK: [34, 43.5], GOG: [1.5, -0.5], BRA: [-44, -30], SAFR: [26, -36.5], RED: [38, 20], GULF: [62, 18], BEN: [88, 14],
    WIND: [52, -16], EIND: [105, -27]
  };

  // d3-geo wants exterior rings wound clockwise (north-up); a ring the other way means "everything but this".
  function normaliseRing(r, d3) {
    var closed = r.slice(); if (closed[0][0] !== closed[closed.length - 1][0] || closed[0][1] !== closed[closed.length - 1][1]) closed.push(closed[0]);
    var f = { type: 'Polygon', coordinates: [closed] };
    if (d3 && d3.geoArea(f) > 2 * Math.PI) { closed.reverse(); f = { type: 'Polygon', coordinates: [closed] }; }
    return f;
  }
  var cache = {};
  function feature(code, d3) {
    if (!POLYS[code]) return null;
    if (!cache[code]) cache[code] = { type: 'Feature', id: code, properties: { code: code }, geometry: normaliseRing(POLYS[code], d3) };
    return cache[code];
  }
  function allFeatures(d3) { return Object.keys(POLYS).map(function (c) { return feature(c, d3); }); }
  // A sea's bounding box in lon/lat with the antimeridian unwrapped: [[w, s], [e, n]] (e may exceed 180).
  function bbox(code) {
    var pts = POLYS[code]; if (!pts) return null;
    var lons = pts.map(function (p) { return p[0]; }), lats = pts.map(function (p) { return p[1]; });
    var w = Math.min.apply(null, lons), e = Math.max.apply(null, lons);
    if (e - w > 180) { // crosses the antimeridian: shift western hemisphere points east
      lons = lons.map(function (l) { return l < 0 ? l + 360 : l; }); w = Math.min.apply(null, lons); e = Math.max.apply(null, lons);
    }
    return [[w, Math.min.apply(null, lats)], [e, Math.max.apply(null, lats)]];
  }
  function centroid(code) { var b = bbox(code); if (!b) return [0, 0]; var lon = (b[0][0] + b[1][0]) / 2; if (lon > 180) lon -= 360; return [lon, (b[0][1] + b[1][1]) / 2]; }

  // TopoJSON files are fetched once per page and shared.
  var topoCache = {};
  function loadTopo(url) {
    if (!topoCache[url]) topoCache[url] = fetch(url, { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw new Error('map data ' + r.status); return r.json(); });
    return topoCache[url];
  }
  function libsReady() { return !!(window.d3 && window.topojson && window.d3.geoEqualEarth); }

  // The points of a record: location.coordinates first, then location.points[].
  function pointsOf(r) {
    var l = (r && r.location) || {}, out = [];
    (l.coordinates ? [l.coordinates] : []).concat(Array.isArray(l.points) ? l.points : []).forEach(function (p) {
      if (p && typeof p.lat === 'number' && typeof p.lon === 'number' && isFinite(p.lat) && isFinite(p.lon)) out.push({ lat: p.lat, lon: p.lon, precision: p.precision || 'exact', name: p.name || '' });
    });
    return out;
  }

  /* Shared floating tooltip (one element per page). */
  var tipEl = null;
  function tip(html, x, y) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'viz-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    if (html === null || html === undefined) { tipEl.classList.remove('on'); return; }
    tipEl.innerHTML = html; tipEl.classList.add('on');
    var r = tipEl.getBoundingClientRect(), left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    tipEl.style.left = Math.max(8, left) + 'px'; tipEl.style.top = Math.max(8, top) + 'px';
  }
  // Hover + keyboard focus on any element with data-tip inside root; html(el) returns the tooltip HTML.
  function bindTips(root, html) {
    root.addEventListener('mousemove', function (e) { var el = e.target.closest('[data-tip]'); if (el && root.contains(el)) tip(html(el), e.clientX, e.clientY); else tip(null); });
    root.addEventListener('mouseleave', function () { tip(null); });
    root.addEventListener('focusin', function (e) { var el = e.target.closest('[data-tip]'); if (el) { var b = el.getBoundingClientRect(); tip(html(el), b.left + b.width / 2, b.top + b.height / 2); } });
    root.addEventListener('focusout', function () { tip(null); });
  }

  window.OEGeo = { POLYS: POLYS, LABELS: LABELS, feature: feature, allFeatures: allFeatures, bbox: bbox, centroid: centroid, loadTopo: loadTopo, libsReady: libsReady, pointsOf: pointsOf, tip: tip, bindTips: bindTips,
    LAND_110: 'assets/data/land-110m.json', LAND_50: 'assets/data/land-50m.json', COUNTRIES_110: 'assets/data/countries-110m.json' };
})();
