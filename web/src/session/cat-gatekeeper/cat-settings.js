/**
 * Cat Gatekeeper settings — persistent focus/break/bedtime storage helpers.
 * The settings sheet UI now lives in components/session/CatGatekeeperSettings.svelte
 * (Svelte migration Phase 3); this module is the framework-free storage layer
 * shared by the controller and that component.
 */

import { writeSetting } from '../../shared/settings-store.js';

export const CAT_KEYS = {
  enabled: 'pi-web:v1:cat:enabled',
  focusMin: 'pi-web:v1:cat:focus-min',
  breakMin: 'pi-web:v1:cat:break-min',
  bedtime: 'pi-web:v1:cat:bedtime',
  wakeup: 'pi-web:v1:cat:wakeup',
  sleepMin: 'pi-web:v1:cat:sleep-min',
};

export const CAT_DEFAULTS = {
  enabled: true,
  focusMin: 25,
  breakMin: 5,
  bedtime: '23:00',
  wakeup: '07:00',
  sleepMin: 5,
};

export const LIMITS = {
  focusMin: { min: 1, max: 240 },
  breakMin: { min: 1, max: 120 },
  sleepMin: { min: 1, max: 60 },
};

function clampInt(value, { min, max }, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Accepts "HH:MM" 24-hour time; returns a normalized string or the fallback.
export function normalizeBedtime(value, fallback = CAT_DEFAULTS.bedtime) {
  if (typeof value !== 'string') return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function loadCatSettings({ storage = globalThis.localStorage } = {}) {
  const read = (key) => {
    try { return storage?.getItem(key); } catch { return null; }
  };
  const enabledRaw = read(CAT_KEYS.enabled);
  return {
    enabled: enabledRaw === null ? CAT_DEFAULTS.enabled : enabledRaw === 'true',
    focusMin: clampInt(read(CAT_KEYS.focusMin), LIMITS.focusMin, CAT_DEFAULTS.focusMin),
    breakMin: clampInt(read(CAT_KEYS.breakMin), LIMITS.breakMin, CAT_DEFAULTS.breakMin),
    bedtime: normalizeBedtime(read(CAT_KEYS.bedtime)),
    wakeup: normalizeBedtime(read(CAT_KEYS.wakeup), CAT_DEFAULTS.wakeup),
    sleepMin: clampInt(read(CAT_KEYS.sleepMin), LIMITS.sleepMin, CAT_DEFAULTS.sleepMin),
  };
}

export function saveCatSettings(partial = {}, { storage = globalThis.localStorage } = {}) {
  const write = (key, value) => {
    writeSetting(key, String(value), { storage });
  };
  if ('enabled' in partial) write(CAT_KEYS.enabled, !!partial.enabled);
  if ('focusMin' in partial) write(CAT_KEYS.focusMin, clampInt(partial.focusMin, LIMITS.focusMin, CAT_DEFAULTS.focusMin));
  if ('breakMin' in partial) write(CAT_KEYS.breakMin, clampInt(partial.breakMin, LIMITS.breakMin, CAT_DEFAULTS.breakMin));
  if ('bedtime' in partial) write(CAT_KEYS.bedtime, normalizeBedtime(partial.bedtime));
  if ('wakeup' in partial) write(CAT_KEYS.wakeup, normalizeBedtime(partial.wakeup, CAT_DEFAULTS.wakeup));
  if ('sleepMin' in partial) write(CAT_KEYS.sleepMin, clampInt(partial.sleepMin, LIMITS.sleepMin, CAT_DEFAULTS.sleepMin));
  return loadCatSettings({ storage });
}
