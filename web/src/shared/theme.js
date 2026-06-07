import { writeSetting } from './settings-store.js';
import { setThemeIconElement } from './icons.js';

// Body/chrome background colors per theme, kept in sync with the inline boot
// scripts in internal/ui/live_page.go. The boot script sets an inline
// background-color on <html> before first paint; applyTheme must update that
// same inline style on a live theme switch, otherwise the page surround keeps
// the previous theme's color until the next reload.
const BODY_BGS = { dark: '#111116', light: '#f6f5f2', nord: '#2e3440', dracula: '#282a36' };
const CHROME_BGS = { dark: '#0f0f14', light: '#ddddda', nord: '#292f3a', dracula: '#242631' };

function readThemeBg(windowImpl, documentImpl) {
  try {
    const cs = windowImpl.getComputedStyle(documentImpl.documentElement);
    return cs.getPropertyValue('--body-bg').trim() || '';
  } catch (e) {
    return '';
  }
}

export function applyTheme(windowImpl, documentImpl, next) {
  next = next || 'dark';
  documentImpl.documentElement.dataset.theme = next;
  writeSetting('pi-web-theme', next, { storage: windowImpl.localStorage });
  try { documentImpl.cookie = 'pi-web-theme=' + next + ';path=/;SameSite=Lax;max-age=31536000'; } catch (e) {}

  const wco = !!(windowImpl.navigator
    && windowImpl.navigator.windowControlsOverlay
    && windowImpl.navigator.windowControlsOverlay.visible);
  // Built-in themes have a hardcoded background; the user-defined custom theme
  // (loaded via /custom-themes.css) instead exposes its background through the
  // --body-bg CSS variable, so read it back after the data-theme switch.
  const color = (wco ? CHROME_BGS : BODY_BGS)[next]
    || readThemeBg(windowImpl, documentImpl)
    || BODY_BGS.dark;
  try { documentImpl.documentElement.style.backgroundColor = color; } catch (e) {}
  const meta = documentImpl.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = color;
}

export function toggleTheme(windowImpl, documentImpl) {
  const themes = ['dark', 'light', 'nord', 'dracula', 'custom'];
  const current = documentImpl.documentElement.dataset.theme || 'dark';
  let idx = themes.indexOf(current);
  if (idx === -1) idx = 0;
  const next = themes[(idx + 1) % themes.length];
  applyTheme(windowImpl, documentImpl, next);
}

export function syncThemeIcons(documentImpl) {
  const current = documentImpl.documentElement.dataset.theme || 'dark';
  documentImpl.querySelectorAll('[data-command-theme-icon]').forEach((el) => {
    setThemeIconElement(el, current, { documentImpl });
  });
  documentImpl.querySelectorAll('[data-theme-icon]').forEach((el) => {
    setThemeIconElement(el, current, { documentImpl });
  });
}
