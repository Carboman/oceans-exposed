/* oceans.exposed — dossier locator map (dossier.html?id=).
   A small Equal Earth world map (Natural Earth 110m land) with the finding's regional sea(s) highlighted and its
   point(s) marked. Needs d3 + topojson (cdnjs) and geo.js; without them the location block stands alone. */
(function () {
  'use strict';
  var G = window.OEGeo;
  function $(s) { return document.querySelector(s); }

  function draw(W, r, mount, land) {
    var VW = 480, seas = W.seasOf(r).filter(function (c) { return W.SEAS[c]; }), pts = G.pointsOf(r);
    var lon0 = pts.length ? pts[0].lon : seas.length ? G.centroid(seas[0])[0] : 11;
    var proj = d3.geoEqualEarth().rotate([-lon0, 0]).fitWidth(VW, { type: 'Sphere' });
    var path = d3.geoPath(proj), sb = path.bounds({ type: 'Sphere' }), VH = Math.ceil(sb[1][1] - sb[0][1]) + 2;
    proj.fitExtent([[1, 1], [VW - 1, VH - 1]], { type: 'Sphere' });
    var sphere = path({ type: 'Sphere' });
    var lvl = String(r._level).toLowerCase();
    var seaPaths = seas.map(function (c) { var f = G.feature(c, d3); return f ? '<path class="lc-sea" d="' + path(f) + '"/>' : ''; }).join('');
    var marks = pts.map(function (p) { var xy = proj([p.lon, p.lat]); if (!xy) return ''; return '<g transform="translate(' + xy[0].toFixed(1) + ',' + xy[1].toFixed(1) + ')"><circle class="lc-halo" r="11"/><circle class="lc-ring" r="6"/><circle class="lc-dot" r="3"/></g>'; }).join('');
    var where = seas.length ? seas.map(W.seaName).join(', ') : (W.basinOf(r) ? W.basinName(W.basinOf(r)) : 'no sea given');
    mount.innerHTML = '<svg class="lc-svg lvl-' + lvl + '" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" aria-label="' + W.esc('Locator map: ' + where + (pts.length ? ', ' + pts.length + ' point' + (pts.length === 1 ? '' : 's') + ' marked' : '')) + '">' +
      '<defs><clipPath id="lc-clip"><path d="' + sphere + '"/></clipPath></defs>' +
      '<path class="lc-sphere" d="' + sphere + '"/><path class="lc-grat" d="' + path(d3.geoGraticule().step([30, 30])()) + '"/>' +
      '<g clip-path="url(#lc-clip)">' + seaPaths + '<path class="lc-land" d="' + path(topojson.feature(land, land.objects.land)) + '"/>' + marks + '</g><path class="lc-outline" d="' + sphere + '"/></svg>' +
      '<p class="lc-caption small muted">' + (seas.length ? seas.map(function (c) { return '<a href="sea.html?code=' + c + '">' + W.esc(W.seaName(c)) + '</a>'; }).join(', ') + ' highlighted' : W.esc(where)) + (pts.length ? '; ' + pts.length + ' located point' + (pts.length === 1 ? '' : 's') + ' in ' + W.esc(r._level) + ' colour' : '; no coordinates given') + '.</p>';
  }

  function init(W) {
    var mount = $('#viz-locator'); if (!mount) return;
    var id = new URLSearchParams(location.search).get('id');
    var r = W.feed.records.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (!G || !G.libsReady()) { mount.innerHTML = '<p class="small muted">Map unavailable.</p>'; return; }
    G.loadTopo(G.LAND_110).then(function (land) { draw(W, r, mount, land); }).catch(function (err) { console.error(err); mount.innerHTML = '<p class="small muted">Map data unavailable.</p>'; });
  }
  document.addEventListener('wx:ready', function (e) { if (e.detail.page === 'dossier') init(e.detail); });
  if (window.WX && window.WX.page === 'dossier') init(window.WX);
})();
