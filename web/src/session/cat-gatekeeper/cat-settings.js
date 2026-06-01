/**
 * Cat Gatekeeper settings — persistent focus/break/bedtime configuration plus
 * the settings sheet UI. Pure storage helpers are exported separately so the
 * controller can read settings without pulling in DOM code.
 */

import { showSheet } from '../live/full-screen-sheet.js';

export const CAT_KEYS = {
  enabled: 'pi-web:v1:cat:enabled',
  focusMin: 'pi-web:v1:cat:focus-min',
  breakMin: 'pi-web:v1:cat:break-min',
  bedtime: 'pi-web:v1:cat:bedtime',
  sleepMin: 'pi-web:v1:cat:sleep-min',
};

export const CAT_DEFAULTS = {
  enabled: true,
  focusMin: 25,
  breakMin: 5,
  bedtime: '23:00',
  sleepMin: 2,
};

const LIMITS = {
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
    sleepMin: clampInt(read(CAT_KEYS.sleepMin), LIMITS.sleepMin, CAT_DEFAULTS.sleepMin),
  };
}

export function saveCatSettings(partial = {}, { storage = globalThis.localStorage } = {}) {
  const write = (key, value) => {
    try { storage?.setItem(key, String(value)); } catch { /* ignore */ }
  };
  if ('enabled' in partial) write(CAT_KEYS.enabled, !!partial.enabled);
  if ('focusMin' in partial) write(CAT_KEYS.focusMin, clampInt(partial.focusMin, LIMITS.focusMin, CAT_DEFAULTS.focusMin));
  if ('breakMin' in partial) write(CAT_KEYS.breakMin, clampInt(partial.breakMin, LIMITS.breakMin, CAT_DEFAULTS.breakMin));
  if ('bedtime' in partial) write(CAT_KEYS.bedtime, normalizeBedtime(partial.bedtime));
  if ('sleepMin' in partial) write(CAT_KEYS.sleepMin, clampInt(partial.sleepMin, LIMITS.sleepMin, CAT_DEFAULTS.sleepMin));
  return loadCatSettings({ storage });
}

/**
 * Open the Cat Gatekeeper settings sheet. `controller` (optional) provides live
 * status: getStatusText() and skipToBreak() power the "next break" row.
 */
export function showCatSettings({
  documentImpl = document,
  windowImpl = window,
  storage = windowImpl.localStorage,
  onChange = () => {},
  controller = null,
} = {}) {
  const settings = loadCatSettings({ storage });

  return showSheet({
    title: 'Cat Gatekeeper',
    showBack: true,
    showClose: false,
    documentImpl,
    windowImpl,
    renderBody: ({ bodyEl }) => {
      const root = documentImpl.createElement('div');
      root.className = 'cat-settings';

      const field = (labelText, control, hint) => {
        const row = documentImpl.createElement('label');
        row.className = 'cat-settings-row';
        const text = documentImpl.createElement('div');
        text.className = 'cat-settings-label';
        text.textContent = labelText;
        if (hint) {
          const h = documentImpl.createElement('div');
          h.className = 'cat-settings-hint';
          h.textContent = hint;
          text.appendChild(h);
        }
        row.appendChild(text);
        row.appendChild(control);
        return row;
      };

      const numberInput = (key, value) => {
        const input = documentImpl.createElement('input');
        input.type = 'number';
        input.className = 'cat-settings-number';
        input.min = String(LIMITS[key].min);
        input.max = String(LIMITS[key].max);
        input.value = String(value);
        input.addEventListener('change', () => {
          const next = saveCatSettings({ [key]: input.value }, { storage });
          input.value = String(next[key]);
          onChange(next);
        });
        return input;
      };

      // Master toggle
      const toggle = documentImpl.createElement('input');
      toggle.type = 'checkbox';
      toggle.className = 'cat-settings-toggle';
      toggle.checked = settings.enabled;
      toggle.addEventListener('change', () => {
        const next = saveCatSettings({ enabled: toggle.checked }, { storage });
        onChange(next);
      });
      root.appendChild(field('Enable Cat Gatekeeper', toggle, 'A cat appears when it is time to rest.'));

      root.appendChild(field('Focus time (minutes)', numberInput('focusMin', settings.focusMin), 'Uninterrupted work before the cat appears.'));
      root.appendChild(field('Break time (minutes)', numberInput('breakMin', settings.breakMin), 'How long the cat keeps you away.'));

      const bedtime = documentImpl.createElement('input');
      bedtime.type = 'time';
      bedtime.className = 'cat-settings-time';
      bedtime.value = settings.bedtime;
      bedtime.addEventListener('change', () => {
        const next = saveCatSettings({ bedtime: bedtime.value }, { storage });
        bedtime.value = next.bedtime;
        onChange(next);
      });
      root.appendChild(field('Bedtime', bedtime, 'When the cat says goodnight.'));

      root.appendChild(field('Sleep reminder (minutes)', numberInput('sleepMin', settings.sleepMin), 'How long the sleepy cat stays before locking.'));

      // Live status: next break + skip-to-break.
      if (controller) {
        const statusRow = documentImpl.createElement('div');
        statusRow.className = 'cat-settings-status';

        const statusText = documentImpl.createElement('div');
        statusText.className = 'cat-settings-status-text';
        const updateStatus = () => { statusText.textContent = controller.getStatusText?.() || ''; };
        updateStatus();

        const skipBtn = documentImpl.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'cat-settings-skip';
        skipBtn.textContent = 'Take a break now';
        skipBtn.addEventListener('click', () => {
          controller.skipToBreak?.();
          updateStatus();
        });

        statusRow.appendChild(statusText);
        statusRow.appendChild(skipBtn);
        root.appendChild(statusRow);

        const timer = windowImpl.setInterval(updateStatus, 1000);
        root.addEventListener('cat-sheet-closed', () => windowImpl.clearInterval(timer), { once: true });
      }

      return root;
    },
    onClose: () => {
      // Stop the status interval when the sheet closes.
      const body = documentImpl.querySelector('.cat-settings');
      body?.dispatchEvent?.(new windowImpl.Event('cat-sheet-closed'));
    },
  });
}
