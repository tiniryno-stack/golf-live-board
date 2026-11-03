/* 014 mockup kit: sample data + shared pieces. Reference only. */
(function () {
  var q = new URLSearchParams(location.search);
  if ((q.get('mode') || 'dark') === 'light') document.documentElement.classList.add('light');

  var I = {
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    rings: '<circle cx="8.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/>',
    bars: '<path d="M4 6h16M4 12h11M4 18h7"/>',
    grid: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    share: '<path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'
  };
  function icon(n, s, extra) {
    s = s || 24;
    return '<svg aria-hidden="true" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (extra ? ' style="' + extra + '"' : '') + '>' + I[n] + '</svg>';
  }
  function keep(href) { var m = q.get('mode'); return href + (m ? (href.indexOf('?') > 0 ? '&' : '?') + 'mode=' + m : ''); }
  function tabbar(active) {
    var t = [['Enter', 'flag', 'Enter.html'], ['Matches', 'rings', 'Matches.html'], ['Board', 'bars', 'Board.html'], ['Card', 'grid', '#']];
    return '<nav class="tabbar" aria-label="Round">' + t.map(function (x) {
      return '<a href="' + keep(x[2]) + '" aria-label="' + x[0] + '"' + (x[0] === active ? ' class="on" aria-current="page"' : '') + '>' + icon(x[1], 22) + '</a>';
    }).join('') + '</nav>';
  }
  function top(right) {
    return '<div class="top"><div class="avatar">AD</div><div class="t-body" style="font-weight:600">Andrew</div><div class="t-small muted" style="flex:1;text-align:right">Sherrill Park · Sat</div>' + (right || '') + '</div>';
  }

  /* ---------- sample data ---------- */
  var SIDES = { A: 'Team Andrew', J: 'Team Josh' };
  var CARTS = {
    A1: 'Andrew + Alex', A2: 'Ant + Steve', A3: 'Justin + Chuck', A4: 'Mitch + Peter',
    J1: 'Sean + Baker', J2: 'Josh + Brandon', J3: 'Joseph + Jay', J4: 'Elijah + Marcus'
  };
  var PAR = [4, 5, 3, 4, 4, 4, 3, 4, 4, 4, 3, 4, 5, 4, 3, 4, 4, 5];
  var ROT = ['Holes 1–6', 'Holes 7–12', 'Holes 13–18'];
  var TEE = ['1st tee time', '2nd tee time', '3rd tee time', '4th tee time'];
  // rotation r: A(i) plays J((i+r) mod 4)
  function opp(i, r) { return 'J' + (((i - 1 + r) % 4) + 1); }

  // hole outcomes per match: [lowBall, lowTotal]: a | j | p (push) | live | 0 (not played)
  function holesFor(aPts, jPts, played, live) {
    var p = (aPts % 1) ? 1 : 0, a = aPts - p / 2, j = jPts - p / 2, slots = [];
    if (a > 1 && j > 1 && a + j + p + 2 <= played * 2) { p += 2; a -= 1; j -= 1; }
    for (var x = 0; x < a; x++) slots.push('a');
    for (x = 0; x < j; x++) slots.push('j');
    for (x = 0; x < p; x++) slots.push('p');
    var n = slots.length, mixed = slots.map(function (v, i) { return [((i * 5) + 3) % (n || 1), v]; }).sort(function (u, w) { return u[0] - w[0]; }).map(function (u) { return u[1]; });
    var out = [];
    for (var h = 0; h < 6; h++) {
      if (h < played) out.push([mixed[h * 2] || 'p', mixed[h * 2 + 1] || 'p']);
      else out.push(h === played && live ? ['live', 'live'] : [0, 0]);
    }
    return out;
  }

  // states: empty | live | clinched | final
  function matches(state) {
    var M = [];
    for (var r = 0; r < 3; r++) for (var i = 1; i <= 4; i++) M.push({ rot: r, a: 'A' + i, j: opp(i, r), tee: [i - 1, (+opp(i, r).slice(1)) - 1] });
    function set(r, i, o) { Object.assign(M[r * 4 + i - 1], o); }
    if (state === 'empty') { M.forEach(function (m) { var o=['1st','2nd','3rd','4th']; m.wait = m.rot === 0 ? TEE[m.tee[0]] : o[m.tee[0]] + ' + ' + o[m.tee[1]] + ' tee times'; }); return M; }
    set(0, 1, { res: 'A', s: '7–5', ap: 7, jp: 5, n: 6 }); set(0, 2, { res: 'A', s: '6½–5½', ap: 6.5, jp: 5.5, n: 6 });
    set(0, 3, { res: 'J', s: '8–4', ap: 4, jp: 8, n: 6 }); set(0, 4, { res: 'A', s: '7–5', ap: 7, jp: 5, n: 6 });
    set(1, 1, { res: 'A', s: '7½–4½', ap: 7.5, jp: 4.5, n: 6 }); set(1, 2, { res: 'H', s: '6–6', ap: 6, jp: 6, n: 6 });
    set(1, 3, { res: 'J', s: '8–4', ap: 4, jp: 8, n: 6 }); set(1, 4, { res: 'A', s: '7–3', ap: 7, jp: 3, n: 5, early: 1 });
    if (state === 'live') {
      set(2, 1, { lead: 'A', by: 2, thru: 4, ap: 5, jp: 3, n: 4, liveNow: 1 });
      set(2, 2, { wait: 'Waiting on 4th tee time' });
      set(2, 3, { res: 'J', s: '7–1', ap: 1, jp: 7, n: 4, early: 2, prov: 1 });
      set(2, 4, { wait: 'Waiting on 4th tee time' });
    } else if (state === 'clinched') {
      set(2, 1, { res: 'A', s: '7–5', ap: 7, jp: 5, n: 6, clincher: 1 });
      set(2, 2, { lead: 'J', by: 1, thru: 2, ap: 1.5, jp: 2.5, n: 2, liveNow: 1 });
      set(2, 3, { res: 'J', s: '7–1', ap: 1, jp: 7, n: 4, early: 2 });
      set(2, 4, { lead: null, by: 0, thru: 1, ap: 1, jp: 1, n: 1, liveNow: 1 });
    } else {
      set(2, 1, { res: 'A', s: '7–5', ap: 7, jp: 5, n: 6 });
      set(2, 2, { res: 'J', s: '7½–4½', ap: 4.5, jp: 7.5, n: 6 });
      set(2, 3, { res: 'J', s: '7–1', ap: 1, jp: 7, n: 4, early: 2 });
      set(2, 4, { res: 'H', s: '6–6', ap: 6, jp: 6, n: 6 });
    }
    return M;
  }
  function tally(M) {
    var t = { A: 0, J: 0, Aprov: 0, Jprov: 0, left: 0, rot: [{ A: 0, J: 0 }, { A: 0, J: 0 }, { A: 0, J: 0 }] };
    M.forEach(function (m) {
      if (m.res === 'A' || m.res === 'J') { t[m.res] += 1; t.rot[m.rot][m.res] += 1; if (m.prov) t[m.res + 'prov'] += 1; }
      else if (m.res === 'H') { t.A += .5; t.J += .5; t.rot[m.rot].A += .5; t.rot[m.rot].J += .5; }
      else t.left += 1;
    });
    return t;
  }
  function fr(n) { var w = Math.floor(n), h = n - w > 0; return (w || !h ? String(w) : '') + (h ? '½' : ''); }

  /* colors: viewer is on side A */
  function sc(side) { return side === 'A' ? 'var(--cart-you)' : 'var(--cart-b)'; }
  function st(side) { return side === 'A' ? 'var(--cart-you-text)' : 'var(--cart-b)'; }
  function gd(k) {
    if (k === 'a') return 'background:' + sc('A');
    if (k === 'j') return 'background:' + sc('J');
    if (k === 'p') return 'background:linear-gradient(90deg,' + sc('A') + ' 50%,' + sc('J') + ' 50%)';
    if (k === 'live') return 'border:2px dashed var(--text-muted)';
    return 'border:2px solid var(--line)';
  }

  function status(m) {
    if (m.res === 'A' || m.res === 'J') {
      var who = m.res === 'A' ? 'Andrew' : 'Josh';
      return { a: '<span style="color:' + st(m.res) + '">won ' + m.s + '</span>', b: (m.prov ? '<span class="prov">prov</span> ' : '') + '+1 Team ' + who };
    }
    if (m.res === 'H') return { a: 'halved', b: '½ each' };
    if (m.thru) return m.lead ? { a: '<span style="color:' + st(m.lead) + '">' + m.by + ' up</span>', b: 'thru ' + m.thru } : { a: 'AS', b: 'thru ' + m.thru };
    return { a: '<span class="muted">–</span>', b: m.wait || '' };
  }
  function nameSpan(cart, m) {
    var side = cart[0], col = st(side), dim = (m.res === 'A' || m.res === 'J') && m.res !== side;
    var you = cart === 'A1';
    return '<span style="color:' + (dim ? 'var(--text-muted)' : col) + ';font-weight:' + (dim ? 500 : 600) + '">' + CARTS[cart] + '</span>' + (you ? '<span class="tag-you">YOU</span>' : '');
  }
  function matchRow(m, opts) {
    opts = opts || {};
    var s = status(m);
    var mine = m.a === 'A1';
    return '<div class="mrow' + (mine && opts.pin !== false ? ' mine' : '') + '"' + (opts.attrs || '') + '>' +
      '<div class="names"><div class="nm">' + nameSpan(m.a, m) + '</div><div class="nm"><span class="v">v </span>' + nameSpan(m.j, m) + '</div></div>' +
      '<div class="st"><div class="a">' + s.a + '</div><div class="b">' + s.b + '</div></div>' +
      (opts.chev ? icon('chev', 18, 'transform:rotate(' + (opts.open ? 180 : 0) + 'deg)').replace('<svg', '<svg class="chev"') : '') +
      '</div>';
  }
  function holeGrid(m) {
    var hs = holesFor(m.ap || 0, m.jp || 0, m.n || 0, m.liveNow), base = m.rot * 6;
    var h = '<div class="hgrid"><div class="lbl">HOLE</div>';
    for (var i = 0; i < 6; i++) h += '<div class="h"><div class="mono" style="font-size:15px;font-weight:700;line-height:1">' + (base + i + 1) + '</div><div class="t-small muted" style="font-size:12px;line-height:14px">par ' + PAR[base + i] + '</div></div>';
    h += '<div class="lbl">LOW BALL</div>' + hs.map(function (c) { return '<div><div class="gd" style="' + gd(c[0]) + '"></div></div>'; }).join('');
    h += '<div class="lbl">LOW TOTAL</div>' + hs.map(function (c) { return '<div><div class="gd" style="' + gd(c[1]) + '"></div></div>'; }).join('');
    return h + '</div>';
  }

  window.K = { q: q, icon: icon, tabbar: tabbar, top: top, keep: keep, SIDES: SIDES, CARTS: CARTS, PAR: PAR, ROT: ROT, TEE: TEE, opp: opp,
    matches: matches, tally: tally, fr: fr, sc: sc, st: st, gd: gd, status: status, matchRow: matchRow, holeGrid: holeGrid, holesFor: holesFor };
})();
