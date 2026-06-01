import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  CAT_DEFAULTS,
  loadCatSettings,
  saveCatSettings,
  normalizeBedtime,
  showCatSettings,
} from './cat-settings.js';

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('cat settings storage', () => {
  it('returns defaults when storage is empty', () => {
    expect(loadCatSettings({ storage: makeStorage() })).toEqual(CAT_DEFAULTS);
  });

  it('round-trips saved values', () => {
    const storage = makeStorage();
    saveCatSettings({ enabled: false, focusMin: 50, breakMin: 10, bedtime: '22:30', sleepMin: 3 }, { storage });
    expect(loadCatSettings({ storage })).toEqual({
      enabled: false, focusMin: 50, breakMin: 10, bedtime: '22:30', sleepMin: 3,
    });
  });

  it('clamps out-of-range numbers to limits', () => {
    const storage = makeStorage();
    saveCatSettings({ focusMin: 9999, breakMin: 0, sleepMin: -4 }, { storage });
    const s = loadCatSettings({ storage });
    expect(s.focusMin).toBe(240);
    expect(s.breakMin).toBe(1);
    expect(s.sleepMin).toBe(1);
  });

  it('falls back to default for invalid stored values', () => {
    const storage = makeStorage({
      'pi-web:v1:cat:focus-min': 'abc',
      'pi-web:v1:cat:bedtime': 'not-a-time',
    });
    const s = loadCatSettings({ storage });
    expect(s.focusMin).toBe(CAT_DEFAULTS.focusMin);
    expect(s.bedtime).toBe(CAT_DEFAULTS.bedtime);
  });

  it('normalizes bedtime strings', () => {
    expect(normalizeBedtime('9:5')).toBe(CAT_DEFAULTS.bedtime); // bad minutes format
    expect(normalizeBedtime('9:05')).toBe('09:05');
    expect(normalizeBedtime('23:59')).toBe('23:59');
    expect(normalizeBedtime('24:00')).toBe(CAT_DEFAULTS.bedtime);
    expect(normalizeBedtime('foo')).toBe(CAT_DEFAULTS.bedtime);
  });
});

describe('cat settings sheet', () => {
  it('renders the form and persists the enable toggle', () => {
    const dom = new JSDOM('<body></body>');
    const storage = makeStorage();
    const win = dom.window;

    showCatSettings({ documentImpl: win.document, windowImpl: win, storage });

    const root = win.document.querySelector('.cat-settings');
    expect(root).not.toBeNull();

    const toggle = win.document.querySelector('.cat-settings-toggle');
    expect(toggle.checked).toBe(true);
    toggle.checked = false;
    toggle.dispatchEvent(new win.Event('change'));
    expect(loadCatSettings({ storage }).enabled).toBe(false);
  });
});
