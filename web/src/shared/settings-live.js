import { applyFonts } from './fonts.js';
import { applySettingsFromServer } from './settings-store.js';
import { applyUiScale, currentScale, UI_SCALE_KEY } from './ui-scale.js';

const LOCALE_KEY = 'pi-web:v1:locale';
const CUSTOM_LANGUAGES_KEY = 'pi-web:v1:custom-languages';

function readStored(storage, key) {
  try {
    return storage?.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Apply a settings SSE payload the same way the Settings UI does:
 * theme and fonts update live; locale/custom-languages reload the page
 * because i18n chrome is not reactive (see i18n.js).
 */
export function applyRemoteSettings(
  payload,
  { storage, documentImpl, windowImpl, reload = (win) => win?.location?.reload?.() } = {},
) {
  const settings = payload?.settings;
  const prevLocale = readStored(storage, LOCALE_KEY);
  const prevCustom = readStored(storage, CUSTOM_LANGUAGES_KEY);
  const applied = applySettingsFromServer(settings, { storage });
  if (!applied) return null;

  const theme = applied['pi-web-theme'];
  if (theme && documentImpl?.documentElement) {
    documentImpl.documentElement.dataset.theme = theme;
    try {
      documentImpl.cookie = `pi-web-theme=${theme};path=/;SameSite=Lax;max-age=31536000`;
    } catch {
      // ignore
    }
  }

  if (documentImpl) {
    applyFonts(documentImpl, {
      ui: applied['pi-web:v1:font-ui'],
      content: applied['pi-web:v1:font-content'],
      code: applied['pi-web:v1:font-code'],
      uiSize: applied['pi-web:v1:font-ui-size'],
      contentSize: applied['pi-web:v1:font-content-size'],
    });
  }

  const scale = applied[UI_SCALE_KEY];
  if (scale != null && documentImpl?.documentElement) {
    try {
      if (Number(scale) !== currentScale(documentImpl)) applyUiScale(scale, { doc: documentImpl, persist: false });
    } catch {
      // ignore
    }
  }

  const nextLocale = applied[LOCALE_KEY];
  const nextCustom = applied[CUSTOM_LANGUAGES_KEY];
  const localeChanged = nextLocale != null && String(nextLocale) !== String(prevLocale ?? '');
  const customChanged = nextCustom != null && String(nextCustom) !== String(prevCustom ?? '');
  if (localeChanged || customChanged) {
    reload(windowImpl);
  }
  return applied;
}
