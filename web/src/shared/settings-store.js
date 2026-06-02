/**
 * Write-through cache for server-backed user settings.
 *
 * The server (pi-web.sqlite `settings` table) is the source of truth. These
 * keys are mirrored into localStorage so the UI can read them synchronously and
 * paint without waiting on the network, but every change is written through to
 * the server so it survives a restart and is shared across browsers hitting the
 * same instance.
 *
 * Per-window / live-timer / ephemeral state (sidebar widths, focus countdown,
 * tree toggle state, collapsed groups) is intentionally NOT listed here — it
 * stays in localStorage only and is never synced.
 */

// The localStorage keys that are server-backed. Mirrors settingDefaults in
// internal/server/settings.go.
export const SERVER_SETTING_KEYS = [
  'pi-web-theme',
  'pi-web:v1:font-ui',
  'pi-web:v1:font-content',
  'pi-web:v1:font-ui-size',
  'pi-web:v1:font-content-size',
  'pi-sessions:spinner-style',
  'pi-share:v1:notify-on-done',
  'pi-share:v1:done-sound',
  'pi-sessions:view-layout',
  'pi-web:v1:cat:enabled',
  'pi-web:v1:cat:focus-min',
  'pi-web:v1:cat:break-min',
  'pi-web:v1:cat:bedtime',
  'pi-web:v1:cat:wakeup',
  'pi-web:v1:cat:sleep-min',
];

// Network sync is disabled until a page entrypoint configures it. This keeps
// unit tests (which exercise the pure setters with a fake storage) free of
// network calls.
let syncFetch = null;

export function configureSettingsSync({ fetchImpl } = {}) {
  syncFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
}

export function resetSettingsSyncForTests() {
  syncFetch = null;
}

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function postSettings(settings) {
  if (!syncFetch) return;
  try {
    const p = syncFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ settings }),
    });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // best-effort; localStorage already holds the value
  }
}

/**
 * Write a single server-backed setting: update the localStorage cache and push
 * it to the server. Unknown keys are written locally but not synced.
 */
export function writeSetting(key, value, { storage = defaultStorage() } = {}) {
  const str = String(value);
  try {
    storage?.setItem(key, str);
  } catch {
    // ignore quota/availability errors
  }
  if (SERVER_SETTING_KEYS.includes(key)) {
    postSettings({ [key]: str });
  }
}

/**
 * Write several settings at once (single POST).
 */
export function writeSettings(values, { storage = defaultStorage() } = {}) {
  const toSync = {};
  for (const [key, value] of Object.entries(values || {})) {
    const str = String(value);
    try {
      storage?.setItem(key, str);
    } catch {
      // ignore
    }
    if (SERVER_SETTING_KEYS.includes(key)) toSync[key] = str;
  }
  if (Object.keys(toSync).length > 0) postSettings(toSync);
}

/**
 * Pull server-backed settings from the server and seed the localStorage cache.
 * Call once on page load. Resolves to the settings object (or null on failure).
 * Writes are done directly to storage (not via writeSetting) so hydration does
 * not echo the values straight back to the server.
 */
export async function hydrateSettings({ fetchImpl = syncFetch, storage = defaultStorage() } = {}) {
  if (!fetchImpl) return null;
  try {
    const resp = await fetchImpl('/api/settings', { headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const settings = data && data.settings ? data.settings : null;
    if (!settings) return null;
    for (const key of SERVER_SETTING_KEYS) {
      if (key in settings && settings[key] != null) {
        try {
          storage?.setItem(key, String(settings[key]));
        } catch {
          // ignore
        }
      }
    }
    return settings;
  } catch {
    return null;
  }
}
