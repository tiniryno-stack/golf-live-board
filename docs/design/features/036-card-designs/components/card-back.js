/* 036 component: card back: ranking, row fitting (CAP rows, top + gap + you ±1), stats.
   Extracted from the approved prototype card-back-big-group.html (docs/design/features/036-card-designs/).
   Reference code: port it into the app's own files; names may change. */

const ranked = FIELD.slice().sort((a, b) => a[1] - b[1]).map(([n, g], i, a) => [n, g, a.findIndex((x) => x[1] === g) + 1]);
const me = ranked.find((x) => x[0] === 'Andrew'), ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const pl = ([n, g, r], showRank) => `<div class="cb-pl${n === 'Andrew' ? ' me' : ''}">${showRank ? `<i>${r}</i>` : ''}<span>${n}</span><b>${g}</b></div>`;
const tiles = (a, b, c, d) => `<div class="cb-tiles"><div class="cb-tile"><b>${a}</b><span>Birdies</span></div><div class="cb-tile"><b>${b}</b><span>Pars</span></div><div class="cb-tile"><b>${c}</b><span>Bogeys</span></div><div class="cb-tile"><b>${d}</b><span>Doubles+</span></div></div>`;
const stats = (k) => { const r = R[k], d = r.s.map((s, i) => s - r.par[i]), t3 = (p) => sum(d.filter((_, i) => r.par[i] === p));
  return tiles(d.filter((x) => x < 0).length, d.filter((x) => x === 0).length, d.filter((x) => x === 1).length, d.filter((x) => x >= 2).length)
    + `<div class="cb-types"><span><i>Par 3s</i>+${t3(3)}</span><span><i>Par 4s</i>+${t3(4)}</span><span><i>Par 5s</i>+${t3(5)}</span><span><i>Front · back</i>${sum(r.s.slice(0, 9))} · ${sum(r.s.slice(9))}</span></div>`; };
const back = (k, inner) => `<div class="lk-slot lkf-${R[k].fin} x-land" style="${GRADE[R[k].fin]}"><div class="lk-tilt"><div class="lk-flip"><div class="lk-face lk-front"><div class="lk-mat"><i class="lk-sheen"></i>${R[k].fin === 'prismatic' ? '<i class="x-slick"></i>' : ''}${inner}</div></div></div></div></div>`;
const right = (k, line) => `<div class="cb-col sb"><div><div class="cb-k">${R[k].fin === 'standard' ? 'Standard' : FIN[R[k].fin]}</div><div class="cb-line" style="padding-top:1.4cqw">${line}</div></div>${stats(k)}</div>`;
const mine = FIELD.slice(0, 4).map(([n, g]) => ranked.find((x) => x[0] === n)).sort((a, b) => a[1] - b[1]);
const TEE = ['Andrew', 'Alex', 'Chuck', 'Anthony'], CAP = 11;
/* as many ranked rows as fit; if you are below the cut, the top rows, a gap, then you with a neighbor either side */
function rows(who) {
  const idx = ranked.findIndex((x) => x[0] === who), line = (p) => `<div class="cb-pl${p[0] === who ? ' me' : ''}${p[0] !== who && TEE.includes(p[0]) && TEE.includes(who) ? ' tm' : ''}"><i>${p[2]}</i><span>${p[0]}</span><b>${p[1]}</b></div>`;
  if (idx < CAP) return ranked.slice(0, CAP).map(line).join('') + `<div class="cb-k" style="padding-top:1.4cqw">+ ${ranked.length - CAP} more played${TEE.includes(who) ? ' · ● your tee time' : ''}</div>`;
  const a = Math.max(CAP - 4, 0), lo = Math.max(idx - 1, a), hi = Math.min(idx + 1, ranked.length - 1), below = ranked.length - 1 - hi;
  return ranked.slice(0, a).map(line).join('') + '<div class="cb-dots">···</div>' + ranked.slice(lo, hi + 1).map(line).join('') + (below ? `<div class="cb-k" style="padding-top:1.4cqw">+ ${below} more played${TEE.includes(who) ? ' · ● your tee time' : ''}</div>` : '');
}
const mixBack = (who, line) => back('r4', `<div class="cb"><div class="cb-col cb-sm" style="gap:0"><div class="cb-k" style="padding-bottom:1.4cqw">16 played · Nov 7</div>${rows(who)}</div>${right('r4', line)}</div>`);
const TEE = ['Andrew', 'Alex', 'Chuck', 'Anthony'], CAP = 11;
/* as many ranked rows as fit; if you are below the cut, the top rows, a gap, then you with a neighbor either side */
function rows(who) {
  const idx = ranked.findIndex((x) => x[0] === who), line = (p) => `<div class="cb-pl${p[0] === who ? ' me' : ''}${p[0] !== who && TEE.includes(p[0]) && TEE.includes(who) ? ' tm' : ''}"><i>${p[2]}</i><span>${p[0]}</span><b>${p[1]}</b></div>`;
  if (idx < CAP) return ranked.slice(0, CAP).map(line).join('') + `<div class="cb-k" style="padding-top:1.4cqw">+ ${ranked.length - CAP} more played${TEE.includes(who) ? ' · ● your tee time' : ''}</div>`;
  const a = Math.max(CAP - 4, 0), lo = Math.max(idx - 1, a), hi = Math.min(idx + 1, ranked.length - 1), below = ranked.length - 1 - hi;
  return ranked.slice(0, a).map(line).join('') + '<div class="cb-dots">···</div>' + ranked.slice(lo, hi + 1).map(line).join('') + (below ? `<div class="cb-k" style="padding-top:1.4cqw">+ ${below} more played${TEE.includes(who) ? ' · ● your tee time' : ''}</div>` : '');
}
const mixBack = (who, line) => back('r4', `<div class="cb"><div class="cb-col cb-sm" style="gap:0"><div class="cb-k" style="padding-bottom:1.4cqw">16 played · Nov 7</div>${rows(who)}</div>${right('r4', line)}</div>`);
