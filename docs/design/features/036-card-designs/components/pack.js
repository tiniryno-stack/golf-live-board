/* 036 component: pack markup (packHtml) and the tear/open controller (wire).
   Extracted from the approved prototype chrome-packs-2.html (docs/design/features/036-card-designs/).
   Reference code: port it into the app's own files; names may change. */

const PACKS = {
  fine: ['Fine line', 'Very fine diagonal refractor lines, tight together, so the chrome reads as one surface with a grain.'],
  bold: ['Bold stripe', 'Wide diagonal bands of light and shade that slide across as you tilt.'],
  brushed: ['Brushed', 'Horizontal brushed steel, with one bright diagonal glint that travels with the tilt.'],
  wave: ['Wave', 'Rippling lines across the chrome, like water at the green\'s edge.'],
  shimmer: ['Shimmer', 'Fine vertical lines that brighten in a band where the light hits.'],
  speckle: ['Speckle', 'Tiny flecks of light scattered through the chrome, strongest where it tilts toward you.'],
  atomic: ['Atomic', 'A fine honeycomb mesh pressed into the chrome.'],
  sapphire: ['Sapphire', 'The fine-line refractor in a cool blue chrome.'],
};
const LAYERS = { fine: '<i class="pat p-fine"></i>', bold: '<i class="pat p-bold"></i>', brushed: '<i class="pat p-brushed"></i><i class="p-brushed2"></i>', wave: '<i class="pat p-wave"></i>', shimmer: '<i class="pat p-shimmer"></i>', speckle: '<i class="pat p-speckle"></i>', atomic: '<i class="pat p-atomic"></i>', sapphire: '<i class="pat p-pin"></i>' };
for (const k in LAYERS) LAYERS[k] += '<i class="refract"></i>';
const DARK = {};
const GLB = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="r" cx="42" cy="58" r="30" fill="none" stroke-width="13"/><circle class="b" cx="82" cy="20" r="11"/></svg>';
const face = () => `<div class="face"><div class="k">Scorecards · Series 1</div><span class="mk">${GLB}</span><div class="wm">Golf Live<br>Board<small>2026 Edition</small></div><span class="pill">1 Card</span></div>`;
const packHtml = (k) => { const top = LAYERS[k] + '<i class="sheen"></i>';
  return `<div class="pz bp chrome${k === 'sapphire' ? ' sapphire' : ''}"><div class="topw"><div class="top base">${top}</div><div class="top cutp">${top}</div></div>
  <div class="body">${LAYERS[k]}${face()}<i class="sheen"></i></div><i class="slit"></i><i class="spark"></i><i class="cue"></i><span class="cue-chip">Swipe to open</span></div>`; };

function wire() {
  const st = document.getElementById('stage'), pk = document.getElementById('pk'), shk = pk.querySelector('.shk'), bp = pk.querySelector('.bp');
  const base = bp.querySelector('.top.base'), cutp = bp.querySelector('.top.cutp');
  let p = 0, dir = 0, mode = null, raf = 0, last = 0, done = false, held = false;
  const set = (k, v) => bp.style.setProperty(k, v);
  /* p = how far the cut has run. Cut from the left: [0, p] is cut, hinged at p. From the right: [1 - p, 1], hinged at 1 - p. */
  const paint = () => {
    const a = dir < 0 ? 1 - p : 0, b = dir < 0 ? 1 : p, hx = dir < 0 ? a : b;
    set('--ta', a * 100 + '%'); set('--tw', (b - a) * 100 + '%'); set('--hx', hx * 100 + '%'); set('--fx', dir < 0 ? -1 : 1);
    set('--ang', (dir < 0 ? -1 : 1) * Math.min(6, 1.5 + p * 5) * (p > 0 ? 1 : 0) + 'deg'); set('--lift', -p * 10 + '%'); set('--curl', (p > 0 ? 12 + p * 18 : 0) + 'deg'); set('--lit', (1 + p * .12).toFixed(3));
    cutp.style.clipPath = `inset(-60% ${(1 - b) * 100}% 0 ${a * 100}%)`; base.style.clipPath = dir < 0 ? `inset(0 ${p * 100}% 0 0)` : `inset(0 0 0 ${p * 100}%)`;
    set('--ca', (dir < 0 ? 3 : Math.max(3, p * 100)) + '%'); set('--cb', (dir < 0 ? Math.max(3, p * 100) : 3) + '%');
    const j = mode === 'hold' ? p * p * 4 : 0; shk.style.transform = j ? `translate(${((Math.random() - .5) * j).toFixed(2)}px, ${((Math.random() - .5) * j).toFixed(2)}px)` : ''; };
  const finish = () => { if (done) return; done = true; p = 1; paint(); open(); };
  pk.addEventListener('pointerdown', (e) => { if (done) return; e.preventDefault(); pk.setPointerCapture(e.pointerId); const r = pk.getBoundingClientRect(), fy = (e.clientY - r.top) / r.height;
    mode = fy < .36 ? 'swipe' : 'hold'; held = true; st.classList.add('tearing');
    if (!dir) dir = mode === 'swipe' && (e.clientX - r.left) / r.width > .5 ? -1 : 1;
    if (mode === 'hold' && !raf) { last = 0; raf = requestAnimationFrame(tick); } });
  pk.addEventListener('pointermove', (e) => { if (!held || mode !== 'swipe' || done) return; const r = pk.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
    const q = Math.max(0, Math.min(1, dir < 0 ? 1 - fx : fx)); if (q > p) { p = q; paint(); } if (p > .94) finish(); });
  const up = () => { held = false; }; pk.addEventListener('pointerup', up); pk.addEventListener('pointercancel', up);
  const tick = (ts) => { const dt = Math.min(50, ts - (last || ts)); last = ts; if (held) { p = Math.min(1, p + dt / 1300); paint(); }
    if (p >= 1) { finish(); raf = 0; return; } if (held) raf = requestAnimationFrame(tick); else { raf = 0; shk.style.transform = ''; } };
  const after = (ms, f) => timers.push(setTimeout(f, ms));
  function open() {
    shk.style.transform = ''; st.classList.add('sep');
    after(650, () => st.classList.add('opened'));
    after(1650, () => st.classList.add('reveal'));
    const lands = [...st.querySelectorAll('.lands > *')];
    lands.forEach((el, i) => after(2550 + i * 420, () => el.classList.add('in')));
    after(2700 + lands.length * 420, () => st.classList.add('done'));
  }
  document.getElementById('again').onclick = () => render();
}
