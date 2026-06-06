// Lightweight i18n for pi-web. `t(key, params)` resolves the active locale,
// falling back to English and then the key itself, with {param} interpolation.
//
// It deliberately avoids a framework so it works identically in Svelte
// ({t('key')}) and in the vanilla-JS runtime (el.textContent = t('key')), and
// bundles into the server-less export. The locale is a manual setting
// (pi-web:v1:locale, default English); changing it reloads the page so all
// chrome — Svelte and the once-rendered vanilla-JS DOM alike — re-renders.
import en from './locales/en.js';
import es from './locales/es.js';
import fr from './locales/fr.js';
import de from './locales/de.js';
import zh from './locales/zh.js';
import ja from './locales/ja.js';
import id from './locales/id.js';
import ms from './locales/ms.js';
import vi from './locales/vi.js';
import th from './locales/th.js';
import fil from './locales/fil.js';
import my from './locales/my.js';
import km from './locales/km.js';
import lo from './locales/lo.js';

export const LOCALE_KEY = 'pi-web:v1:locale';
export const CUSTOM_LANGUAGES_KEY = 'pi-web:v1:custom-languages';
const DEFAULT_LOCALE = 'en';

// Built-in locales. `en` is the source of truth and the universal fallback.
const BUILTIN = {
  en: { label: 'English', strings: en },
  es: { label: 'Español', strings: es },
  fr: { label: 'Français', strings: fr },
  de: { label: 'Deutsch', strings: de },
  zh: { label: '中文', strings: zh },
  ja: { label: '日本語', strings: ja },
  id: { label: 'Bahasa Indonesia', strings: id },
  ms: { label: 'Bahasa Melayu', strings: ms },
  vi: { label: 'Tiếng Việt', strings: vi },
  th: { label: 'ไทย', strings: th },
  fil: { label: 'Filipino', strings: fil },
  my: { label: 'မြန်မာ', strings: my },
  km: { label: 'ភាសាខ្មែរ', strings: km },
  lo: { label: 'ລາວ', strings: lo },
};

// code -> { label, strings, custom? }. User-defined locales are merged in.
const registry = { ...BUILTIN };
let active = null; // resolved lazily from storage on first use

function lsGet(key, storageImpl) {
  try {
    const s = storageImpl || (typeof localStorage !== 'undefined' ? localStorage : null);
    return s ? s.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Parse the pi-web:v1:custom-languages setting into [{ code, label, strings }]. */
export function readCustomLanguages(storageImpl) {
  const raw = lsGet(CUSTOM_LANGUAGES_KEY, storageImpl);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** Merge user-defined locales into the registry so they are selectable + usable. */
export function registerCustomLocales(list) {
  for (const loc of Array.isArray(list) ? list : []) {
    const code = loc && typeof loc.code === 'string' ? loc.code.trim() : '';
    if (!code) continue;
    registry[code] = {
      label: (loc.label || code).toString().trim() || code,
      strings: loc.strings && typeof loc.strings === 'object' ? loc.strings : {},
      custom: true,
    };
  }
}

/** Active locale code from storage, validated against the registry. */
export function getLocale(storageImpl) {
  const code = lsGet(LOCALE_KEY, storageImpl) || DEFAULT_LOCALE;
  return registry[code] ? code : DEFAULT_LOCALE;
}

function ensureInit() {
  if (active !== null) return;
  registerCustomLocales(readCustomLanguages());
  active = getLocale();
}

/** Translate a key. Falls back: active locale → English → the key itself. */
export function t(key, params) {
  ensureInit();
  const dict = registry[active]?.strings || en;
  let str = key in dict ? dict[key] : key in en ? en[key] : key;
  if (params && typeof str === 'string') {
    str = str.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  }
  return str;
}

/** Locales available for the picker: built-ins plus any custom ones. */
export function availableLocales() {
  ensureInit();
  return Object.entries(registry).map(([code, v]) => ({ code, label: v.label, custom: !!v.custom }));
}

/** The full English key → string map, for the "Copy English keys" template. */
export function englishTemplate() {
  return { ...en };
}

/** Reset cached state (after a settings change, or in tests). */
export function resetI18n() {
  for (const code of Object.keys(registry)) {
    if (!(code in BUILTIN)) delete registry[code];
  }
  active = null;
}
