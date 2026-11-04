// Feature 020: the loading screen's timing (pure parts of js/loader.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { lapWait, loaderState, loaderText, LAP_MS } from '../js/loader.js';

test('020 loading screen: finish the lap, then the states at 1.5 s / 8 s / No signal', () => {
  // The ball always gets back to the top-right before it drops: wait 1000 − (elapsed mod 1000).
  assert.equal(lapWait(300), 700);
  assert.equal(lapWait(2950), 50);
  assert.equal(lapWait(0), LAP_MS); // even an instant "ready" shows one full lap
  // Home launch: never any text. Opening a round: Opening → Still connecting. Error: No signal.
  assert.equal(loaderState(9000, { loading: false }), 'boot');
  assert.equal(loaderState(1499, { loading: true }), 'boot');
  assert.equal(loaderState(1500, { loading: true }), 'opening');
  assert.equal(loaderState(8000, { loading: true }), 'slow');
  assert.equal(loaderState(200, { loading: false, error: true }), 'nosignal');
  assert.match(loaderText('opening', 'TC482'), /Opening TC482…/);
  assert.match(loaderText('nosignal'), /No signal[\s\S]*data-act="retry-load"[^>]*>Try again/);
  assert.equal(loaderText('boot'), '');
});
