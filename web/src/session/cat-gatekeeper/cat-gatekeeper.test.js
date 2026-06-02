import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupCatGatekeeper } from './cat-gatekeeper.js';
import { saveCatSettings } from './cat-settings.js';

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// Build a harness with a controllable clock and active/visibility state.
function harness({ hour = 10, minute = 0, settings } = {}) {
  const dom = new JSDOM('<body></body>');
  const doc = dom.window.document;
  const storage = makeStorage();
  if (settings) saveCatSettings(settings, { storage });

  const base = new Date(2026, 4, 31, hour, minute, 0).getTime();
  const clock = { ms: 0 };
  const nowFn = () => base + clock.ms;

  const focusState = { active: true };
  Object.defineProperty(doc, 'hidden', { value: false, configurable: true });
  doc.hasFocus = () => focusState.active;

  const controller = setupCatGatekeeper({
    documentImpl: doc,
    windowImpl: dom.window,
    storage,
    nowFn,
    setIntervalImpl: () => 0,
    clearIntervalImpl: () => {},
    requestAnimationFrameImpl: (cb) => cb(),
  });

  const advance = (ms) => { clock.ms += ms; };
  const tick = (ms = 1000) => { advance(ms); controller.tick(); };
  const overlay = () => doc.getElementById('cat-gatekeeper-overlay');

  return { dom, doc, storage, controller, focusState, advance, tick, overlay };
}

describe('cat gatekeeper timer', () => {
  it('decrements focus only while active', () => {
    const h = harness({ settings: { focusMin: 25, breakMin: 5 } });
    h.controller.start();

    h.focusState.active = false;
    const before = h.controller.getState().focusRemainingMs;
    h.tick(2000);
    expect(h.controller.getState().focusRemainingMs).toBe(before);

    h.focusState.active = true;
    h.tick(2000);
    expect(h.controller.getState().focusRemainingMs).toBe(before - 2000);
  });

  it('enters break when focus runs out and shows the countdown overlay', () => {
    const h = harness({ settings: { focusMin: 1, breakMin: 5 } });
    h.controller.start();

    // Drain 60s of focus in 2s clamped steps.
    for (let i = 0; i < 35; i++) h.tick(2000);

    expect(h.controller.getState().phase).toBe('break');
    const el = h.overlay();
    expect(el.classList.contains('cat-overlay--break')).toBe(true);
    expect(el.querySelector('[data-cat-timer]').textContent).toMatch(/^0[45]:/);
  });

  it('ends the break and resets focus after the break elapses', () => {
    const h = harness({ settings: { focusMin: 1, breakMin: 1 } });
    h.controller.start();
    h.controller.skipToBreak();
    expect(h.controller.getState().phase).toBe('break');

    h.tick(61_000); // longer than the 1-minute break
    expect(h.controller.getState().phase).toBe('focus');
    expect(h.controller.getState().focusRemainingMs).toBe(60_000);
    expect(h.overlay().classList.contains('visible')).toBe(false);
  });

  it('skipToBreak jumps straight to a break', () => {
    const h = harness({ settings: { focusMin: 25, breakMin: 5 } });
    h.controller.start();
    h.controller.skipToBreak();
    expect(h.controller.getState().phase).toBe('break');
  });

  it('does nothing when disabled', () => {
    const h = harness({ settings: { enabled: false, focusMin: 1 } });
    h.controller.start();
    for (let i = 0; i < 35; i++) h.tick(2000);
    expect(h.controller.getState().phase).toBe('focus');
    expect(h.overlay()).toBeNull();
  });

  it('persists remaining focus to storage', () => {
    const h = harness({ settings: { focusMin: 25 } });
    h.controller.start();
    h.tick(2000);
    const saved = Number(h.storage.getItem('pi-web:v1:cat:focus-remaining-ms'));
    expect(saved).toBeGreaterThan(0);
    expect(saved).toBeLessThanOrEqual(25 * 60000);
  });
});

describe('cat gatekeeper bedtime', () => {
  it('shows the sleepy cat at bedtime and locks after the reminder', () => {
    const h = harness({ hour: 23, minute: 0, settings: { bedtime: '23:00', sleepMin: 2 } });
    h.controller.start(); // immediate tick greets at/after bedtime

    expect(h.controller.getState().phase).toBe('sleep');
    const el = h.overlay();
    expect(el.classList.contains('cat-overlay--sleep')).toBe(true);
    expect(el.querySelector('[data-cat-message]').textContent).toBe('Time to sleep!');

    h.tick(2 * 60000 + 1000);
    expect(h.controller.getState().phase).toBe('sleep-locked');
    expect(el.querySelector('[data-cat-message]').textContent).toMatch(/Locked for the night/);
  });

  it('does not trigger bedtime outside the sleep window', () => {
    const h = harness({ hour: 10, minute: 0, settings: { bedtime: '23:00' } });
    h.controller.start();
    expect(h.controller.getState().phase).toBe('focus');
  });

  it('snoozes the soft warning once, then brings the cat back and locks', () => {
    const h = harness({ hour: 23, minute: 0, settings: { bedtime: '23:00', wakeup: '07:00', sleepMin: 2 } });
    h.controller.start();
    expect(h.controller.getState().phase).toBe('sleep');
    expect(h.overlay().querySelector('[data-cat-snooze]').style.display).not.toBe('none');

    // Click snooze: overlay dismisses and we wait out the 5-minute snooze.
    h.overlay().querySelector('[data-cat-snooze]').click();
    expect(h.controller.getState().phase).toBe('snooze');
    expect(h.controller.getState().snoozeUsed).toBe(true);
    expect(h.overlay().classList.contains('visible')).toBe(false);

    // After the snooze window, the sleepy cat returns (still bedtime).
    h.tick(5 * 60000 + 1000);
    expect(h.controller.getState().phase).toBe('sleep');
    // Snooze already used: the button is now hidden.
    expect(h.overlay().querySelector('[data-cat-snooze]').style.display).toBe('none');

    // A second snooze attempt is ignored.
    h.controller.snooze();
    expect(h.controller.getState().phase).toBe('sleep');

    // The reminder then locks as usual.
    h.tick(2 * 60000 + 1000);
    expect(h.controller.getState().phase).toBe('sleep-locked');
  });

  it('does not snooze once locked', () => {
    const h = harness({ hour: 23, minute: 0, settings: { bedtime: '23:00', sleepMin: 1 } });
    h.controller.start();
    h.tick(60_000 + 1000);
    expect(h.controller.getState().phase).toBe('sleep-locked');
    h.controller.snooze();
    expect(h.controller.getState().phase).toBe('sleep-locked');
  });
});
