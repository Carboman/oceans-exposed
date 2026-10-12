/* earth.exposed shared map: Natural Earth land (Equal Earth), one layer per site from /data/layers/<site>.geojson.
   Features with null geometry and a us-state region are placed at the state's centroid (us-atlas, Census Bureau).
   Needs d3 7.9.0 and topojson-client 3.0.2 (cdnjs). Every point links back to the finding on its site. */
(function () {
  'use strict';
  if (!window.d3 || !window.topojson) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var FIPS = { '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI' };
  var W = 1180, H = 600;
  var mount = $('#map'), tools = $('#layers'), list = $('#map-list'), tip = $('#map-tip');
  if (!mount) return;
  var proj = d3.geoEqualEarth().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' });
  var path = d3.geoPath(proj);
  var enabled = {}, layers = {}, centroids = {};
  var hash = (location.hash || '').slice(1);

  Promise.all([
    fetch('assets/data/land-110m.json').then(function (r) { return r.json(); }),
    fetch('assets/data/states-10m.json').then(function (r) { return r.json(); }),
    fetch('data/snapshot.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
  ]).then(function (res) {
    var land = topojson.feature(res[0], res[0].objects.land);
    topojson.feature(res[1], res[1].objects.states).features.forEach(function (f) { var c = FIPS[f.id]; if (c) centroids[c] = d3.geoCentroid(f); });
    var snap = res[2];
    var ids = Object.keys(snap.sites).filter(function (id) { return snap.sites[id].layer_features > 0; });
    return Promise.all(ids.map(function (id) {
      return fetch('data/layers/' + id + '.geojson').then(function (r) { return r.ok ? r.json() : null; }).then(function (l) { if (l) { layers[id] = l; enabled[id] = !hash || hash === id; } });
    })).then(function () { draw(land, snap); });
  }).catch(function (err) { mount.innerHTML = '<p class="muted" style="padding:16px">The map could not be loaded (' + esc(err.message) + ').</p>'; });

  function place(f) {
    if (f.geometry && f.geometry.type === 'Point') return f.geometry.coordinates;
    var r = f.properties && f.properties.region; if (r && r.type === 'us-state' && centroids[r.code]) return centroids[r.code];
    return null;
  }

  function draw(land, snap) {
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="map-title"><title id="map-title">Shared map of the earth.exposed network</title>' +
      '<path class="map-land" d="' + path(land) + '"></path><g id="map-pts"></g></svg>';
    mount.innerHTML = svg;
    var togg = Object.keys(layers).map(function (id) {
      var s = snap.sites[id];
      return '<label class="layer-toggle" data-site="' + esc(id) + '"><input type="checkbox" data-layer="' + esc(id) + '"' + (enabled[id] ? ' checked' : '') + '><span class="dot" aria-hidden="true"></span>' + esc(s.site) +
        ' <span class="count">' + layers[id].features.length.toLocaleString('en-US') + (s.status === 'stale' ? ' · stale since ' + esc(s.stale_since) : '') + '</span></label>';
    }).join('');
    tools.innerHTML = togg || '<span class="muted">No layers in the snapshot yet.</span>';
    tools.querySelectorAll('input[data-layer]').forEach(function (cb) { cb.addEventListener('change', function () { enabled[cb.getAttribute('data-layer')] = cb.checked; render(snap); }); });
    render(snap);
  }

  function render(snap) {
    var g = $('#map-pts'), items = [], out = '';
    Object.keys(layers).forEach(function (id) {
      if (!enabled[id]) return;
      layers[id].features.forEach(function (f, i) {
        var ll = place(f); if (!ll) return;
        var xy = proj(ll); if (!xy) return;
        var p = f.properties, r = p.count ? Math.max(3, Math.min(14, 2 + Math.sqrt(p.count) * 1.2)) : 3.4;
        out += '<a href="' + esc(p.url) + '" rel="noopener" aria-label="' + esc(p.title) + ' (' + esc(p.site) + ')"><circle class="map-pt" data-site="' + esc(id) + '" data-i="' + i + '" cx="' + xy[0].toFixed(1) + '" cy="' + xy[1].toFixed(1) + '" r="' + r.toFixed(1) + '"></circle></a>';
        items.push({ id: id, f: f });
      });
    });
    g.innerHTML = out;
    g.querySelectorAll('.map-pt').forEach(function (c) {
      c.addEventListener('mouseenter', function (ev) { var f = layers[c.getAttribute('data-site')].features[+c.getAttribute('data-i')]; showTip(f, ev); });
      c.addEventListener('mousemove', function (ev) { moveTip(ev); });
      c.addEventListener('mouseleave', function () { tip.hidden = true; });
    });
    var shown = items.slice(0, 80);
    list.innerHTML = '<p class="map-note">' + items.length.toLocaleString('en-US') + ' plotted features' + (items.length > shown.length ? '; the first ' + shown.length + ' are listed below, every one is on the map' : '') + '. Each links to the finding on its site.</p>' +
      '<ol>' + shown.map(function (it) { var p = it.f.properties; return '<li><a href="' + esc(p.url) + '" rel="noopener">' + esc(p.title) + '</a> <span class="mono small muted">' + esc(p.site) + (p.level ? ' · ' + esc(p.level) : '') + (p.date ? ' · ' + esc(p.date) : '') + '</span></li>'; }).join('') + '</ol>';
  }

  function showTip(f, ev) {
    var p = f.properties;
    tip.innerHTML = '<b>' + esc(p.title) + '</b><span class="mono">' + esc(p.site) + (p.level ? ' · ' + esc(p.level) : '') + (p.category ? ' · ' + esc(p.category) : '') + (p.date ? ' · ' + esc(p.date) : '') + (p.region ? ' · placed at the ' + esc(p.region.code) + ' state centroid' : '') + '</span>';
    tip.hidden = false; moveTip(ev);
  }
  function moveTip(ev) {
    var b = mount.getBoundingClientRect(), x = ev.clientX - b.left + 14, y = ev.clientY - b.top + 14;
    if (x + 290 > b.width) x = ev.clientX - b.left - 290; if (y + 90 > b.height) y = ev.clientY - b.top - 80;
    tip.style.left = Math.max(0, x) + 'px'; tip.style.top = Math.max(0, y) + 'px';
  }
})();
