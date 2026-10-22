// gps.js — the phone's position for the green card (feature 011). One watcher, on only while a
// screen that shows yardages is open and the page is visible; never asks for permission on load.
// `state()` → { status: 'off' | 'finding' | 'ok' | 'weak' | 'denied' | 'error', pos: [lat, lng] | null, acc: m | null }
import { yards } from './geo.js';

const WEAK_YD = 15; // 011: worse than about ±15 yd = "weak", numbers go muted

let watch = null;
let st = { status: 'off', pos: null, acc: null, at: 0 };
let onChange = null;

function set(next) { st = { ...st, ...next }; onChange?.(st); }

export const gps = {
  state: () => st,
  isOn: () => watch != null,
  /** Start watching (asks the phone once, the first time). `cb` runs on every change. */
  start(cb) {
    onChange = cb || onChange;
    if (watch != null) return;
    const geo = globalThis.navigator?.geolocation;
    if (!geo) { set({ status: 'error' }); return; }
    if (st.status !== 'ok' && st.status !== 'weak') set({ status: 'finding' });
    watch = geo.watchPosition(
      (p) => {
        const acc = p.coords.accuracy;
        set({ status: yards(acc) > WEAK_YD ? 'weak' : 'ok', pos: [p.coords.latitude, p.coords.longitude], acc, at: Date.now() });
      },
      (e) => { set({ status: e.code === 1 ? 'denied' : st.pos ? st.status : 'error' }); if (e.code === 1) gps.stop(false); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  },
  /** Stop watching. Keeps the last fix (greyed "updating" when it comes back) unless `clear`. */
  stop(clear = false) {
    if (watch != null) globalThis.navigator?.geolocation?.clearWatch(watch);
    watch = null;
    if (clear) set({ status: 'off', pos: null, acc: null });
    else if (st.status === 'finding') set({ status: 'off' });
  },
  /** Tests: push a fix / an error without a real phone. */
  _fake(fix) { if (fix?.error) { set({ status: fix.error }); return; } set({ status: yards(fix.acc) > WEAK_YD ? 'weak' : 'ok', pos: [fix.lat, fix.lng], acc: fix.acc, at: Date.now() }); },
};

if (typeof document !== 'undefined') {
  // iOS stops background location anyway; stop cleanly and resume when the page is back.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (watch != null) { gps.stop(); st.resume = true; } }
    else if (st.resume) { st.resume = false; gps.start(); }
  });
}
