/* oceans.exposed — scrolling infographic (infographic.html). Renders from window.WX (published by app.js) and
   polls /api/ocean/summary so the page re-renders itself when a new run is published. Every figure comes from the
   feed; nothing is hard-coded. The world map is drawn by worldmap.js (shared with the overview). */
(function () {
  'use strict';
  var W = null;
  var LEVELS = ['Critical', 'High', 'Moderate', 'Low'];
  var LEVEL_RANGE = { Critical: '9–10', High: '7–8', Moderate: '4–6', Low: '0–3' };
  var STATUSES = ['Ongoing Major Issue', 'Corrective Action Underway', 'Monitoring or Emerging Risk', 'Resolved or Stabilized'];
  var BASIN_ORDER = ['PAC', 'ATL', 'IND', 'SOU', 'ARC'];
  var BASIN_VAR = { PAC: 'pac', ATL: 'atl', IND: 'ind', SOU: 'sou', ARC: 'arc' };
  var LAYER_BLURB = {
    'Climate & Physical': 'Warming, sea level, acidification and deoxygenation, sea ice: changes in the ocean itself.',
    'Pollution': 'Plastics and debris, nutrients and dead zones, chemicals, oil and dumping.',
    'Living Resources & Habitats': 'Reefs, fisheries, coastal habitats, wildlife and aquaculture.',
    'Governance & Economy': 'Shipping and ports, offshore energy, seabed mining, treaties, disputes, enforcement and ocean finance.'
  };
  var TREND_ICON = {
    'Worsening': '<path d="M4 16l6-6 4 4 6-7"/><path d="M14 7h6v6"/>',
    'Improving': '<path d="M4 8l6 6 4-4 6 7"/><path d="M14 17h6v-6"/>',
    'Stable': '<path d="M4 12h16"/><path d="M16 8l4 4-4 4"/>',
    'Volatile or Mixed': '<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>',
    'Insufficient History': '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><path d="M12 16h.01"/>'
  };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var POLL_MS = 5 * 60 * 1000;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return W.esc(s); }
  function lk(l) { return String(l).toLowerCase(); }
  function lv(l) { return 'var(--sev-' + lk(l) + ')'; }
  function active() { return W.feed.records.filter(W.isActive); }
  function pill(r) { return '<span class="lvl lvl-' + lk(r._level) + '">' + r._level + ' ' + r._score + '</span>'; }
  function dossier(r) { return 'dossier.html?id=' + encodeURIComponent(r.id); }
  function plural(n, s) { return n + ' ' + s + (n === 1 ? '' : 's'); }
  function pct(n, d) { return d ? Math.round(n / d * 100) + '%' : '0%'; }
  function fmtDay(d) { if (!d) return ''; var p = String(d).split('-'); return p.length >= 3 ? MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0] : d; }
  function monthLabel(k) { var p = k.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0].slice(2); }
  function levelCounts(list) { var c = {}; LEVELS.forEach(function (l) { c[l] = 0; }); list.forEach(function (r) { c[r._level]++; }); return c; }
  function mixBar(list, label) {
    // Stacked level mix with 2px surface gaps; empty levels are skipped. Label carries the identity for screen readers.
    var c = levelCounts(list), n = list.length;
    if (!n) return '<span class="ig-mix empty" aria-hidden="true"></span>';
    return '<span class="ig-mix" role="img" aria-label="' + esc((label ? label + ': ' : '') + LEVELS.map(function (l) { return c[l] + ' ' + l; }).join(', ')) + '">' +
      LEVELS.filter(function (l) { return c[l]; }).map(function (l) { return '<i style="flex:' + c[l] + ';background:' + lv(l) + '" title="' + esc(l + ' ' + c[l]) + '"></i>'; }).join('') + '</span>';
  }

  /* ---------- count-up + reveal ---------- */
  function countUp(el) {
    var end = +el.getAttribute('data-count') || 0, dec = +el.getAttribute('data-dec') || 0;
    var show = function (v) { el.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US'); };
    if (reduce || el._done === end) { show(end); el._done = end; return; }
    el._done = end;
    var t0 = performance.now(), dur = 1100;
    (function step(t) { var p = Math.min(1, (t - t0) / dur); show(end * (1 - Math.pow(1 - p, 3))); if (p < 1 && el._done === end) requestAnimationFrame(step); })(t0);
    setTimeout(function () { if (el._done === end) show(end); }, dur + 150);  // rAF pauses in background tabs; always land on the real number
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-count]').forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' }) : null;
  function arm(root) {
    (root || document).querySelectorAll('.reveal:not(.in)').forEach(function (el) {
      if (io && !reduce) io.observe(el); else { el.classList.add('in'); el.querySelectorAll('[data-count]').forEach(countUp); }
    });
  }

  /* ---------- 1. hero ---------- */
  function hero() {
    var a = active(), run = W.feed.run || {}, seas = {};
    a.forEach(function (r) { W.seasOf(r).forEach(function (s) { if (W.SEAS[s]) seas[s] = 1; }); });
    var el = $('#ig-hero-count'); el.setAttribute('data-count', a.length); countUp(el);
    $('#ig-hero-total').textContent = W.feed.records.length.toLocaleString('en-US');
    $('#ig-hero-seas').textContent = Object.keys(seas).length;
    $('#ig-hero-seas-total').textContent = W.SEA_CODES.length;
    $('#ig-run').innerHTML = 'Run <b>' + esc(run.run_date || '') + '</b>' + (run.revision ? ' · revision ' + esc(run.revision) : '') +
      (run.research_start ? ' · research window ' + esc(run.research_start) + ' to ' + esc(run.research_end || '') : '') +
      (run.prior_run_date ? ' · prior run ' + esc(run.prior_run_date) : ' · baseline run') +
      (W.feed.source_report && W.feed.source_report.url ? ' · <a href="' + esc(W.feed.source_report.url) + '" target="_blank" rel="noopener">full report (PDF)</a>' : '');
  }

  /* ---------- 2. the toll ---------- */
  function stats() {
    var a = active(), all = W.feed.records, run = W.feed.run || {};
    var seas = {}, countries = {}, cats = {};
    a.forEach(function (r) {
      W.seasOf(r).forEach(function (s) { if (W.SEAS[s]) seas[s] = 1; });
      W.countriesOf(r).forEach(function (c) { countries[c] = 1; });
      if (r.primary_category) cats[r.primary_category] = 1;
    });
    var crit = a.filter(function (r) { return r._level === 'Critical'; }).length;
    var high = a.filter(function (r) { return r._level === 'High'; }).length;
    var top = a.slice().sort(W.cmpRank)[0];
    var highSeas = countries.ABNJ ? 1 : 0, nations = Object.keys(countries).length - highSeas;
    var changed = all.filter(function (r) { return r.change_type && r.change_type !== 'unchanged'; }).length;
    var tiles = [
      { n: a.length, l: 'Active findings', s: 'Tracked issues not yet resolved or stabilized, of ' + all.length.toLocaleString('en-US') + ' records in the feed', c: 'var(--accent-bright)' },
      { n: crit, l: 'Critical', s: 'Scored 9–10: ' + pct(crit, a.length) + ' of active findings', c: lv('Critical') },
      { n: high, l: 'High', s: 'Scored 7–8: ' + pct(high, a.length) + ' of active findings', c: lv('High') },
      { n: Object.keys(seas).length, of: W.SEA_CODES.length, l: 'Regional seas with findings', s: 'Of the ' + W.SEA_CODES.length + ' seas the tracker divides the ocean into', c: 'var(--accent-bright)' },
      { n: nations + highSeas, l: (highSeas ? 'Countries and the high seas' : 'Countries') + ' named', s: nations + ' ' + (nations === 1 ? 'country' : 'countries') + (highSeas ? ' plus areas beyond national jurisdiction' : '') + ' in the location of an active finding', c: 'var(--accent-bright)' },
      { n: Object.keys(cats).length, of: W.CATEGORIES.length, l: 'Categories covered', s: 'Of ' + W.CATEGORIES.length + ' issue categories, from warming to aquaculture', c: 'var(--accent-bright)' }
    ];
    var html = tiles.map(function (t) {
      return '<div class="ig-stat reveal"><span class="ig-stat-bar" style="background:' + t.c + '"></span><div class="ig-stat-n"><span data-count="' + t.n + '">0</span>' + (t.of ? '<small>of ' + t.of + '</small>' : '') + '</div><div class="ig-stat-l">' + esc(t.l) + '</div><div class="ig-stat-s">' + esc(t.s) + '</div></div>';
    }).join('');
    html += top
      ? '<a class="ig-stat ig-stat-top reveal" href="' + dossier(top) + '"><span class="ig-stat-bar" style="background:' + lv(top._level) + '"></span><div class="ig-stat-n"><span data-count="' + top._score + '">0</span><small>of 10</small></div><div class="ig-stat-l">Highest-scored finding</div><div class="ig-stat-s"><b>' + esc(top.location.name) + '</b> — ' + esc(top.title) + '<br>' + pill(top) + ' <span class="ig-muted">' + esc(W.catName(top.primary_category)) + '</span></div></a>'
      : '<div class="ig-stat reveal"><span class="ig-stat-bar" style="background:var(--border-col)"></span><div class="ig-stat-n"><span>—</span></div><div class="ig-stat-l">Highest-scored finding</div><div class="ig-stat-s">No active finding in this feed</div></div>';
    html += '<div class="ig-stat reveal"><span class="ig-stat-bar" style="background:var(--accent-bright)"></span><div class="ig-stat-n"><span data-count="' + changed + '">0</span></div><div class="ig-stat-l">' + (run.prior_run_date ? 'Changed this run' : 'New baseline records') + '</div><div class="ig-stat-s">' + (run.prior_run_date ? 'New, changed, escalated, de-escalated, resolved or reopened since ' + esc(run.prior_run_date) : 'First run: every record is new') + '</div></div>';
    $('#ig-stats').innerHTML = html;
  }

  /* ---------- 3. dot wall + level bar ---------- */
  function dots() {
    var all = W.feed.records.slice().sort(function (a, b) {
      var d = (W.isActive(b) ? 1 : 0) - (W.isActive(a) ? 1 : 0); if (d) return d;
      return LEVELS.indexOf(a._level) - LEVELS.indexOf(b._level) || b._score - a._score;
    });
    var wall = $('#ig-dots');
    wall.className = 'ig-dots reveal' + (all.length > 600 ? ' xs' : all.length > 140 ? ' sm' : '');
    var showScore = all.length <= 140;
    wall.innerHTML = all.map(function (r, i) {
      var off = !W.isActive(r);
      return '<a class="ig-dot' + (off ? ' off' : '') + '" href="' + dossier(r) + '" style="--c:' + lv(r._level) + ';--i:' + (i % 80) + '" title="' + esc(r.location.name + ' · ' + r._level + ' ' + r._score + (off ? ' · ' + r.status : '')) + '" aria-label="' + esc(r.location.name + ', ' + r._level + ' ' + r._score + (off ? ', ' + r.status : '')) + '">' + (showScore ? '<span>' + r._score + '</span>' : '') + '</a>';
    }).join('');
    var a = active(), c = levelCounts(a), n = a.length;
    $('#ig-levels').innerHTML = (n ? '<div class="ig-levelbar" role="img" aria-label="' + esc(LEVELS.map(function (l) { return c[l] + ' ' + l; }).join(', ')) + '">' + LEVELS.filter(function (l) { return c[l]; }).map(function (l) {
      return '<span style="flex:' + c[l] + ';background:' + lv(l) + '"><b>' + c[l] + '</b></span>';
    }).join('') + '</div>' : '') + '<div class="ig-legend">' + LEVELS.map(function (l) {
      return '<a href="explorer.html?level=' + l + '"><i style="background:' + lv(l) + '"></i>' + l + ' ' + LEVEL_RANGE[l] + ' <b>' + c[l] + '</b> <em>' + pct(c[l], n) + '</em></a>';
    }).join('') + '<span><i class="ig-hollow"></i>Resolved or stabilized <b>' + (W.feed.records.length - n) + '</b></span></div>';
  }

  /* ---------- 4. map fallback (worldmap.js draws the map itself) ---------- */
  function mapFallback() {
    var t = $('#tilemap'); if (t && W.renderTileMap) W.renderTileMap(t, active());
  }

  /* ---------- 5. categories ---------- */
  function categories() {
    var a = active();
    $('#ig-cats').innerHTML = W.CATEGORIES.map(function (c) {
      var list = a.filter(function (r) { return r.primary_category === c.slug; }).sort(W.cmpRank), top = list[0];
      return '<div class="ig-cat reveal' + (list.length ? '' : ' empty') + '" style="--c:' + (top ? lv(top._level) : 'var(--border-col)') + '">' +
        '<a class="ig-cat-head" href="explorer.html?category=' + c.slug + '"><span class="ig-cat-icon">' + W.catIcon(c.slug, 26) + '</span><span class="ig-cat-n">' + list.length + '</span><span class="ig-cat-name">' + esc(c.name) + '</span></a>' +
        mixBar(list, c.name) +
        (top ? '<a class="ig-cat-top" href="' + dossier(top) + '">' + pill(top) + ' <span><b>' + esc(top.location.name) + '</b> — ' + esc(top.title) + '</span></a>' : '<span class="ig-cat-top none">No finding yet</span>') + '</div>';
    }).join('');
  }

  /* ---------- 6. layers ---------- */
  function layers() {
    var a = active(), n = a.length;
    var data = W.LAYERS.map(function (l, i) { return { l: l, slot: i + 1, k: a.filter(function (r) { return r.issue_layer === l; }).length }; });
    $('#ig-layers').innerHTML = '<div class="reveal">' +
      (n ? '<div class="ig-stack" role="img" aria-label="' + esc(data.map(function (d) { return d.l + ' ' + d.k; }).join(', ')) + '">' + data.filter(function (d) { return d.k; }).map(function (d) {
        return '<span style="flex:' + d.k + ';background:var(--series-' + d.slot + ')" title="' + esc(d.l + ' ' + d.k) + '">' + (d.k / n >= 0.12 ? '<b>' + pct(d.k, n) + '</b>' : '') + '</span>';
      }).join('') + '</div>' : '<p class="ig-muted">No active findings in this feed.</p>') +
      '<div class="ig-layer-list">' + data.map(function (d) {
        return '<a class="ig-layer" href="explorer.html?layer=' + encodeURIComponent(d.l) + '"><i style="background:var(--series-' + d.slot + ')"></i><span class="ig-layer-name">' + esc(d.l) + '</span><span class="ig-layer-n"><b data-count="' + d.k + '">0</b> <em>' + pct(d.k, n) + '</em></span><span class="ig-layer-s">' + esc(LAYER_BLURB[d.l] || '') + '</span></a>';
      }).join('') + '</div></div>';
  }

  /* ---------- 7. basins ---------- */
  function basins() {
    var a = active(), byBasin = {}, bySea = {}, noBasin = 0;
    a.forEach(function (r) {
      var b = W.basinOf(r);
      if (BASIN_VAR[b]) byBasin[b] = (byBasin[b] || 0) + 1; else noBasin++;
      W.seasOf(r).forEach(function (s) { if (W.SEAS[s]) bySea[s] = (bySea[s] || 0) + 1; });
    });
    var max = Math.max.apply(null, BASIN_ORDER.map(function (b) { return byBasin[b] || 0; }).concat([1]));
    var seaMax = Math.max.apply(null, Object.keys(bySea).map(function (s) { return bySea[s]; }).concat([1]));
    $('#ig-basins').innerHTML = BASIN_ORDER.map(function (b) {
      var seas = W.SEA_CODES.filter(function (s) { return W.SEAS[s].basin === b; }).sort(function (x, y) { return (bySea[y] || 0) - (bySea[x] || 0) || (W.seaName(x) < W.seaName(y) ? -1 : 1); });
      var k = byBasin[b] || 0;
      return '<div class="ig-basin reveal" style="--c:var(--basin-' + BASIN_VAR[b] + ')"><a class="ig-basin-head" href="explorer.html?basin=' + b + '"><span class="ig-basin-name">' + esc(W.basinName(b)) + '</span><span class="ig-basin-n" data-count="' + k + '">0</span></a>' +
        '<span class="ig-track"><span class="ig-fill" style="--w:' + (k / max * 100).toFixed(1) + '%;background:var(--c)"></span></span>' +
        '<ul class="ig-basin-seas">' + seas.map(function (s) {
          var sn = bySea[s] || 0;
          return '<li' + (sn ? '' : ' class="none"') + '><a href="sea.html?code=' + s + '" title="' + esc(W.seaName(s) + ': ' + plural(sn, 'active finding')) + '"><span class="ig-sea-bar" aria-hidden="true"><i style="width:' + (sn / seaMax * 100).toFixed(1) + '%"></i></span><span class="ig-sea-name"><span class="ig-sea-code">' + s + '</span>' + esc(W.seaName(s)) + '</span><b>' + sn + '</b></a></li>';
        }).join('') + '</ul></div>';
    }).join('') + (noBasin ? '<p class="ig-muted small ig-basin-note">' + plural(noBasin, 'active finding') + ' with no basin (global or unlocated) counted in no column.</p>' : '');
  }

  /* ---------- 8. what it harms ---------- */
  function components() {
    var a = active(), n = a.length;
    $('#ig-comps').innerHTML = W.COMPONENTS.map(function (c, i) {
      var sum = a.reduce(function (s, r) { return s + (Number(((r.severity || {}).components || {})[c.key]) || 0); }, 0);
      var mean = n ? sum / n : 0, band = Math.min(2, Math.round(mean));
      var twos = a.filter(function (r) { return Number(((r.severity || {}).components || {})[c.key]) === 2; }).length;
      return '<div class="ig-comp reveal"><div class="ig-comp-head"><span class="ig-comp-name">' + esc(c.name) + '</span><span class="ig-comp-n"><b data-count="' + mean.toFixed(2) + '" data-dec="1">0.0</b><small>/ 2</small></span></div>' +
        '<div class="ig-meter" role="img" aria-label="' + esc(c.name + ': mean ' + mean.toFixed(2) + ' of 2') + '"><span class="ig-fill" style="--w:' + (mean / 2 * 100).toFixed(1) + '%"></span><i style="left:50%"></i></div>' +
        '<div class="ig-meter-ticks"><span>0</span><span>1</span><span>2</span></div>' +
        '<p class="ig-comp-rubric">' + (n ? '<b>Band ' + band + ':</b> ' + esc(c.rubric[band]) + ' <em>' + twos + ' of ' + n + ' at 2</em>' : '<em>No active findings</em>') + '</p></div>';
    }).join('');
  }

  /* ---------- 9. timeline + newest sources ---------- */
  function timeline() {
    var all = W.feed.records, run = (W.feed.run || {}).run_date || new Date().toISOString().slice(0, 10);
    var firsts = all.map(function (r) { return String(r.first_seen || '').slice(0, 7); }).filter(function (k) { return /^\d{4}-\d{2}$/.test(k); }).sort();
    var last = run.slice(0, 7), lastN = +last.slice(0, 4) * 12 + +last.slice(5, 7) - 1;
    var firstN = firsts.length ? +firsts[0].slice(0, 4) * 12 + +firsts[0].slice(5, 7) - 1 : lastN;
    var span = Math.min(36, Math.max(12, lastN - firstN + 1)), keys = [];
    for (var i = span - 1; i >= 0; i--) { var m = lastN - i; keys.push(Math.floor(m / 12) + '-' + String(m % 12 + 1).padStart(2, '0')); }
    var counts = {}, older = 0; keys.forEach(function (k) { counts[k] = 0; });
    firsts.forEach(function (k) { if (counts[k] !== undefined) counts[k]++; else older++; });
    var max = Math.max.apply(null, keys.map(function (k) { return counts[k]; }).concat([1]));
    var peak = keys.slice().sort(function (x, y) { return counts[y] - counts[x]; })[0];
    var mount = $('#ig-months');
    mount.innerHTML = '<div class="ig-bars" style="--cols:' + keys.length + '" role="img" aria-label="' + esc('Findings first seen per month: ' + keys.map(function (k) { return monthLabel(k) + ' ' + counts[k]; }).join(', ')) + '">' + keys.map(function (k, i) {
      return '<a class="ig-bar' + (k === peak && counts[k] ? ' peak' : '') + '" href="explorer.html?q=' + k + '" data-tip-i="' + i + '" style="--w:' + (counts[k] / max * 100).toFixed(1) + '%" aria-label="' + esc(monthLabel(k) + ': ' + plural(counts[k], 'finding')) + '"><span class="ig-bar-fill"></span>' + (k === peak && counts[k] ? '<b>' + counts[k] + '</b>' : '') + '</a>';
    }).join('') + '</div><div class="ig-bar-axis"><span>' + monthLabel(keys[0]) + '</span><span>' + monthLabel(keys[Math.floor(keys.length / 2)]) + '</span><span>' + monthLabel(keys[keys.length - 1]) + '</span></div>';
    if (window.OECharts && OECharts.bindTips) OECharts.bindTips(mount, function (i) { var k = keys[+i]; return '<div class="tt-title">' + monthLabel(k) + '</div><div>' + plural(counts[k], 'finding') + ' first seen</div>'; });
    $('#ig-months-note').textContent = 'Findings by the month they were first seen in the feed, over ' + keys.length + ' months to ' + monthLabel(last) + '. Peak month: ' + plural(max, 'finding') + (older ? '. ' + older + ' first seen before this window' : '') + '.';

    var src = [];
    all.forEach(function (r) { (r.sources || []).forEach(function (s) { if (s && s.date) src.push({ r: r, s: s }); }); });
    src.sort(function (x, y) { return y.s.date < x.s.date ? -1 : y.s.date > x.s.date ? 1 : 0; });
    $('#ig-sources').innerHTML = src.slice(0, 6).map(function (x) {
      return '<li><span class="ig-src-date">' + esc(fmtDay(x.s.date)) + '</span><a href="' + dossier(x.r) + '"><b>' + esc(x.s.publisher || 'Source') + '</b> — ' + esc(x.s.title || x.r.title) + '</a><span class="ig-src-sub">' + pill(x.r) + ' ' + esc(x.r.location.name) + '</span></li>';
    }).join('') || '<li class="ig-muted">No dated sources in this feed.</li>';
  }

  /* ---------- 10. status + trend ---------- */
  function statuses() {
    var all = W.feed.records, a = active();
    var st = STATUSES.map(function (s) { return { k: s, n: all.filter(function (r) { return r.status === s; }).length }; });
    var other = all.length - st.reduce(function (s, x) { return s + x.n; }, 0);
    if (other) st.push({ k: 'Other status', n: other });
    var max = Math.max.apply(null, st.map(function (x) { return x.n; }).concat([1]));
    $('#ig-status').innerHTML = '<div class="ig-rows">' + st.map(function (s) {
      var resolved = /^resolved/i.test(s.k);
      return '<a class="ig-row" href="explorer.html?status=' + encodeURIComponent(s.k) + '"><span class="ig-row-l">' + esc(s.k) + '</span><span class="ig-track"><span class="ig-fill' + (resolved ? ' hollow' : '') + '" style="--w:' + (s.n / max * 100).toFixed(1) + '%"></span></span><b>' + s.n + '</b></a>';
    }).join('') + '</div><p class="ig-muted small">' + all.length.toLocaleString('en-US') + ' records · ' + pct(all.length - a.length, all.length) + ' resolved or stabilized.</p>';

    var tr = W.TRENDS.map(function (t) { return { k: t, n: a.filter(function (r) { return ((r.trend || {}).direction || 'Insufficient History') === t; }).length }; });
    var tmax = Math.max.apply(null, tr.map(function (x) { return x.n; }).concat([1]));
    $('#ig-trend').innerHTML = '<div class="ig-rows">' + tr.map(function (t) {
      return '<a class="ig-row t-' + t.k.split(' ')[0].toLowerCase() + '" href="explorer.html?trend=' + encodeURIComponent(t.k) + '"><span class="ig-row-l"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TREND_ICON[t.k] + '</svg>' + esc(t.k) + '</span><span class="ig-track"><span class="ig-fill" style="--w:' + (t.n / tmax * 100).toFixed(1) + '%"></span></span><b>' + t.n + '</b></a>';
    }).join('') + '</div><p class="ig-muted small">Direction as observed in the cited sources. Early runs have little comparable history.</p>';
  }

  /* ---------- 11. the wall ---------- */
  function wall() {
    var a = active().sort(W.cmpRank), groups = {}, order = [];
    a.forEach(function (r) {
      var s = W.seasOf(r).filter(function (c) { return W.SEAS[c]; })[0];
      var key = s || (W.basinOf(r) ? 'B:' + W.basinOf(r) : 'GLOBAL');
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(r);
    });
    order.sort(function (x, y) { return groups[y].length - groups[x].length; });
    var openAll = a.length <= 400, LIMIT = 12;
    $('#ig-wall').innerHTML = order.map(function (key) {
      var list = groups[key], sea = W.SEAS[key];
      var title = sea ? W.seaName(key) : key.charAt(0) === 'B' ? W.basinName(key.slice(2)) + ' (open ocean)' : 'Global or unlocated';
      var href = sea ? 'sea.html?code=' + key : key.charAt(0) === 'B' ? 'explorer.html?basin=' + key.slice(2) : 'explorer.html';
      var line = function (r) { return '<a class="ig-line" href="' + dossier(r) + '"><span class="ig-line-t"><b>' + esc(r.location.name) + '</b> — ' + esc(r.title) + '</span>' + pill(r) + '</a>'; };
      var shown = openAll ? list : list.slice(0, LIMIT), rest = list.slice(shown.length);
      return '<section class="ig-wall-group reveal"><h3 class="ig-wall-h"><a href="' + href + '">' + (sea ? '<span class="ig-sea-code">' + key + '</span>' : '') + esc(title) + '</a><span class="ig-wall-n">' + list.length + '</span>' + mixBar(list, title) + '</h3>' +
        '<div class="ig-lines">' + shown.map(line).join('') + '</div>' +
        (rest.length ? '<details class="ig-more"><summary>Show ' + rest.length + ' more</summary><div class="ig-lines">' + rest.map(line).join('') + '</div></details>' : '') + '</section>';
    }).join('') || '<p class="ig-muted">No active findings in this feed.</p>';
    $('#ig-wall-note').textContent = plural(a.length, 'active finding') + ' in ' + plural(order.length, 'group') + ', ranked by score within each. A finding that spans several seas is listed under the first.' + (openAll ? '' : ' Groups show their top ' + LIMIT + '; expand for the rest.');
  }

  /* ---------- 12. end band ---------- */
  function coverage() {
    var cov = W.feed.coverage || {}, done = (cov.regions_researched || []).filter(function (c) { return W.SEAS[c]; });
    $('#ig-coverage').innerHTML = '<p class="ig-big-quote">' + esc(cov.statement || 'A ranked set of discoverable, reported or officially documented issues, not a census of every problem in the world ocean.') + '</p>' +
      '<p class="ig-muted">' + (cov.date_range ? 'Research window ' + esc(cov.date_range) + ' · ' : '') + done.length + ' of ' + W.SEA_CODES.length + ' regional seas researched in depth.</p>';
  }
  function stamp() {
    var t = new Date();
    $('#ig-updated').textContent = 'Checked ' + t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' · run ' + ((W.feed.run || {}).run_date || '') + ' · re-renders automatically when a new run is published';
  }

  function renderAll() {
    hero(); stats(); dots(); mapFallback(); categories(); layers(); basins(); components(); timeline(); statuses(); wall(); coverage(); stamp();
    arm();
  }

  /* ---------- live polling ---------- */
  function poll() {
    if (document.hidden) return;
    fetch('/api/ocean/summary', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
      stamp();
      if (!s || !s.run) return;
      var cur = W.feed.run || {};
      if (s.run.run_date === cur.run_date && s.run.revision === cur.revision && (s.summary || {}).total === W.feed.records.length) return;
      return W.reload().then(function (feed) {
        W.feed = feed;
        renderAll();
        document.dispatchEvent(new Event('wx:updated'));  // worldmap.js redraws on this
        var t = $('#ig-toast'); t.textContent = 'New run published: ' + (feed.run.run_date || '') + ' · ' + plural(feed.records.length, 'finding'); t.classList.add('on');
        setTimeout(function () { t.classList.remove('on'); }, 6000);
      });
    }).catch(function () {});
  }

  function start(wx) {
    W = wx; if (W.page !== 'infographic') return;
    renderAll();
    setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  }
  document.addEventListener('wx:ready', function (e) { start(e.detail); });
  if (window.WX) start(window.WX);
})();
