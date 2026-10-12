/* earth.exposed: renders the home tiles, the status strip and the sources page from /data/snapshot.json.
   A fact without a named source, an https URL and a date is never rendered; the renderer drops it and says so. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };
  var isDate = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); };
  var isHttps = function (u) { return /^https:\/\//.test(String(u || '')); };
  var factOk = function (f) { return f && typeof f.value === 'number' && f.source && f.source.name && isHttps(f.source.url) && isDate(f.source.date) && isDate(f.pulled); };
  var host = function (u) { try { return new URL(u).host; } catch (e) { return ''; } };

  /* ---------- chrome: theme + mobile nav ---------- */
  var root = document.documentElement;
  try { var saved = localStorage.getItem('ex-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}
  var tb = $('.theme-toggle');
  if (tb) tb.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ex-theme', next); } catch (e) {}
    document.dispatchEvent(new Event('ex:theme'));
  });
  var nt = $('.nav-toggle'), nav = $('.topnav');
  if (nt && nav) nt.addEventListener('click', function () { var open = nav.classList.toggle('open'); nt.setAttribute('aria-expanded', open ? 'true' : 'false'); });

  function sourceLine(f) {
    return '<p class="fact-src">Source: <a href="' + esc(f.source.url) + '" rel="noopener">' + esc(f.source.name) + '</a> (' + esc(host(f.source.url)) + '), dated ' + esc(f.source.date) + ' · pulled ' + esc(f.pulled) + '</p>';
  }

  function statusBadge(s) {
    if (s.status === 'fresh') return '<span class="badge badge-fresh">fresh</span>';
    if (s.status === 'stale') return '<span class="badge badge-stale">stale since ' + esc(s.stale_since) + '</span>';
    return '<span class="badge badge-missing">no data</span>';
  }

  function renderTiles(snap) {
    var mount = $('#tiles'); if (!mount) return;
    var order = (snap.network && snap.network.order) || Object.keys(snap.sites);
    var html = order.map(function (id) {
      var s = snap.sites[id]; if (!s) return '';
      if (!s.stats) {
        return '<article class="tile" data-site="' + esc(id) + '"><div class="tile-head"><span class="tile-name">' + esc(s.site) + '</span>' + statusBadge(s) + '</div>' +
          '<p class="tile-text muted">No data has been fetched from this site yet.' + (s.last_error ? ' Last attempt: ' + esc(s.last_error) + '.' : '') + '</p></article>';
      }
      var st = s.stats, h = st.headline, parts = String(st.site).split('.');
      var body = factOk(h)
        ? '<div class="tile-value">' + fmt(h.value) + '<small>' + esc(h.unit) + '</small></div><p class="tile-text">' + esc(h.text) + '</p>' + sourceLine(h)
        : '<p class="tile-text muted">Headline fact withheld: it did not carry a named source with a URL and a date.</p>';
      var facts = (st.facts || []).filter(factOk).map(function (f) { return '<li>' + esc(f.text) + sourceLine(f) + '</li>'; }).join('');
      return '<article class="tile" data-site="' + esc(id) + '">' +
        '<div class="tile-head"><a class="tile-name" href="' + esc(st.url) + '/">' + esc(parts[0]) + '<em>.' + esc(parts.slice(1).join('.')) + '</em></a>' + statusBadge(s) + '</div>' +
        '<p class="tile-tagline">' + esc(st.tagline) + (st.scope ? ' · ' + esc(st.scope) : '') + '</p>' +
        body +
        (facts ? '<ul class="tile-more">' + facts + '</ul>' : '') +
        '<div class="tile-foot"><span>' + fmt(st.records) + ' records</span>' + (typeof st.sources === 'number' ? '<span>' + fmt(st.sources) + ' sources</span>' : '') +
        '<span>last run ' + esc(st.last_run) + '</span><span>fetched ' + esc(String(s.fetched_at || '').slice(0, 10)) + '</span>' +
        (s.origin === 'adapter' ? '<span class="badge badge-derived" title="' + esc(st.derived || '') + '">derived by the hub</span>' : '<span class="badge badge-derived">published by the site</span>') +
        '<a href="map.html#' + esc(id) + '">On the map</a></div>' +
        '</article>';
    }).join('');
    mount.innerHTML = html || '<p class="muted">No sites in the snapshot.</p>';
  }

  function renderStatus(snap) {
    var el = $('#status'); if (!el) return;
    var sm = snap.summary || {};
    el.innerHTML = '<span>Snapshot <b>' + esc(String(snap.generated_at || '').replace('T', ' ').replace('Z', ' UTC')) + '</b></span>' +
      '<span><b>' + fmt(sm.fresh || 0) + '</b> fresh · <b>' + fmt(sm.stale || 0) + '</b> stale · <b>' + fmt(sm.missing || 0) + '</b> missing</span>' +
      '<span>Refreshed nightly from each site\'s <a href="methodology.html#contract">stats file</a>. A site that does not answer keeps its last good figures, marked stale with the date.</span>';
  }

  function renderSources(snap) {
    var el = $('#sources'); if (!el) return;
    var rows = [];
    Object.keys(snap.sites).forEach(function (id) {
      var s = snap.sites[id]; if (!s.stats) return;
      var all = [s.stats.headline].concat(s.stats.facts || []);
      all.forEach(function (f, i) {
        if (!factOk(f)) { rows.push('<tr><td>' + esc(s.site) + '</td><td colspan="5" class="muted">A fact was withheld: missing source, URL or date.</td></tr>'); return; }
        rows.push('<tr><td><a href="' + esc(s.stats.url) + '/">' + esc(s.site) + '</a></td><td>' + esc(f.text) + '</td><td class="mono">' + fmt(f.value) + ' ' + esc(f.unit) + '</td>' +
          '<td><a href="' + esc(f.source.url) + '" rel="noopener">' + esc(f.source.name) + '</a><br><span class="mono small muted">' + esc(f.source.url) + '</span></td><td class="mono">' + esc(f.source.date) + '</td><td class="mono">' + esc(f.pulled) + '</td></tr>');
      });
      if (s.origin === 'adapter') rows.push('<tr><td></td><td colspan="5" class="small muted">' + esc(s.stats.derived || 'Derived by the hub from the site\'s public API.') + '</td></tr>');
    });
    el.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="6" class="muted">No sources yet.</td></tr>';
    var meta = $('#sources-meta'); if (meta) meta.textContent = 'From the snapshot of ' + String(snap.generated_at || '').replace('T', ' ').replace('Z', ' UTC') + '.';
  }

  fetch('data/snapshot.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (snap) {
    window.EX_SNAPSHOT = snap;
    renderTiles(snap); renderStatus(snap); renderSources(snap);
    document.dispatchEvent(new Event('ex:snapshot'));
  }).catch(function (err) {
    var m = $('#tiles') || $('#sources'); if (m) m.innerHTML = '<p class="muted">The snapshot could not be loaded (' + esc(err.message) + '). The raw file is at <a href="/api/network/summary.json">/api/network/summary.json</a>.</p>';
  });
})();
