// Whole-UI scale ("tamanho da fonte") — important for the iPhone standalone
// PWA where browser zoom / text size isn't available. Implemented with CSS
// `zoom` on <html> (the stylesheets are px-based, so root font-size alone would
// not scale them). Viewport units are scaled by zoom too, so every 100vh/svh/dvh
// in the embedded CSS goes through --zc-vh/--zc-svh/--zc-dvh, which we set to
// 100vh divided by the *measured* factor (works for both Chromium's
// standardized zoom and WebKit). Persisted server-side like the theme.
import { writeSetting } from './settings-store.js';

export const UI_SCALE_KEY = 'pi-web:v1:ui-scale';
export const UI_SCALE_STEPS = [80, 90, 100, 110, 120, 130, 140, 150];
export const UI_SCALE_EVENT = 'pi:ui-scale-change';

export function clampScale(v) {
  const n = Math.round(Number(v) / 10) * 10;
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(150, Math.max(80, n));
}

export function currentScale(doc = document) {
  return clampScale(doc.documentElement.dataset.uiScale || 100);
}

/** Rendered px per CSS px under the current zoom (1 when not zoomed). */
export function lengthFactor(win = typeof window !== 'undefined' ? window : undefined) {
  return (win && win.__zcLenFactor) || 1;
}

function measure(doc) {
  const win = doc.defaultView;
  const root = doc.documentElement;
  const body = doc.body;
  if (!win || !body) return;
  const probe = doc.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:100px;height:100vh;visibility:hidden;pointer-events:none;zoom:normal';
  body.appendChild(probe);
  const r = probe.getBoundingClientRect();
  probe.remove();
  const lf = r.width > 0 ? r.width / 100 : 1;
  const vf = win.innerHeight > 0 && r.height > 0 ? r.height / win.innerHeight : 1;
  win.__zcLenFactor = Math.abs(lf - 1) < 0.01 ? 1 : lf;
  const f = Math.abs(vf - 1) < 0.01 ? 1 : vf;
  if (f === 1) {
    root.style.removeProperty('--zc-vh');
    root.style.removeProperty('--zc-svh');
    root.style.removeProperty('--zc-dvh');
  } else {
    root.style.setProperty('--zc-vh', `calc(100vh / ${f.toFixed(4)})`);
    root.style.setProperty('--zc-svh', `calc(100svh / ${f.toFixed(4)})`);
    root.style.setProperty('--zc-dvh', `calc(100dvh / ${f.toFixed(4)})`);
  }
}

export function applyUiScale(value, { doc = document, persist = true } = {}) {
  const v = clampScale(value);
  const root = doc.documentElement;
  if (v === 100) {
    delete root.dataset.uiScale;
    root.style.removeProperty('zoom');
  } else {
    root.dataset.uiScale = String(v);
    root.style.zoom = String(v / 100);
  }
  measure(doc);
  if (persist) writeSetting(UI_SCALE_KEY, String(v));
  try {
    localStorage.setItem(UI_SCALE_KEY, String(v));
  } catch {}
  try {
    const win = doc.defaultView;
    win?.dispatchEvent(new CustomEvent(UI_SCALE_EVENT, { detail: v }));
    win?.dispatchEvent(new Event('resize'));
    win?.visualViewport?.dispatchEvent?.(new Event('resize'));
  } catch {}
  return v;
}

export function stepUiScale(dir, opts) {
  const cur = currentScale(opts?.doc);
  const i = UI_SCALE_STEPS.indexOf(cur);
  const next = UI_SCALE_STEPS[Math.min(UI_SCALE_STEPS.length - 1, Math.max(0, (i < 0 ? 2 : i) + dir))];
  return applyUiScale(next, opts);
}

let booted = false;
/** Boot: honour the server-injected value (or localStorage), install shortcuts. */
export function bootUiScale(doc = document) {
  if (booted) return;
  booted = true;
  let v = doc.documentElement.dataset.uiScale;
  if (!v) {
    try {
      v = localStorage.getItem(UI_SCALE_KEY) || '';
    } catch {}
  }
  applyUiScale(v || 100, { doc, persist: false });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => measure(doc));
  const win = doc.defaultView;
  // Desktop shortcuts: Ctrl/Cmd + Alt + (= | - | 0). Uses e.code so the macOS
  // Option key doesn't change the character.
  win?.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || !e.altKey) return;
    if (e.code === 'Equal' || e.code === 'NumpadAdd') stepUiScale(1, { doc });
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') stepUiScale(-1, { doc });
    else if (e.code === 'Digit0' || e.code === 'Numpad0') applyUiScale(100, { doc });
    else return;
    e.preventDefault();
  });
  win?.addEventListener('resize', () => measure(doc), { passive: true });
}
