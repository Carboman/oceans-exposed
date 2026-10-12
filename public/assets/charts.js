/* oceans.exposed — charts and graphics.
   Waits for app.js to publish window.WX (event "wx:ready"), then renders the visuals for the page.
   Colours come from CSS custom properties (styles.css), so the light/dark switch needs no re-render.
   Every chart has a text twin (direct labels, a legend, a visually hidden table or the Explorer table), so
   tooltips enhance but never gate a value. Charts aggregate, so they stay readable with thousands of records. */
(function () {
  'use strict';

  var W = null;
  var LEVEL_ORDER = ['Critical', 'High', 'Moderate', 'Low'];
  var LEVEL_RANGE = { Critical: '9–10', High: '7–8', Moderate: '4–6', Low: '0–3' };
  var COMP_SHORT = { harm: 'Harm', livelihoods: 'Livelihoods', scale: 'Scale', duration: 'Duration', significance: 'Significance' };
  var BASIN_ORDER = ['PAC', 'ATL', 'IND', 'SOU', 'ARC', 'GLOBAL'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return W.esc(s); }
  function lvlKey(l) { return String(l).toLowerCase(); }
  function lvlFill(l) { return 'var(--sev-' + lvlKey(l) + ')'; }
  function pill(r) { return '<span class="lvl lvl-' + lvlKey(r._level) + '">' + r._level + ' ' + r._score + '</span>'; }
  function active() { return W.feed.records.filter(W.isActive); }
  function shortName(r, n) { var s = (r.location && r.location.name) || r.id; n = n || 34; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  // Category colour: one of the four issue-layer hues (series-1..4), so 17 categories read as four families.
  function catColor(slug) { var i = W.CAT_LAYER[slug]; return 'var(--series-' + ((i === undefined ? 3 : i) + 1) + ')'; }
  function seaCodeFromUrl() { return String(new URLSearchParams(location.search).get('code') || '').toUpperCase(); }
  function plural(n, s) { return n + ' ' + s + (n === 1 ? '' : 's'); }
  function runDate() { return (W.feed.run || {}).run_date || new Date().toISOString().slice(0, 10); }
  // Visually hidden table twin for a chart: rows = [[cell, ...], ...].
  function srTable(caption, head, rows) {
    return '<div class="sr-only"><table><caption>' + esc(caption) + '</caption><thead><tr>' + head.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return (i ? '<td>' : '<th scope="row">') + esc(c) + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function levelLegend(extra) {
    return '<div class="legend">' + LEVEL_ORDER.map(function (l) { return '<span><i style="background:' + lvlFill(l) + '"></i>' + l + ' ' + LEVEL_RANGE[l] + '</span>'; }).join('') + (extra || '') + '</div>';
  }

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

  /* ---------- overview: sea tile map tooltips (the "Grid" view) ---------- */
  function seaIndex() {
    var idx = {};
    active().forEach(function (r) { W.seasOf(r).forEach(function (s) { (idx[s] = idx[s] || []).push(r); }); });
    Object.keys(idx).forEach(function (s) { idx[s].sort(W.cmpRank); });
    return idx;
  }
  function seaTip(code, list) {
    var name = W.seaName(code), basin = W.basinName((W.SEAS[code] || {}).basin);
    if (!list || !list.length) return '<div class="tt-title">' + esc(name) + '</div><div class="muted">' + esc(basin) + ' · No active finding in this feed. That does not mean there are no problems here.</div><div class="tt-hint">Click for the sea page</div>';
    return '<div class="tt-title">' + esc(name) + ' · ' + plural(list.length, 'finding') + '</div><div class="tt-sub">' + esc(basin) + '</div>' +
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

  /* ---------- findings by category: horizontal stacked bars (levels), sorted, with the category icon ----------
     Used on the overview (#viz-cats) and on Changes & Coverage (#viz-coverage, all records). */
  function renderCatBars(mount, rows, opts) {
    if (!mount) return;
    opts = opts || {};
    var data = W.CATEGORIES.map(function (c) {
      var list = rows.filter(function (r) { return r.primary_category === c.slug; });
      var lv = {}; LEVEL_ORDER.forEach(function (l) { lv[l] = list.filter(function (r) { return r._level === l; }).length; });
      return { c: c, n: list.length, lv: lv };
    }).sort(function (a, b) { return b.n - a.n || a.c.order - b.c.order; });
    var max = Math.max.apply(null, data.map(function (d) { return d.n; }).concat([1]));
    var withN = data.filter(function (d) { return d.n; }), without = data.filter(function (d) { return !d.n; });
    mount.innerHTML = '<div class="hbars" role="list">' + withN.map(function (d) {
      return '<a class="hbar" role="listitem" href="' + (opts.href ? opts.href + '&' : 'explorer.html?') + 'category=' + d.c.slug + '" aria-label="' + esc(d.c.name + ': ' + plural(d.n, 'finding') + ', ' + LEVEL_ORDER.map(function (l) { return d.lv[l] + ' ' + l; }).join(', ')) + '">' +
        '<span class="hb-label"><span class="hb-icon">' + W.catIcon(d.c.slug, 16) + '</span><span class="hb-text">' + esc(d.c.name) + '</span></span>' +
        '<span class="hb-track"><span class="hb-stack" style="width:' + (d.n / max * 100).toFixed(2) + '%">' + LEVEL_ORDER.filter(function (l) { return d.lv[l]; }).map(function (l) {
          return '<span class="hb-seg" data-tip-i="' + d.c.slug + ':' + l + '" style="flex:' + d.lv[l] + ';background:' + lvlFill(l) + '"></span>';
        }).join('') + '</span></span><span class="hb-val">' + d.n + '</span></a>';
    }).join('') + '</div>' +
      (without.length && !opts.hideEmpty ? '<p class="hb-rest small muted">No qualifying finding located: ' + without.map(function (d) { return esc(d.c.name); }).join(' · ') + '</p>' : '') +
      levelLegend() + srTable(opts.caption || 'Findings by category and severity level', ['Category', 'Findings'].concat(LEVEL_ORDER), data.map(function (d) { return [d.c.name, d.n].concat(LEVEL_ORDER.map(function (l) { return d.lv[l]; })); }));
    bindTips(mount, function (key) {
      var p = key.split(':'), d = data.filter(function (x) { return x.c.slug === p[0]; })[0];
      return '<div class="tt-title">' + esc(d.c.name) + '</div><div class="tt-row"><b>' + d.lv[p[1]] + '</b> ' + p[1] + ' of ' + plural(d.n, 'finding') + '</div><div class="tt-grid">' + LEVEL_ORDER.map(function (l) { return '<span>' + l + '</span><b>' + d.lv[l] + '</b>'; }).join('') + '</div>';
    });
  }

  /* ---------- severity distribution: 0-10 histogram, columns coloured by level ---------- */
  function renderHist(mount, rows, opts) {
    if (!mount) return;
    opts = opts || {};
    var counts = []; for (var s = 0; s <= 10; s++) counts.push(rows.filter(function (r) { return r._score === s; }).length);
    var max = Math.max.apply(null, counts.concat([1]));
    mount.innerHTML = '<div class="hist" role="img" aria-label="' + esc('Findings by score: ' + counts.map(function (n, i) { return i + ': ' + n; }).join(', ')) + '">' + counts.map(function (n, i) {
      var l = W.levelOf(i);
      return '<a class="hist-col" href="' + (opts.href ? opts.href + '&' : 'explorer.html?') + 'min_score=' + i + '" data-tip-i="' + i + '"><span class="hist-val">' + (n || '') + '</span><span class="hist-track"><span class="hist-fill" style="height:' + (n / max * 100).toFixed(1) + '%;background:' + lvlFill(l) + '"></span></span><span class="hist-x">' + i + '</span></a>';
    }).join('') + '</div><div class="hist-bands"><span style="flex:4"><i style="background:' + lvlFill('Low') + '"></i>Low</span><span style="flex:3"><i style="background:' + lvlFill('Moderate') + '"></i>Moderate</span><span style="flex:2"><i style="background:' + lvlFill('High') + '"></i>High</span><span style="flex:2"><i style="background:' + lvlFill('Critical') + '"></i>Critical</span></div>';
    bindTips(mount, function (i) { var n = counts[+i]; return '<div class="tt-title">Score ' + i + ' · ' + W.levelOf(+i) + '</div><div>' + plural(n, 'active finding') + (rows.length ? ' (' + Math.round(n / rows.length * 100) + '%)' : '') + '</div>'; });
  }

  /* ---------- basins: dot plot of counts per basin ---------- */
  function renderBasins() {
    var mount = $('#viz-basins'); if (!mount) return;
    var rows = active();
    var data = BASIN_ORDER.map(function (b) {
      var list = rows.filter(function (r) { return (W.basinOf(r) || 'GLOBAL') === b; });
      var lv = {}; LEVEL_ORDER.forEach(function (l) { lv[l] = list.filter(function (r) { return r._level === l; }).length; });
      return { b: b, name: W.basinName(b), n: list.length, lv: lv, seas: Object.keys(W.SEAS).filter(function (c) { return W.SEAS[c].basin === b; }).length };
    });
    var max = Math.max.apply(null, data.map(function (d) { return d.n; }).concat([1]));
    mount.innerHTML = '<div class="dotplot" role="list">' + data.map(function (d, i) {
      return '<a class="dp-row" role="listitem" href="explorer.html?basin=' + d.b + '" data-tip-i="' + i + '" aria-label="' + esc(d.name + ': ' + plural(d.n, 'active finding')) + '"><span class="dp-label"><i class="basin-chip" data-basin="' + d.b + '"></i>' + esc(d.name.replace(/ Ocean$/, '')) + '</span>' +
        '<span class="dp-track"><span class="dp-line" style="width:' + (d.n / max * 100).toFixed(2) + '%"></span><span class="dp-dot" style="left:' + (d.n / max * 100).toFixed(2) + '%"></span></span><span class="dp-val">' + d.n + '</span></a>';
    }).join('') + '</div><div class="dp-axis"><span></span><span class="ticks"><i>0</i><i>' + Math.round(max / 2) + '</i><i>' + max + '</i></span><span></span></div>' +
      srTable('Active findings by ocean basin', ['Basin', 'Findings'].concat(LEVEL_ORDER), data.map(function (d) { return [d.name, d.n].concat(LEVEL_ORDER.map(function (l) { return d.lv[l]; })); }));
    bindTips(mount, function (i) { var d = data[+i]; return '<div class="tt-title">' + esc(d.name) + '</div><div class="tt-row"><b>' + d.n + '</b> active finding' + (d.n === 1 ? '' : 's') + (d.seas ? ' across ' + plural(d.seas, 'regional sea') : ' (no regional sea)') + '</div><div class="tt-grid">' + LEVEL_ORDER.map(function (l) { return '<span>' + l + '</span><b>' + d.lv[l] + '</b>'; }).join('') + '</div>'; });
  }

  /* ---------- new findings per month: bar sparkline of first_seen over the last 24 months ---------- */
  function monthsBack(n, from) {
    var out = [], d = new Date(from + 'T00:00:00Z');
    for (var i = n - 1; i >= 0; i--) { var m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); out.push(m.toISOString().slice(0, 7)); }
    return out;
  }
  function renderMonths(mount, rows, field) {
    if (!mount) return;
    var keys = monthsBack(24, runDate()), counts = {};
    keys.forEach(function (k) { counts[k] = 0; });
    var older = 0;
    rows.forEach(function (r) { var k = String(r[field || 'first_seen'] || '').slice(0, 7); if (counts[k] !== undefined) counts[k]++; else if (k) older++; });
    var max = Math.max.apply(null, keys.map(function (k) { return counts[k]; }).concat([1]));
    var lbl = function (k) { var p = k.split('-'); return MONTHS[+p[1] - 1].slice(0, 3) + ' ' + p[0].slice(2); };
    mount.innerHTML = '<div class="spark-bars" role="img" aria-label="' + esc('New findings per month: ' + keys.map(function (k) { return lbl(k) + ' ' + counts[k]; }).join(', ')) + '">' + keys.map(function (k, i) {
      return '<a class="sb-col" href="explorer.html?q=' + k + '" data-tip-i="' + i + '"><span class="sb-fill" style="height:' + (counts[k] / max * 100).toFixed(1) + '%"></span></a>';
    }).join('') + '</div><div class="sb-axis"><span>' + lbl(keys[0]) + '</span><span>' + lbl(keys[12]) + '</span><span>' + lbl(keys[23]) + '</span></div>' +
      '<p class="small muted sb-note">Peak month: <b>' + max + '</b>' + (older ? ' · ' + older + ' first seen before this window' : '') + '</p>' +
      srTable('New findings per month', ['Month', 'Findings first seen'], keys.map(function (k) { return [lbl(k), counts[k]]; }));
    bindTips(mount, function (i) { var k = keys[+i]; return '<div class="tt-title">' + lbl(k) + '</div><div>' + plural(counts[k], 'finding') + ' first seen</div>'; });
  }

  /* ---------- overview: component heatmap by category (mean of each 0-2 component) ---------- */
  function renderHeatmap() {
    var mount = $('#viz-heatmap'); if (!mount) return;
    var rows = active();
    var data = W.CATEGORIES.map(function (c) {
      var list = rows.filter(function (r) { return r.primary_category === c.slug; }); if (!list.length) return null;
      var mean = {}; W.COMPONENTS.forEach(function (k) { mean[k.key] = list.reduce(function (s, r) { return s + (Number(((r.severity || {}).components || {})[k.key]) || 0); }, 0) / list.length; });
      return { c: c, n: list.length, mean: mean, score: list.reduce(function (s, r) { return s + r._score; }, 0) / list.length };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
    if (!data.length) { mount.innerHTML = '<p class="muted">No active findings.</p>'; return; }
    var bin = function (v) { return Math.min(4, Math.round(v / 2 * 4)); };
    var head = '<div class="hm-row hm-head"><span></span>' + W.COMPONENTS.map(function (c) { return '<span title="' + esc(c.name) + '">' + COMP_SHORT[c.key] + '</span>'; }).join('') + '<span>Mean</span><span>n</span></div>';
    mount.innerHTML = '<div class="heatmap" role="table" aria-label="Average severity component by category">' + head + data.map(function (d, i) {
      return '<a class="hm-row" role="row" href="explorer.html?category=' + d.c.slug + '"><span class="hm-name" role="rowheader"><span class="hm-ico">' + W.catIcon(d.c.slug, 14) + '</span>' + esc(d.c.name) + '</span>' +
        W.COMPONENTS.map(function (k) { var v = d.mean[k.key]; return '<span role="cell" class="hm-cell h' + bin(v) + '" data-tip-i="' + i + ':' + k.key + '">' + v.toFixed(1) + '</span>'; }).join('') +
        '<span role="cell" class="hm-total">' + d.score.toFixed(1) + '</span><span role="cell" class="hm-n">' + d.n + '</span></a>';
    }).join('') + '</div>' +
      '<div class="legend"><span class="hm-ramp"><i class="hm-sw h0"></i><i class="hm-sw h1"></i><i class="hm-sw h2"></i><i class="hm-sw h3"></i><i class="hm-sw h4"></i></span><span>0 = none documented → 2 = severe, averaged over the category</span></div>';
    bindTips(mount, function (key) {
      var p = key.split(':'), d = data[+p[0]], comp = W.COMPONENTS.filter(function (c) { return c.key === p[1]; })[0], v = d.mean[p[1]];
      return '<div class="tt-title">' + esc(d.c.name) + '</div><div class="tt-row"><b>' + esc(comp.name) + ': ' + v.toFixed(2) + ' / 2</b> averaged over ' + plural(d.n, 'finding') + '</div><div class="tt-sub">2 = ' + esc(comp.rubric[2]) + '</div>';
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

  /* ---------- dossier: score meter, rank strip, source timeline ---------- */
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
      var all = active().slice().sort(W.cmpRank), isAct = all.indexOf(r) >= 0;
      var counts = []; for (var sc = 0; sc <= 10; sc++) counts.push(all.filter(function (x) { return x._score === sc; }).length);
      var max = Math.max.apply(null, counts.concat([1]));
      k.innerHTML = '<div class="viz-label">' + (isAct ? 'Where this score sits among all ' + all.length + ' active findings (categories are ranked separately)' : 'Not an active finding') + '</div>' +
        '<div class="hist hist-mini" role="img" aria-label="' + esc('Findings by score: ' + counts.map(function (n, i) { return i + ': ' + n; }).join(', ')) + '">' + counts.map(function (n, i) {
          return '<span class="hist-col' + (i === r._score ? ' me' : '') + '" data-tip-i="' + i + '" tabindex="0"><span class="hist-track"><span class="hist-fill" style="height:' + (n / max * 100).toFixed(1) + '%;' + (i === r._score ? 'background:' + lvlFill(r._level) : '') + '"></span></span><span class="hist-x">' + i + '</span></span>';
        }).join('') + '</div><div class="legend"><span><i style="background:' + lvlFill(r._level) + '"></i>This finding\'s score (' + counts[r._score] + ' at ' + r._score + ')</span><span><i class="rs-key"></i>Other scores</span></div>';
      bindTips(k, function (i) { return '<div class="tt-title">Score ' + i + ' · ' + W.levelOf(+i) + '</div><div>' + plural(counts[+i], 'active finding') + '</div>'; });
    }
    renderSourceStrip(r);
  }
  // Source timeline strip: research window start → run date, a dot per dated source, a marker for first_seen.
  function renderSourceStrip(r) {
    var mount = $('#viz-timeline'); if (!mount) return;
    var run = W.feed.run || {};
    var t = function (d) { var s = String(d || ''); if (s.length === 4) s += '-01-01'; else if (s.length === 7) s += '-01'; var v = new Date(s + 'T00:00:00Z').getTime(); return isFinite(v) ? v : null; };
    var events = (r.sources || []).map(function (s, i) { return { d: s.date, t: t(s.date), kind: 'source', label: (s.ref ? '[' + s.ref + '] ' : '') + (s.title || 'Source'), sub: s.publisher || '', i: i }; }).filter(function (e) { return e.t !== null; });
    if (r.first_seen && t(r.first_seen) !== null) events.push({ d: r.first_seen, t: t(r.first_seen), kind: 'seen', label: 'First seen by the tracker', sub: '' });
    var end = t(run.run_date) || Date.now(), start = t(run.research_start);
    var tmin = Math.min.apply(null, events.map(function (e) { return e.t; }).concat([start || end - 365 * 864e5]));
    if (!start || start > tmin) start = tmin;
    var span = Math.max(end - start, 30 * 864e5); start = end - span;
    var x = function (v) { return (Math.max(start, Math.min(end, v)) - start) / span * 100; };
    // Year ticks (or months when the window is short).
    var ticks = [], d0 = new Date(start), d1 = new Date(end), yearly = span > 540 * 864e5;
    if (yearly) { for (var y = d0.getUTCFullYear() + 1; y <= d1.getUTCFullYear(); y++) ticks.push({ t: Date.UTC(y, 0, 1), l: String(y) }); }
    else { for (var m = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1)); m.getTime() <= end; m.setUTCMonth(m.getUTCMonth() + 1)) ticks.push({ t: m.getTime(), l: MONTHS[m.getUTCMonth()].slice(0, 3) + (m.getUTCMonth() === 0 ? ' ' + m.getUTCFullYear() : '') }); }
    if (ticks.length > 14) ticks = ticks.filter(function (_, i) { return i % Math.ceil(ticks.length / 12) === 0; });
    ticks = ticks.filter(function (tk) { var px = (tk.t - start) / span; return px > 0.12 && px < 0.88; });  // keep clear of the end labels
    var undated = (r.sources || []).length - events.filter(function (e) { return e.kind === 'source'; }).length;
    // Stagger dots that land close together.
    var sorted = events.slice().sort(function (a, b) { return a.t - b.t; }), lastX = -10, lane = 0;
    sorted.forEach(function (e) { var px = x(e.t); lane = px - lastX < 2.2 ? (lane + 1) % 3 : 0; e.lane = lane; lastX = px; });
    mount.innerHTML = '<div class="src-strip" role="img" aria-label="' + esc('Source dates from ' + new Date(start).toISOString().slice(0, 10) + ' to ' + new Date(end).toISOString().slice(0, 10)) + '">' +
      '<span class="ss-axis"></span><span class="ss-end start"><b>' + new Date(start).toISOString().slice(0, 10) + '</b>research window</span><span class="ss-end end"><b>' + new Date(end).toISOString().slice(0, 10) + '</b>run date</span>' +
      ticks.map(function (tk) { return '<span class="ss-tick" style="left:' + x(tk.t).toFixed(2) + '%">' + esc(tk.l) + '</span>'; }).join('') +
      sorted.map(function (e, i) { return '<span class="ss-ev ' + e.kind + ' lane-' + e.lane + '" tabindex="0" data-tip-i="' + i + '" style="left:' + x(e.t).toFixed(2) + '%"></span>'; }).join('') + '</div>' +
      '<div class="legend"><span><i class="tl-key source"></i>Dated source</span><span><i class="tl-key seen"></i>First seen</span>' + (undated ? '<span class="muted">' + plural(undated, 'undated source') + ' not plotted</span>' : '') + '</div>' +
      '<ol class="tl-list">' + sorted.map(function (e) { return '<li><span class="mono small">' + esc(e.d) + '</span> ' + esc(e.label) + (e.sub ? ' <span class="muted small">· ' + esc(e.sub) + '</span>' : '') + '</li>'; }).join('') + '</ol>';
    bindTips(mount, function (i) { var e = sorted[+i]; return '<div class="tt-title">' + esc(e.label) + '</div><div class="muted">' + esc(e.d) + (e.sub ? ' · ' + esc(e.sub) : '') + '</div>'; });
  }

  /* ---------- updates: coverage by category + months ---------- */
  function renderCoverage() {
    renderCatBars($('#viz-coverage'), W.feed.records, { caption: 'Findings in feed by category and level' });
    renderMonths($('#viz-months'), W.feed.records);
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
    var months = monthsBack(12, runDate()), mIdx = {}; months.forEach(function (m, i) { mIdx[m] = i; });
    return W.SEA_CODES.map(function (c) {
      var all = W.feed.records.filter(function (r) { return W.seasOf(r).indexOf(c) >= 0; });
      var act = all.filter(W.isActive);
      var lv = {}; LEVELS4.forEach(function (l) { lv[l] = act.filter(function (r) { return r._level === l; }).length; });
      // 12-month activity: dated history events (and first_seen when history is empty) per month.
      var spark = months.map(function () { return 0; });
      all.forEach(function (r) {
        var h = (r.history || []).filter(function (x) { return x && x.date; });
        var dates = h.length ? h.map(function (x) { return x.date; }) : (r.first_seen ? [r.first_seen] : []);
        dates.forEach(function (d) { var i = mIdx[String(d).slice(0, 7)]; if (i !== undefined) spark[i]++; });
      });
      return { code: c, name: W.seaName(c), basin: W.SEAS[c].basin, n: act.length, lv: lv, spark: spark, months: months, max: act.reduce(function (m, r) { return Math.max(m, r._score); }, -1), researched: done.indexOf(c) >= 0 };
    });
  }
  function sparkSvg(r, maxS) {
    var w = 72, h = 16, n = r.spark.length, bw = w / n;
    var bars = r.spark.map(function (v, i) { var bh = v ? Math.max(2, v / maxS * h) : 1; return '<rect x="' + (i * bw + 0.6).toFixed(1) + '" y="' + (h - bh).toFixed(1) + '" width="' + (bw - 1.2).toFixed(1) + '" height="' + bh.toFixed(1) + '" class="' + (v ? 'on' : 'off') + '"/>'; }).join('');
    var total = r.spark.reduce(function (a, b) { return a + b; }, 0);
    return '<svg class="sp-spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + total + ' dated history events in the last 12 months">' + bars + '</svg>';
  }

  function renderSeasPanel(code) {
    var list = $('#sp-list'); if (!list) return;
    var rows = seaRows();
    var maxN = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
    var maxS = Math.max.apply(null, rows.map(function (r) { return Math.max.apply(null, r.spark); }).concat([1]));
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
        LEVELS4.filter(function (l) { return r.lv[l]; }).map(function (l) { return '<i style="flex:' + r.lv[l] + ';background:' + lvlFill(l) + '"></i>'; }).join('') + '</span>' : '';
      return '<li><a class="sp-row' + (r.n ? '' : ' empty') + '" href="sea.html?code=' + r.code + '"' + (r.code === code ? ' aria-current="page"' : '') + ' data-basin="' + r.basin + '" title="' + esc(r.name + ' · ' + W.basinName(r.basin) + (r.researched ? ' · researched in depth' : '')) + '">' +
        '<span class="sp-top"><i class="basin-chip" data-basin="' + r.basin + '" title="' + esc(W.basinName(r.basin)) + '"></i><span class="sp-name">' + esc(r.name.replace(/ \(.*\)$/, '')) + '</span><span class="sp-code">' + r.code + '</span>' +
        (r.n ? '<span class="sp-n">' + r.n + '</span>' : '') + '</span>' +
        (r.n ? '<span class="sp-graph">' + bar + sparkSvg(r, maxS) + '</span>' : '') + '</a></li>';
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
    $('#sp-legend').innerHTML = LEVELS4.map(function (l) { return '<span><i style="background:' + lvlFill(l) + '"></i>' + l + '</span>'; }).join('') +
      '<span class="sp-leg-basins">' + ['PAC', 'ATL', 'IND', 'SOU', 'ARC'].map(function (b) { return '<i class="basin-chip" data-basin="' + b + '" title="' + esc(W.basinName(b)) + '"></i>' + b.slice(0, 3); }).join(' ') + '</span>';
    renderSeasPanel(code);
  }

  /* ---------- boot ---------- */
  function renderAll() {
    if (!W) return;
    initPanel();
    if ($('#sea-panel')) initSeasPanel(W.page === 'sea' ? seaCodeFromUrl() : null);
    if (W.page === 'overview') {
      bindTileMap();
      renderCatBars($('#viz-cats'), active(), { caption: 'Active findings by category and severity level' });
      renderHist($('#viz-hist'), active());
      renderBasins(); renderMonths($('#viz-months'), active()); renderHeatmap(); renderLayers(); renderRisk(); renderTrends();
    }
    if (W.page === 'dossier') renderDossier();
    if (W.page === 'updates') renderCoverage();
  }
  document.addEventListener('wx:ready', function (e) { W = e.detail; renderAll(); });
  document.addEventListener('wx:rows', function (e) { if (W || window.WX) { W = W || window.WX; renderExplorerStack(e.detail); } else { var rows = e.detail; document.addEventListener('wx:ready', function () { renderExplorerStack(rows); }, { once: true }); } });
  if (window.WX) { W = window.WX; renderAll(); }
  // Shared pieces for seamap.js (sea page charts).
  window.OECharts = { renderCatBars: renderCatBars, renderHist: renderHist, renderMonths: renderMonths, bindTips: bindTips, levelLegend: levelLegend };
})();
