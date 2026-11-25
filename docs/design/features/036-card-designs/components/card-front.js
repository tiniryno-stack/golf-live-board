/* 036 component: card front markup + finish styles + the tilt loop.
   Extracted from the approved prototype five-grades.html, dark-metals.html (docs/design/features/036-card-designs/).
   Reference code: port it into the app's own files; names may change. */

const lin = (a, b) => `linear-gradient(135deg, ${a} 0%, ${b} 50%, ${a} 100%)`;
const props = (base, ink, inv, sheen = .25) => `--m-base:${base};--m-ink:${ink};--m-soft:color-mix(in srgb, ${ink} 64%, transparent);--m-edge:color-mix(in srgb, ${ink} 30%, transparent);--m-inv:${inv};--m-emboss:0 -1px 0 rgba(0,0,0,.55);--m-sheen:${sheen};--m-grain:.5;`;
const HUE = 'calc(230 + var(--sx, 0) * 150)', PB = lin('#1a1b24', '#33344a');
const GRADE = {
  gold: props(lin('#4a3806', '#b0871a'), '#fff0b4', '#4a3806', .45),
  silver: props(lin('#2a3546', '#687a92'), '#f5f9ff', '#2a3546', .4),
  bronze: props(lin('#3a200f', '#80492344'.slice(0, 7)), '#ffc79a', '#3a200f', .35),
  standard: props(lin('#141518', '#26282d'), '#b4b9c1', '#141518', .2),
};
const PRS = {
  slick: ['Oil slick', 'White ink. Soft bands of color slide across the whole card as it tilts.', props(PB, '#f4f0ff', '#1a1b24'), '<i class="x-slick"></i>'],
  shift: ['Shift + soft flash', 'The ink changes color with the angle, and a faint streak crosses when it moves.', props(`linear-gradient(120deg, hsl(${HUE} 90% 60% / .2), transparent 62%), ${PB}`, `hsl(${HUE} 95% 82%)`, '#1a1b24'), '<i class="x-prism"></i>'],
  mix: ['Both', 'Oil slick bands under color-shifting ink, with the soft flash on top. Probably too much, but worth a look.', props(PB, `hsl(${HUE} 95% 84%)`, '#1a1b24'), '<i class="x-slick"></i><i class="x-prism"></i>'],
};

/* prismatic: oil slick bands (.x-slick) + colour-shifting ink (HUE above) + soft flash (.x-prism, opacity = --mv, the tilt speed).
   Every other grade: bands in its own metal colour (.x-mslick). Tilt loop: dark-metals.html start() (--sx, --sy, --mv). */
const card = (fin, style, layer = '') => `<div class="lk-slot lkf-${fin} x-land xm" style="${style}"><div class="lk-tilt"><div class="lk-flip"><div class="lk-face lk-front">
    <div class="lk-mat"><i class="lk-sheen"></i>${layer}<div class="x-l1">
      <div class="x-top"><span class="lk-brand">${MARK}Golf Live Board</span><span class="x-fin">${fin === 'standard' ? '' : FIN[fin]}</span></div>
      <div class="x-hero"><div class="x-gross">${C.gross}</div><div class="x-meta"><div class="x-course">${C.course}</div><div class="x-sub">${C.toPar} · ${C.day}</div><div class="x-stamps">${stamps(2)}</div></div></div>
      <div class="x-sc">${nine(0)}${nine(9)}</div>
      <div class="x-bot"><b>${C.name}</b><span>With the crew</span><span>No. ${C.n}</span></div></div></div>
  </div></div></div></div>`;

  let px = 0, py = 0, pAt = -1e9, cx = 0, cy = 0, mv = 0;
  document.getElementById('out').addEventListener('pointermove', (e) => { const s = e.target.closest('.lk-slot'); if (!s) return; const r = s.getBoundingClientRect();
    px = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1)); py = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1)); pAt = performance.now(); });
  const tick = (t) => {
    const held = t - pAt < 1400, tx = held ? px : still ? 0 : Math.sin(t / 1900) * .85, ty = held ? py * .6 : still ? 0 : Math.cos(t / 2600) * .5;
    const nx = cx + (tx - cx) * .16; cy += (ty - cy) * .16;
    mv = Math.max(mv * .93, Math.min(1, Math.abs(nx - cx) * 130)); cx = nx;
    page.style.setProperty('--sx', cx.toFixed(3)); page.style.setProperty('--sy', cy.toFixed(3)); page.style.setProperty('--mv', mv.toFixed(3));
    page.style.setProperty('--ry', (cx * 6).toFixed(2)); page.style.setProperty('--rx', (-cy * 3).toFixed(2)); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
