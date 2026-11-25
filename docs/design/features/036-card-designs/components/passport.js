/* 036 component: passport book page turn + milestone stamp markup.
   Extracted from the approved prototype reveal-back-book.html, passport-booklet.html (docs/design/features/036-card-designs/).
   Reference code: port it into the app's own files; names may change. */

const NAMES = ['Cover · tap to open', 'You · page 1 of 3', 'Courses · page 2 of 3', 'Milestones · page 3 of 3'];
function showPage() { document.querySelectorAll('#book .pg').forEach((p, i) => p.classList.toggle('turned', i < state.pg)); document.getElementById('bkn').textContent = NAMES[state.pg]; }

/* page turn input */
  const out = document.getElementById('out'); let x0 = null;
  const turn = (d) => { state.pg = Math.max(0, Math.min(3, state.pg + d)); showPage(); };
  out.addEventListener('pointerdown', (e) => { if (e.target.closest('#book')) x0 = e.clientX; });
  out.addEventListener('pointerup', (e) => { const bk = e.target.closest('#book'); if (!bk || x0 == null) { x0 = null; return; } const dx = e.clientX - x0, r = bk.getBoundingClientRect(); x0 = null;
    if (Math.abs(dx) > 30) turn(dx < 0 ? 1 : -1); else turn(e.clientX - r.left > r.width * .4 ? 1 : -1); });

/* milestone rubber stamp */
const rubber = (m, night) => `<button class="pp-rs" data-stamp style="--ink:${night ? m.lite : m.ink};--r:${m.r}deg;${m.rad ? `--rad:${m.rad};` : ''}"><b>${m.t}</b><span>${m.s}</span></button>`;
