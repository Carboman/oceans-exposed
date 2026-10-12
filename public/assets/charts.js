/* oceans.exposed — charts and graphics.
   Waits for app.js to publish window.WX (event "wx:ready"), then renders the visuals for the page.
   Colors come from CSS custom properties (styles.css), so the light/dark switch needs no re-render.
   Every chart has a text twin (labels, legend, or the
   Explorer table), so tooltips enhance but never gate a value. */
(function () {
  'use strict';

  var W = null;
  var LEVEL_ORDER = ['Critical', 'High', 'Moderate', 'Low'];
  var COMP_SHORT = { harm: 'Harm', livelihoods: 'Livelihoods', scale: 'Scale', duration: 'Duration', significance: 'Significance' };

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return W.esc(s); }
  function lvlKey(l) { return String(l).toLowerCase(); }
  function lvlFill(l) { return 'var(--sev-' + lvlKey(l) + ')'; }
  function pill(r) { return '<span class="lvl lvl-' + lvlKey(r._level) + '">' + r._level + ' ' + r._score + '</span>'; }
  function active() { return W.feed.records.filter(W.isActive); }
  // Category order, then in-category rank. Findings are never ranked globally across categories.
  function byCategory(a, b) { var d = (W.CAT_BY_SLUG[a.primary_category] || { order: 99 }).order - (W.CAT_BY_SLUG[b.primary_category] || { order: 99 }).order; return d || W.cmpRank(a, b); }
  function shortName(r, n) { var s = (r.location && r.location.name) || r.id; n = n || 34; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  // Category colour: one of the four issue-layer hues (series-1..4), so 17 categories read as four families
  // rather than 17 arbitrary colours. The category strip in the seas panel adds per-category intensity.
  function catColor(slug) { var i = W.CAT_LAYER[slug]; return 'var(--series-' + ((i === undefined ? 3 : i) + 1) + ')'; }
  function seaCodeFromUrl() { return String(new URLSearchParams(location.search).get('code') || '').toUpperCase(); }

  var tipEl = null;
  function tip() {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'viz-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    return tipEl;
  }
  function place(x, y) {
    var t = tip(), pad = 14, r = t.getBoundingClientRect();
    var left = x + pad, top = y + pad;
    if (left + r.width > innerWidth - 8) left = x - r.width - pad;
    if (top + r.height > innerHeight - 8) top = y - r.height - pad;
    t.style.left = Math.max(8, left) + 'px'; t.style.top = Math.max(8, top) + 'px';
  }
  function showTip(html, ev, el) {
    var t = tip(); t.innerHTML = html; t.classList.add('on');
    if (ev && ev.clientX !== undefined) place(ev.clientX, ev.clientY);
    else if (el) { var b = el.getBoundingClientRect(); place(b.left + b.width / 2, b.top + b.height / 2); }
  }
  function hideTip() { if (tipEl) tipEl.classList.remove('on'); }
  // Wire hover + keyboard focus on any element with data-tip-i into a lookup fn.
  function bindTips(root, html) {
    root.addEventListener('mousemove', function (e) { var el = e.target.closest('[data-tip-i]'); if (el && root.contains(el)) showTip(html(el.getAttribute('data-tip-i'), el), e); else hideTip(); });
    root.addEventListener('mouseleave', hideTip);
    root.addEventListener('focusin', function (e) { var el = e.target.closest('[data-tip-i]'); if (el) showTip(html(el.getAttribute('data-tip-i'), el), null, el); });
    root.addEventListener('focusout', hideTip);
  }
  function findingTip(r) {
    var c = (r.severity || {}).components || {};
    return '<div class="tt-title">' + esc(r.location.name) + '</div><div class="tt-sub">' + esc(r.title) + '</div>' +
      '<div class="tt-row">' + pill(r) + ' <span class="muted">' + esc(r.status) + '</span></div>' +
      '<div class="tt-row muted">' + esc(W.whereLine(r)) + '</div>' +
      '<div class="tt-grid">' + W.COMPONENTS.map(function (k) { return '<span>' + COMP_SHORT[k.key] + '</span><b>' + (c[k.key] || 0) + '/2</b>'; }).join('') + '</div>';
  }

  /* ---------- overview: sea tile map tooltips ---------- */
  function seaIndex() {
    var idx = {};
    active().forEach(function (r) { W.seasOf(r).forEach(function (s) { (idx[s] = idx[s] || []).push(r); }); });
    Object.keys(idx).forEach(function (s) { idx[s].sort(W.cmpRank); });
    return idx;
  }
  function seaTip(code, list) {
    var name = W.seaName(code), basin = W.basinName((W.SEAS[code] || {}).basin);
    if (!list || !list.length) return '<div class="tt-title">' + esc(name) + '</div><div class="muted">' + esc(basin) + ' · No active finding in this feed. That does not mean there are no problems here.</div><div class="tt-hint">Click for the sea page</div>';
    return '<div class="tt-title">' + esc(name) + ' · ' + list.length + ' finding' + (list.length > 1 ? 's' : '') + '</div><div class="tt-sub">' + esc(basin) + '</div>' +
      list.slice(0, 6).map(function (r) { return '<div class="tt-row">' + pill(r) + ' ' + esc(shortName(r, 40)) + '</div>'; }).join('') +
      (list.length > 6 ? '<div class="muted">+' + (list.length - 6) + ' more</div>' : '') + '<div class="tt-hint">Click for the sea page</div>';
  }
  function bindTileMap() {
    var mount = $('#tilemap'); if (!mount || mount._bound) return;
    mount._bound = true;
    var idx = seaIndex();
    mount.querySelectorAll('.tile[href]').forEach(function (a) { a.setAttribute('data-tip-i', a.getAttribute('href').split('=').pop()); });
    bindTips(mount, function (code) { return seaTip(code, idx[code]); });
  }

  /* ---------- overview: ranked severity bars ---------- */
  function renderRanked() {
    var mount = $('#viz-ranked'); if (!mount) return;
    var rows = active().slice().sort(byCategory);
    mount.innerHTML = '<div class="hbars" role="list">' + rows.map(function (r, i) {
      return '<a class="hbar" role="listitem" href="dossier.html?id=' + encodeURIComponent(r.id) + '" data-tip-i="' + i + '">' +
        '<span class="hb-label" title="' + esc(W.catName(r.primary_category)) + '"><span class="hb-icon">' + W.catIcon(r.primary_category, 16) + '</span><span class="hb-text">' + esc(shortName(r, 60)) + '</span></span>' +
        '<span class="hb-track"><span class="hb-fill" style="width:' + (r._score * 10) + '%;background:' + lvlFill(r._level) + '"></span></span>' +
        '<span class="hb-val">' + r._score + '</span></a>';
    }).join('') + '</div>' +
      '<div class="hb-axis"><span></span><span class="ticks"><i>0</i><i>2</i><i>4</i><i>6</i><i>8</i><i>10</i></span><span></span></div>' + levelLegend();
    bindTips(mount, function (i) { return findingTip(rows[+i]); });
  }
  function levelLegend() {
    return '<div class="legend">' + LEVEL_ORDER.map(function (l) { return '<span><i style="background:' + lvlFill(l) + '"></i>' + l + ' ' + ({ Critical: '9–10', High: '7–8', Moderate: '4–6', Low: '0–3' })[l] + '</span>'; }).join('') + '</div>';
  }

  /* ---------- overview: component heatmap ---------- */
  function renderHeatmap() {
    var mount = $('#viz-heatmap'); if (!mount) return;
    var rows = active().slice().sort(byCategory);
    var head = '<div class="hm-row hm-head"><span></span>' + W.COMPONENTS.map(function (c) { return '<span title="' + esc(c.name) + '">' + COMP_SHORT[c.key] + '</span>'; }).join('') + '<span>Total</span></div>';
    mount.innerHTML = '<div class="heatmap" role="table" aria-label="Severity components by finding">' + head + rows.map(function (r, i) {
      var c = (r.severity || {}).components || {};
      return '<a class="hm-row" role="row" href="dossier.html?id=' + encodeURIComponent(r.id) + '"><span class="hm-name" role="rowheader">' + esc(shortName(r, 30)) + '</span>' +
        W.COMPONENTS.map(function (k) { var v = Number(c[k.key]) || 0; return '<span role="cell" class="hm-cell v' + v + '" data-tip-i="' + i + ':' + k.key + '">' + v + '</span>'; }).join('') +
        '<span role="cell" class="hm-total">' + r._score + '</span></a>';
    }).join('') + '</div>' +
      '<div class="legend"><span><i class="hm-sw v0"></i>0 none documented</span><span><i class="hm-sw v1"></i>1 material</span><span><i class="hm-sw v2"></i>2 severe</span></div>';
    bindTips(mount, function (key) {
      var p = key.split(':'), r = rows[+p[0]], comp = W.COMPONENTS.filter(function (c) { return c.key === p[1]; })[0];
      var v = Math.max(0, Math.min(2, Number(((r.severity || {}).components || {})[p[1]]) || 0));
      var note = r.severity && r.severity.notes && r.severity.notes[p[1]];
      return '<div class="tt-title">' + esc(shortName(r, 44)) + '</div><div class="tt-row"><b>' + esc(comp.name) + ': ' + v + '/2</b> — ' + esc(comp.rubric[v]) + '</div>' + (note ? '<div class="tt-sub">' + esc(note) + '</div>' : '');
    });
  }

  /* ---------- overview: issue layer part-to-whole ---------- */
  function renderLayers() {
    var mount = $('#viz-layers'); if (!mount) return;
    var rows = active(), n = rows.length || 1;
    var data = W.LAYERS.map(function (l, i) { return { name: l, slot: i + 1, n: rows.filter(function (r) { return r.issue_layer === l; }).length }; });
    mount.innerHTML = '<div class="stack" role="img" aria-label="' + esc(data.map(function (d) { return d.name + ' ' + d.n; }).join(', ')) + '">' +
      data.filter(function (d) { return d.n; }).map(function (d) { return '<span class="seg" data-tip-i="' + d.slot + '" tabindex="0" style="flex:' + d.n + ';background:var(--series-' + d.slot + ')"></span>'; }).join('') + '</div>' +
      '<div class="legend legend-rows">' + data.map(function (d) { return '<a href="explorer.html?layer=' + encodeURIComponent(d.name) + '"><i style="background:var(--series-' + d.slot + ')"></i>' + esc(d.name) + ' <b>' + d.n + '</b> <span class="muted">' + Math.round(d.n / n * 100) + '%</span></a>'; }).join('') + '</div>';
    bindTips(mount, function (slot) { var d = data[slot - 1]; return '<div class="tt-title">' + esc(d.name) + '</div><div>' + d.n + ' of ' + rows.length + ' active findings (' + Math.round(d.n / n * 100) + '%)</div>'; });
  }

  /* ---------- overview: economic risk + trend ---------- */
  function renderRisk() {
    var mount = $('#viz-risk'); if (!mount) return;
    var rows = active();
    var data = W.RISK_LEVELS.map(function (l) { return { name: l, n: rows.filter(function (r) { return (r.economic_risk || {}).level === l; }).length }; });
    var max = Math.max.apply(null, data.map(function (d) { return d.n; }).concat([1]));
    mount.innerHTML = '<div class="vbars">' + data.map(function (d, i) {
      return '<a class="vbar" href="explorer.html?economic_risk=' + encodeURIComponent(d.name) + '" data-tip-i="' + i + '"><span class="vb-val">' + d.n + '</span><span class="vb-col"><span class="vb-fill" style="height:' + (d.n / max * 100) + '%"></span></span><span class="vb-label">' + esc(d.name) + '</span></a>';
    }).join('') + '</div>';
    bindTips(mount, function (i) {
      var d = data[+i], list = rows.filter(function (r) { return (r.economic_risk || {}).level === d.name; });
      return '<div class="tt-title">' + esc(d.name) + ' · ' + d.n + '</div>' + list.slice(0, 8).map(function (r) { return '<div class="tt-row">' + esc(shortName(r, 40)) + '</div>'; }).join('') + (list.length > 8 ? '<div class="muted">+' + (list.length - 8) + ' more</div>' : '');
    });
  }
  var TREND_ICON = {
    'Worsening': '<path d="M4 16l6-6 4 4 6-7"/><path d="M14 7h6v6"/>',
    'Improving': '<path d="M4 8l6 6 4-4 6 7"/><path d="M14 17h6v-6"/>',
    'Stable': '<path d="M4 12h16"/><path d="M16 8l4 4-4 4"/>',
    'Volatile or Mixed': '<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>',
    'Insufficient History': '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><path d="M12 16h.01"/>'
  };
  function renderTrends() {
    var mount = $('#viz-trends'); if (!mount) return;
    var rows = active();
    mount.innerHTML = W.TRENDS.map(function (t) {
      var n = rows.filter(function (r) { return (r.trend || {}).direction === t; }).length;
      return '<a class="trend-tile t-' + t.split(' ')[0].toLowerCase() + '" href="explorer.html?trend=' + encodeURIComponent(t) + '"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TREND_ICON[t] + '</svg><span class="tv">' + n + '</span><span class="tl">' + esc(t) + '</span></a>';
    }).join('');
  }

  /* ---------- explorer: filtered level stack ---------- */
  function renderExplorerStack(rows) {
    var mount = $('#viz-filtered'); if (!mount) return;
    var data = LEVEL_ORDER.map(function (l) { return { name: l, n: rows.filter(function (r) { return r._level === l; }).length }; });
    var total = rows.length;
    mount.innerHTML = '<div class="xstack-head"><b>' + total + '</b> finding' + (total === 1 ? '' : 's') + ' in view</div>' +
      (total ? '<div class="stack" role="img" aria-label="' + esc(data.map(function (d) { return d.name + ' ' + d.n; }).join(', ')) + '">' + data.filter(function (d) { return d.n; }).map(function (d) {
        return '<span class="seg" tabindex="0" data-tip-i="' + d.name + '" style="flex:' + d.n + ';background:' + lvlFill(d.name) + '"></span>';
      }).join('') + '</div>' : '<div class="stack empty"></div>') +
      '<div class="legend">' + data.map(function (d) { return '<span><i style="background:' + lvlFill(d.name) + '"></i>' + d.name + ' <b>' + d.n + '</b></span>'; }).join('') + '</div>';
    if (!mount._bound) { mount._bound = true; bindTips(mount, function (l) { var d = data.filter(function (x) { return x.name === l; })[0] || { n: 0 }; return '<div class="tt-title">' + l + '</div><div>' + d.n + ' of ' + total + ' findings in view</div>'; }); }
  }

  /* ---------- dossier: score meter, rank strip, evidence timeline ---------- */
  function currentRecord() {
    var id = new URLSearchParams(location.search).get('id');
    return W.feed.records.filter(function (r) { return r.id === id; })[0];
  }
  function renderDossier() {
    var r = currentRecord(); if (!r) return;
    var s = $('#viz-score');
    if (s) {
      s.innerHTML = '<div class="viz-label">Severity score</div><div class="hero-num">' + r._score + '<span>/10</span></div>' +
        '<div class="meter" role="img" aria-label="' + r._score + ' out of 10, ' + r._level + '">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) { return '<span' + (i <= r._score ? ' style="background:' + lvlFill(r._level) + '"' : '') + '></span>'; }).join('') + '</div>' +
        '<div class="meter-scale"><span>Low</span><span>Moderate</span><span>High</span><span>Critical</span></div>';
    }
    var k = $('#viz-rank');
    if (k) {
      var all = active().slice().sort(W.cmpRank), isActive = all.indexOf(r) >= 0;
      var buckets = {};
      all.forEach(function (x) { (buckets[x._score] = buckets[x._score] || []).push(x); });
      var dots = '';
      Object.keys(buckets).forEach(function (sc) {
        buckets[sc].forEach(function (x, j) {
          var me = x === r, left = (sc / 10 * 100);
          dots += '<span class="rs-dot' + (me ? ' me' : '') + '" data-tip-i="' + all.indexOf(x) + '" tabindex="0" style="left:' + left + '%;bottom:' + (6 + j * 14) + 'px;' + (me ? 'background:' + lvlFill(x._level) : '') + '"></span>';
        });
      });
      var maxStack = Math.max.apply(null, Object.keys(buckets).map(function (b) { return buckets[b].length; }).concat([1]));
      k.innerHTML = '<div class="viz-label">' + (isActive ? 'This score among all ' + all.length + ' active findings (categories are ranked separately)' : 'Not an active finding') + '</div>' +
        '<div class="rank-strip" style="height:' + (24 + maxStack * 14) + 'px">' + dots + '<span class="rs-axis"></span></div>' +
        '<div class="rs-ticks"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span></div><div class="legend"><span><i class="rs-key me" style="background:' + lvlFill(r._level) + '"></i>This finding</span><span><i class="rs-key"></i>Other findings</span></div>';
      bindTips(k, function (i) { return findingTip(all[+i]); });
    }
    renderTimeline(r);
  }
  function renderTimeline(r) {
    var mount = $('#viz-timeline'); if (!mount) return;
    var events = (r.sources || []).filter(function (s) { return s.date; }).map(function (s) { return { d: s.date, kind: 'source', label: (s.ref ? '[' + s.ref + '] ' : '') + (s.title || 'Source'), sub: s.publisher || '' }; });
    if (r.first_seen) events.push({ d: r.first_seen, kind: 'seen', label: 'First seen', sub: '' });
    var run = (W.feed.run || {}).run_date; if (run) events.push({ d: run, kind: 'run', label: 'Run date', sub: 'Tracker run' });
    events.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    if (!events.length) { mount.innerHTML = '<p class="muted">No dated evidence.</p>'; return; }
    var t = function (d) { return new Date(d + 'T00:00:00Z').getTime(); };
    var t0 = t(events[0].d), t1 = t(events[events.length - 1].d);
    var pad = Math.max((t1 - t0) * 0.06, 864e5); t0 -= pad; t1 += pad;
    var x = function (d) { return 3 + (t(d) - t0) / (t1 - t0) * 94; };
    var years = []; for (var y = new Date(t0).getUTCFullYear(); y <= new Date(t1).getUTCFullYear(); y++) { var ty = Date.UTC(y, 0, 1); if (ty >= t0 && ty <= t1) years.push(y); }
    var ticks = years.length ? years.map(function (y) { return '<span class="tl-year" style="left:' + x(y + '-01-01') + '%">' + y + '</span>'; }).join('')
      : '<span class="tl-year" style="left:' + x(events[0].d) + '%">' + esc(events[0].d) + '</span>' + (events[events.length - 1].d !== events[0].d ? '<span class="tl-year" style="left:' + x(events[events.length - 1].d) + '%">' + esc(events[events.length - 1].d) + '</span>' : '');
    mount.innerHTML = '<div class="timeline-viz">' + '<span class="tl-axis"></span>' + ticks +
      events.map(function (e, i) { return '<span class="tl-ev ' + e.kind + '" tabindex="0" data-tip-i="' + i + '" style="left:' + x(e.d) + '%"></span>'; }).join('') + '</div>' +
      '<div class="legend"><span><i class="tl-key source"></i>Source document</span><span><i class="tl-key seen"></i>First seen</span><span><i class="tl-key run"></i>Run date</span></div>' +
      '<ol class="tl-list">' + events.map(function (e) { return '<li><span class="mono small">' + esc(e.d) + '</span> ' + esc(e.label) + (e.sub ? ' <span class="muted small">· ' + esc(e.sub) + '</span>' : '') + '</li>'; }).join('') + '</ol>';
    bindTips(mount, function (i) { var e = events[+i]; return '<div class="tt-title">' + esc(e.label) + '</div><div class="muted">' + esc(e.d) + (e.sub ? ' · ' + esc(e.sub) : '') + '</div>'; });
  }

  /* ---------- updates: coverage by category ---------- */
  function renderCoverage() {
    var mount = $('#viz-coverage'); if (!mount) return;
    var counts = W.CATEGORIES.map(function (c) { return { c: c, n: W.feed.records.filter(function (r) { return r.primary_category === c.slug; }).length }; });
    var max = Math.max.apply(null, counts.map(function (d) { return d.n; }).concat([1]));
    mount.innerHTML = '<div class="hbars">' + counts.map(function (d) {
      return '<a class="hbar" href="explorer.html?category=' + d.c.slug + '"><span class="hb-label"><span class="hb-icon">' + W.catIcon(d.c.slug, 16) + '</span><span class="hb-text">' + esc(d.c.name) + '</span></span>' +
        '<span class="hb-track">' + (d.n ? '<span class="hb-fill" style="width:' + (d.n / max * 100) + '%;background:' + catColor(d.c.slug) + '"></span>' : '<span class="hb-none">No qualifying finding located</span>') + '</span><span class="hb-val">' + d.n + '</span></a>';
    }).join('') + '</div>' +
      '<div class="legend">' + W.LAYERS.map(function (l, i) { return '<span><i style="background:var(--series-' + (i + 1) + ')"></i>' + esc(l) + '</span>'; }).join('') + '<span class="muted">Bars are coloured by the layer each category usually belongs to.</span></div>';
  }

  /* ---------- side panels: pinned header offsets + scrolling the panel itself ---------- */
  // Group headings pin just below the panel's sticky header and controls, whose height varies with wrapping.
  function pinOffsets(panel) {
    if (!panel) return;
    var sum = panel.querySelector('.ip-summary'), ctl = panel.querySelector('.ip-controls');
    var hs = sum ? sum.offsetHeight : 0, hc = ctl ? ctl.offsetHeight : 0;
    panel.style.setProperty('--ip-sum', hs + 'px');
    panel.style.setProperty('--ip-head', (hs + hc) + 'px');
  }
  function scrollPanelTo(panel, el) {
    if (!panel || !el || panel.scrollHeight <= panel.clientHeight) return;
    var top = el.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
    var head = parseFloat(getComputedStyle(panel).getPropertyValue('--ip-head')) || 0;
    panel.scrollTop = Math.max(0, top - head - 40);
  }
  window.addEventListener('resize', function () { document.querySelectorAll('.issue-panel').forEach(pinOffsets); });

  /* ---------- right panel: serial issue list ---------- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var panelState = { sort: 'date', hide: {} };
  function loadPanelState() {
    try { var v = JSON.parse(localStorage.getItem('oe-panel') || '{}'); if (v.sort) panelState.sort = v.sort; if (v.hide) panelState.hide = v.hide; } catch (e) {}
  }
  function savePanelState() { try { localStorage.setItem('oe-panel', JSON.stringify(panelState)); } catch (e) {} }
  // Source dates may be year, month or day precision: "2024", "2026-07", "2026-07-15".
  function fmtDay(d) {
    if (!d) return 'Undated';
    var p = String(d).split('-'), m = MONTHS[+p[1] - 1];
    if (!m) return p[0];
    return p[2] ? m.slice(0, 3) + ' ' + (+p[2]) + ', ' + p[0] : m.slice(0, 3) + ' ' + p[0];
  }
  function monthKey(d) { return d ? (String(d).length >= 7 ? String(d).slice(0, 7) : String(d).slice(0, 4) + '-00') : '0000-00'; }
  function monthLabel(k) { if (k === '0000-00') return 'Undated'; var p = k.split('-'); return p[1] === '00' ? p[0] : MONTHS[+p[1] - 1] + ' ' + p[0]; }

  function renderPanel() {
    var panel = $('#issue-panel'); if (!panel) return;
    var list = $('#ip-list'), chips = $('#ip-chips');
    // On a sea page the panel lists only that sea's issues.
    var seaCode = W.page === 'sea' ? seaCodeFromUrl() : null;
    var all = W.feed.records.filter(function (r) { return !seaCode || W.seasOf(r).indexOf(seaCode) >= 0; });
    var currentId = W.page === 'dossier' ? new URLSearchParams(location.search).get('id') : null;
    if (seaCode && W.SEAS[seaCode]) { var t = panel.querySelector('.ip-title'); if (t) t.textContent = 'Issues in the ' + W.seaName(seaCode).replace(/ \(.*\)$/, ''); }
    var byDate = function (a, b) { var x = W.latestSourceDate(a), y = W.latestSourceDate(b); return x < y ? 1 : x > y ? -1 : b._score - a._score; };

    $('#ip-count').textContent = all.length;
    chips.innerHTML = LEVEL_ORDER.map(function (l) {
      var n = all.filter(function (r) { return r._level === l; }).length;
      var on = !panelState.hide[l];
      return '<button type="button" class="ip-chip" data-level="' + l + '" aria-pressed="' + on + '"' + (n ? '' : ' disabled') + '><i style="background:' + lvlFill(l) + '"></i>' + l + ' <b>' + n + '</b></button>';
    }).join('');
    panel.querySelectorAll('.ip-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-sort') === panelState.sort)); });

    var shown = all.filter(function (r) { return !panelState.hide[r._level]; });
    var groups = [];
    if (panelState.sort === 'severity') {
      LEVEL_ORDER.forEach(function (l) {
        var g = shown.filter(function (r) { return r._level === l; }).sort(byDate);
        if (g.length) groups.push({ label: l + ' · ' + ({ Critical: '9–10', High: '7–8', Moderate: '4–6', Low: '0–3' })[l], level: l, items: g });
      });
    } else {
      var byMonth = {};
      shown.slice().sort(byDate).forEach(function (r) { var k = monthKey(W.latestSourceDate(r)); (byMonth[k] = byMonth[k] || []).push(r); });
      Object.keys(byMonth).sort().reverse().forEach(function (k) { groups.push({ label: monthLabel(k), items: byMonth[k] }); });
    }

    var n = 0;
    list.innerHTML = groups.length ? groups.map(function (g) {
      return '<li class="ip-group"><div class="ip-group-head">' + (g.level ? '<i style="background:' + lvlFill(g.level) + '"></i>' : '') + esc(g.label) + ' <span>' + g.items.length + '</span></div><ol>' +
        g.items.map(function (r) {
          n++;
          var cur = r.id === currentId;
          return '<li><a class="ip-item" href="dossier.html?id=' + encodeURIComponent(r.id) + '"' + (cur ? ' aria-current="page"' : '') + ' style="--lvl:' + lvlFill(r._level) + '">' +
            '<span class="ip-top">' + (panelState.sort === 'date' ? '<span class="ip-n mono">' + String(n).padStart(2, '0') + '</span>' : '') + '<span class="ip-date mono">' + esc(fmtDay(W.latestSourceDate(r))) + '</span>' + pill(r) + '</span>' +
            '<span class="ip-name">' + esc(r.location.name) + '</span>' +
            '<span class="ip-sub">' + esc(r.title) + '</span>' +
            '<span class="ip-meta"><span class="ip-ico">' + W.catIcon(r.primary_category, 14) + '</span>' + esc(W.catName(r.primary_category)) + ' · ' + esc(W.seasOf(r).join(', ') || W.basinName(W.basinOf(r)) || 'no sea given') + (W.isActive(r) ? '' : ' · Resolved') + '</span></a></li>';
        }).join('') + '</ol></li>';
    }).join('') : '<li class="ip-empty muted">No issues match. Turn a severity level back on.</li>';

    var cur = list.querySelector('[aria-current="page"]');
    pinOffsets(panel);
    if (cur && !panel._scrolled) { panel._scrolled = true; scrollPanelTo(panel, cur); }  // scroll only the panel, never the page
  }
  function initPanel() {
    var panel = $('#issue-panel'); if (!panel) return;
    loadPanelState();
    var det = panel.querySelector('details');
    var narrow = matchMedia('(max-width: 1099px)');
    if (det && narrow.matches) det.open = false;
    // On wide screens the panel is a fixed column, so its header does not collapse it.
    var sum = panel.querySelector('summary');
    if (sum) sum.addEventListener('click', function (e) { if (!narrow.matches) e.preventDefault(); });
    panel.addEventListener('click', function (e) {
      var s = e.target.closest('.ip-seg button');
      if (s) { panelState.sort = s.getAttribute('data-sort'); savePanelState(); renderPanel(); return; }
      var c = e.target.closest('.ip-chip');
      if (c && !c.disabled) { var l = c.getAttribute('data-level'); panelState.hide[l] = !panelState.hide[l]; savePanelState(); renderPanel(); }
    });
    renderPanel();
  }

  /* ---------- seas panel: every regional sea with mini graphs (left panel on the overview) ---------- */
  var LEVELS4 = ['Critical', 'High', 'Moderate', 'Low'];
  var panelSort = 'issues';
  try { panelSort = localStorage.getItem('oe-sea-sort') || 'issues'; } catch (e) {}

  function seaRows() {
    var done = ((W.feed.coverage || {}).regions_researched || []);
    return W.SEA_CODES.map(function (c) {
      var act = W.feed.records.filter(function (r) { return W.isActive(r) && W.seasOf(r).indexOf(c) >= 0; });
      var lv = {}; LEVELS4.forEach(function (l) { lv[l] = act.filter(function (r) { return r._level === l; }).length; });
      var cats = {}; act.forEach(function (r) { cats[r.primary_category] = (cats[r.primary_category] || 0) + 1; });
      return { code: c, name: W.seaName(c), basin: W.SEAS[c].basin, n: act.length, lv: lv, cats: cats, max: act.reduce(function (m, r) { return Math.max(m, r._score); }, -1), researched: done.indexOf(c) >= 0 };
    });
  }

  function renderSeasPanel(code) {
    var list = $('#sp-list'); if (!list) return;
    var rows = seaRows();
    var maxN = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
    var maxCat = Math.max.apply(null, rows.map(function (r) { return Math.max.apply(null, Object.keys(r.cats).map(function (k) { return r.cats[k]; }).concat([0])); }).concat([1]));
    var basinOrder = ['PAC', 'ATL', 'IND', 'SOU', 'ARC'];
    rows.sort(function (a, b) {
      if (!a.n !== !b.n) return a.n ? -1 : 1;                       // seas with issues first
      if (panelSort === 'severity') return b.max - a.max || b.n - a.n || (a.name < b.name ? -1 : 1);
      if (panelSort === 'az') return a.name < b.name ? -1 : 1;
      if (panelSort === 'basin') return basinOrder.indexOf(a.basin) - basinOrder.indexOf(b.basin) || b.n - a.n || (a.name < b.name ? -1 : 1);
      return b.n - a.n || b.max - a.max || (a.name < b.name ? -1 : 1);
    });
    $('#sp-count').textContent = rows.filter(function (r) { return r.n; }).length + ' of ' + rows.length + ' with issues';
    document.querySelectorAll('#sea-panel .ip-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-sort') === panelSort)); });
    list.innerHTML = rows.map(function (r) {
      var bar = r.n ? '<span class="sp-bar" style="width:' + Math.max(6, r.n / maxN * 100).toFixed(1) + '%" role="img" aria-label="' + esc(LEVELS4.map(function (l) { return r.lv[l] + ' ' + l; }).join(', ')) + '">' +
        LEVELS4.filter(function (l) { return r.lv[l]; }).map(function (l) { return '<i style="flex:' + r.lv[l] + ';background:' + lvlFill(l) + '"></i>'; }).join('') + '</span>' : '<span class="sp-none">No active issues</span>';
      var strip = '<span class="sp-cats" role="img" aria-label="Issues by category">' + W.CATEGORIES.map(function (c) {
        var k = r.cats[c.slug] || 0;
        return '<i title="' + esc(c.name + ': ' + k) + '" style="background:' + catColor(c.slug) + ';opacity:' + (k ? (0.35 + 0.65 * k / maxCat).toFixed(2) : 0.08) + '"></i>';
      }).join('') + '</span>';
      return '<li><a class="sp-row' + (r.n ? '' : ' empty') + '" href="sea.html?code=' + r.code + '"' + (r.code === code ? ' aria-current="page"' : '') + ' data-basin="' + r.basin + '" title="' + esc(r.name + ' · ' + W.basinName(r.basin) + (r.researched ? ' · researched in depth' : '')) + '">' +
        '<span class="sp-top"><span class="sp-name">' + esc(r.name.replace(/ \(.*\)$/, '')) + '</span><span class="sp-code">' + r.code + '</span>' +
        (r.n ? '<span class="sp-n">' + r.n + '</span>' : '') + '</span>' +
        '<span class="sp-graph">' + bar + '</span>' + (r.n ? strip : '') + '</a></li>';
    }).join('');
    var panelEl = $('#sea-panel'); pinOffsets(panelEl);
    var cur = list.querySelector('[aria-current="page"]');
    if (cur && !list._scrolled) { list._scrolled = true; scrollPanelTo(panelEl, cur); }
  }

  function initSeasPanel(code) {
    var panel = $('#sea-panel'); if (!panel) return;
    var det = panel.querySelector('details'), narrow = matchMedia('(max-width: 1279px)');
    if (det && narrow.matches) det.open = false;
    panel.querySelector('summary').addEventListener('click', function (e) { if (!narrow.matches) e.preventDefault(); });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('.ip-seg button'); if (!b) return;
      panelSort = b.getAttribute('data-sort');
      try { localStorage.setItem('oe-sea-sort', panelSort); } catch (err) {}
      renderSeasPanel(code);
    });
    $('#sp-legend').innerHTML = '<span><i style="background:var(--sev-critical)"></i>Critical</span><span><i style="background:var(--sev-high)"></i>High</span><span><i style="background:var(--sev-moderate)"></i>Moderate</span><span><i style="background:var(--sev-low)"></i>Low</span>' +
      '<span class="sp-leg-cats">' + W.CATEGORIES.map(function (c) { return '<i title="' + esc(c.name) + '" style="background:' + catColor(c.slug) + '"></i>'; }).join('') + '</span><span>' + W.CATEGORIES.length + ' categories, darker = more issues</span>';
    renderSeasPanel(code);
  }

  /* ---------- boot ---------- */
  function renderAll() {
    if (!W) return;
    initPanel();
    if ($('#sea-panel')) initSeasPanel(W.page === 'sea' ? seaCodeFromUrl() : null);
    if (W.page === 'overview') { bindTileMap(); renderRanked(); renderHeatmap(); renderLayers(); renderRisk(); renderTrends(); }
    if (W.page === 'dossier') renderDossier();
    if (W.page === 'updates') renderCoverage();
  }
  document.addEventListener('wx:ready', function (e) { W = e.detail; renderAll(); });
  document.addEventListener('wx:rows', function (e) { if (W || window.WX) { W = W || window.WX; renderExplorerStack(e.detail); } else { var rows = e.detail; document.addEventListener('wx:ready', function () { renderExplorerStack(rows); }, { once: true }); } });
  if (window.WX) { W = window.WX; renderAll(); }
})();
