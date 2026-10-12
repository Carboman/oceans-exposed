/* oceans.exposed — world map on the overview (index.html).
   Equal Earth projection (d3-geo), Natural Earth land (assets/data/land-110m.json), the 32 regional seas as soft
   translucent fills coloured by their most severe active finding, and every located active finding as a glowing
   point sized by score. Needs d3 + topojson (cdnjs) and geo.js; without d3 the page keeps the sea tile grid.
   Colour comes from CSS custom properties (styles.css) so the theme switch needs no re-render. */
(function () {
  'use strict';
  var W = null, G = window.OEGeo;
  var ROTATE = [-11, 0];      // centre on 11°E so the antimeridian cut runs through the Bering Strait
  var VW = 960;               // viewBox width; height follows the projection (about 2.05:1)
  var LEVELS = ['Critical', 'High', 'Moderate', 'Low'];
  var state = { view: 'map' };
  try { state.view = localStorage.getItem('oe-mapview') === 'grid' ? 'grid' : 'map'; } catch (e) {}

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return W.esc(s); }
  function lvlKey(l) { return String(l).toLowerCase(); }
  function pill(r) { return '<span class="lvl lvl-' + lvlKey(r._level) + '">' + r._level + ' ' + r._score + '</span>'; }

  // Per-sea index of active findings (sorted by rank) and the located points of every active finding.
  function index() {
    var active = W.feed.records.filter(W.isActive), bySea = {};
    active.forEach(function (r) { W.seasOf(r).forEach(function (s) { if (W.SEAS[s]) (bySea[s] = bySea[s] || []).push(r); }); });
    Object.keys(bySea).forEach(function (s) { bySea[s].sort(W.cmpRank); });
    var pts = [];
    active.forEach(function (r) { G.pointsOf(r).forEach(function (p) { pts.push({ r: r, p: p }); }); });
    return { active: active, bySea: bySea, pts: pts };
  }

  function seaTip(code, list) {
    var sea = W.SEAS[code], name = W.seaName(code), basin = W.basinName(sea.basin);
    if (!list || !list.length) return '<div class="tt-title">' + esc(name) + '</div><div class="tt-sub">' + esc(basin) + ' · ' + code + '</div><div class="muted">No active finding in this feed. That does not mean there are no problems here.</div><div class="tt-hint">Open the sea page</div>';
    var top = list[0];
    return '<div class="tt-title">' + esc(name) + '</div><div class="tt-sub">' + esc(basin) + ' · ' + code + ' · ' + list.length + ' active finding' + (list.length === 1 ? '' : 's') + '</div>' +
      '<div class="tt-row">' + pill(top) + ' <b>' + esc(top.location.name) + '</b></div><div class="tt-row muted">' + esc(top.title) + '</div>' +
      (list.length > 1 ? '<div class="tt-row muted">Then: ' + list.slice(1, 4).map(function (r) { return esc(r.location.name) + ' (' + r._score + ')'; }).join(', ') + (list.length > 4 ? ', +' + (list.length - 4) + ' more' : '') + '</div>' : '') +
      '<div class="tt-hint">Open the sea page</div>';
  }
  function pointTip(pt) {
    var r = pt.r;
    return '<div class="tt-title">' + esc(r.location.name) + '</div><div class="tt-sub">' + esc(r.title) + '</div>' +
      '<div class="tt-row">' + pill(r) + ' <span class="muted">' + esc(r.status) + '</span></div>' +
      '<div class="tt-row muted">' + esc(W.catName(r.primary_category)) + ' · ' + esc(W.whereLine(r)) + '</div>' +
      '<div class="tt-row muted">' + esc((W.PRECISIONS[pt.p.precision] || pt.p.precision) + (pt.stacked ? ' · ' + pt.stacked + ' findings share this spot' : '')) + '</div><div class="tt-hint">Open the dossier</div>';
  }

  function draw(mount, land, countries) {
    var idx = index();
    var cw = Math.max(mount.clientWidth || 960, 640);  // below 640px the map scrolls inside its card instead of shrinking
    var k = Math.max(1, Math.min(1.6, 760 / cw));  // enlarge labels and marks when the map is drawn small
    var proj = d3.geoEqualEarth().rotate(ROTATE).fitWidth(VW, { type: 'Sphere' });
    var path = d3.geoPath(proj);
    var sb = path.bounds({ type: 'Sphere' }), VH = Math.ceil(sb[1][1] - sb[0][1]) + 2;
    proj.fitExtent([[1, 1], [VW - 1, VH - 1]], { type: 'Sphere' });
    var sphere = path({ type: 'Sphere' });
    var grat = path(d3.geoGraticule().step([30, 30])());
    var landPath = path(topojson.feature(land, land.objects.land));
    var borderPath = countries && countries.objects && countries.objects.countries ? path(topojson.mesh(countries, countries.objects.countries, function (a, b) { return a !== b; })) : '';

    var defs = '<defs>' +
      '<radialGradient id="wm-ocean" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="var(--map-ocean-1)"/><stop offset="1" stop-color="var(--map-ocean-2)"/></radialGradient>' +
      '<filter id="wm-feather" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="' + (3.2 * k).toFixed(1) + '"/></filter>' +
      LEVELS.map(function (l) { return '<radialGradient id="wm-halo-' + lvlKey(l) + '"><stop offset="0" stop-color="var(--sev-' + lvlKey(l) + ')" stop-opacity=".55"/><stop offset=".6" stop-color="var(--sev-' + lvlKey(l) + ')" stop-opacity=".18"/><stop offset="1" stop-color="var(--sev-' + lvlKey(l) + ')" stop-opacity="0"/></radialGradient>'; }).join('') +
      '<clipPath id="wm-clip"><path d="' + sphere + '"/></clipPath></defs>';

    // Seas: feathered fill + hairline edge, wrapped in a link. Empty seas get a neutral tint.
    var seas = W.SEA_CODES.map(function (code) {
      var f = G.feature(code, d3); if (!f) return '';
      var d = path(f); if (!d) return '';
      var list = idx.bySea[code] || [], best = list[0];
      var cls = 'wm-sea' + (best ? ' lvl-' + lvlKey(best._level) : ' none');
      var label = W.seaName(code) + ', ' + W.basinName(W.SEAS[code].basin) + (best ? ': ' + list.length + ' active finding' + (list.length === 1 ? '' : 's') + ', highest ' + best._level + ' ' + best._score : ': no active finding in this feed');
      return '<a class="' + cls + '" href="sea.html?code=' + code + '" data-tip="' + code + '" role="link" tabindex="0" aria-label="' + esc(label) + '">' +
        '<path class="wm-fill" d="' + d + '" filter="url(#wm-feather)"/><path class="wm-edge" d="' + d + '"/></a>';
    }).join('');

    // Labels: sea code with a count badge at the hand-chosen anchor.
    var fs = 9.5 * k, labels = W.SEA_CODES.map(function (code) {
      var ll = G.LABELS[code]; if (!ll) return '';
      var xy = proj(ll); if (!xy) return '';
      var n = (idx.bySea[code] || []).length, best = (idx.bySea[code] || [])[0];
      var tw = code.length * fs * 0.62 + 8 * k, bw = n ? (String(n).length * fs * 0.62 + 7 * k) : 0, w = tw + bw, h = fs + 6 * k;
      return '<g class="wm-label' + (n ? '' : ' empty') + '" transform="translate(' + (xy[0] - w / 2).toFixed(1) + ',' + (xy[1] - h / 2).toFixed(1) + ')" aria-hidden="true">' +
        '<rect width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + (h / 2).toFixed(1) + '"/>' +
        '<text x="' + (tw / 2).toFixed(1) + '" y="' + (h / 2 + fs * 0.36).toFixed(1) + '" font-size="' + fs + '">' + code + '</text>' +
        (n ? '<rect class="wm-badge' + (best ? ' lvl-' + lvlKey(best._level) : '') + '" x="' + tw.toFixed(1) + '" y="' + (1.5 * k).toFixed(1) + '" width="' + (bw - 1.5 * k).toFixed(1) + '" height="' + (h - 3 * k).toFixed(1) + '" rx="' + ((h - 3 * k) / 2).toFixed(1) + '"/><text class="wm-badge-n" x="' + (tw + (bw - 1.5 * k) / 2).toFixed(1) + '" y="' + (h / 2 + fs * 0.36).toFixed(1) + '" font-size="' + (fs * 0.95).toFixed(1) + '">' + n + '</text>' : '') + '</g>';
    }).join('');

    // Points: project, fan out stacks, draw halo + dot. Tabbable only when there are few enough to tab through.
    var cells = {};
    idx.pts.forEach(function (pt) {
      var xy = proj([pt.p.lon, pt.p.lat]); if (!xy || !isFinite(xy[0])) { pt.xy = null; return; }
      pt.xy = xy; pt.at = xy;
      var key = Math.round(xy[0] / (5 * k)) + ',' + Math.round(xy[1] / (5 * k)); (cells[key] = cells[key] || []).push(pt);
    });
    Object.keys(cells).forEach(function (key) {
      var g = cells[key]; if (g.length < 2) return;
      g.forEach(function (pt, i) { var a = i * 2.399963, rr = 3.2 * k * Math.sqrt(i + 0.6); pt.xy = [pt.at[0] + rr * Math.cos(a), pt.at[1] + rr * Math.sin(a)]; pt.stacked = g.length; });
    });
    var tabbable = idx.pts.length <= 150;
    var points = idx.pts.map(function (pt, i) {
      if (!pt.xy) return '';
      var r = pt.r, hr = (4 + r._score * 1.1) * k, dr = 2.6 * k;
      return '<a class="wm-pt lvl-' + lvlKey(r._level) + '" href="dossier.html?id=' + encodeURIComponent(r.id) + '" data-tip="p:' + i + '" role="link"' + (tabbable ? ' tabindex="0"' : ' tabindex="-1"') + ' aria-label="' + esc(r.location.name + ', ' + r._level + ' ' + r._score) + '" transform="translate(' + pt.xy[0].toFixed(1) + ',' + pt.xy[1].toFixed(1) + ')">' +
        '<circle class="wm-hit" r="' + Math.max(hr, 9 * k).toFixed(1) + '"/><circle class="wm-halo" r="' + hr.toFixed(1) + '" fill="url(#wm-halo-' + lvlKey(r._level) + ')"/><circle class="wm-dot" r="' + dr.toFixed(1) + '"/></a>';
    }).join('');

    var seasWith = Object.keys(idx.bySea).length, located = idx.pts.filter(function (p) { return p.xy; }).length;
    mount.innerHTML = '<svg class="wm-svg" viewBox="0 0 ' + VW + ' ' + VH + '" role="group" aria-label="World map: ' + seasWith + ' of ' + W.SEA_CODES.length + ' regional seas with active findings; ' + located + ' located findings plotted" style="--k:' + k + '">' + defs +
      '<path class="wm-sphere" d="' + sphere + '"/><path class="wm-grat" d="' + grat + '"/>' +
      '<g clip-path="url(#wm-clip)"><g class="wm-seas">' + seas + '</g><path class="wm-land" d="' + landPath + '"/>' + (borderPath ? '<path class="wm-borders" d="' + borderPath + '"/>' : '') +
      '<g class="wm-labels">' + labels + '</g><g class="wm-points">' + points + '</g></g><path class="wm-outline" d="' + sphere + '"/></svg>';
    mount._pts = idx.pts; mount._bySea = idx.bySea; mount._k = k;
    if (!mount._bound) {
      mount._bound = true;
      G.bindTips(mount, function (el) {
        var t = el.getAttribute('data-tip');
        if (t.charAt(0) === 'p' && t.charAt(1) === ':') return pointTip(mount._pts[+t.slice(2)]);
        return seaTip(t, mount._bySea[t]);
      });
      mount.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var a = e.target.closest('a[href]'); if (a) location.href = a.getAttribute('href'); } });
    }
  }

  function legendHtml(idx) {
    return '<div class="legend wm-legend">' + LEVELS.map(function (l) { return '<span><i style="background:var(--sev-' + lvlKey(l) + ')"></i>' + l + ' ' + ({ Critical: '9–10', High: '7–8', Moderate: '4–6', Low: '0–3' })[l] + '</span>'; }).join('') +
      '<span><i class="wm-key-none"></i>No active finding in feed</span><span><i class="wm-key-pt"></i>Located finding, halo grows with score</span></div>';
  }

  function fallback(reason) {
    var wrap = $('#worldmap-wrap'), grid = $('#tilemap-wrap'), tog = $('#map-toggle');
    if (wrap) wrap.hidden = true;
    if (grid) grid.hidden = false;
    if (tog) tog.hidden = true;
    var note = $('#map-note'); if (note) { note.hidden = false; note.textContent = 'The world map could not be drawn' + (reason ? ' (' + reason + ')' : '') + '; the tile grid is shown instead.'; }
  }
  function setView(v) {
    state.view = v; if ($('#map-toggle')) { try { localStorage.setItem('oe-mapview', v); } catch (e) {} }
    var wrap = $('#worldmap-wrap'), grid = $('#tilemap-wrap');
    if (wrap) wrap.hidden = v !== 'map';
    if (grid) grid.hidden = v !== 'grid';
    document.querySelectorAll('#map-toggle button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === v)); });
    if (v === 'map') { var m = $('#worldmap'); if (m && m._needsDraw) m._needsDraw(); }
  }

  function init() {
    var mount = $('#worldmap'); if (!mount) return;
    if (!G || !G.libsReady()) { fallback('map library unavailable'); return; }
    var tog = $('#map-toggle');
    if (tog && !tog._bound) { tog._bound = true; tog.addEventListener('click', function (e) { var b = e.target.closest('button[data-view]'); if (b) setView(b.getAttribute('data-view')); }); }
    setView(tog ? state.view : 'map');  // pages without the toggle (infographic) always show the map
    var leg = $('#worldmap-legend'); if (leg) leg.innerHTML = legendHtml();
    Promise.all([G.loadTopo(G.LAND_110), G.loadTopo(G.COUNTRIES_110).catch(function () { return null; })]).then(function (res) {
      var land = res[0], countries = res[1];
      var lastW = 0;
      var redraw = function () {
        if ($('#worldmap-wrap').hidden) { mount._needsDraw = redraw; return; }
        var cw = mount.clientWidth; if (Math.abs(cw - lastW) < 40 && mount.firstChild) return;
        lastW = cw; mount._needsDraw = null;
        try { draw(mount, land, countries); } catch (err) { console.error(err); fallback(err.message); }
      };
      redraw();
      var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(redraw, 150); });
      document.addEventListener('wx:updated', function () { lastW = 0; redraw(); });  // a new run was loaded (infographic polling)
    }).catch(function (err) { console.error(err); fallback('map data missing'); });
  }

  var PAGES = { overview: 1, infographic: 1 };
  document.addEventListener('wx:ready', function (e) { W = e.detail; if (PAGES[W.page]) init(); });
  if (window.WX && PAGES[window.WX.page]) { W = window.WX; init(); }
})();
