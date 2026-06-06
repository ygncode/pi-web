import { configureSettingsSync, hydrateSettings, writeSetting } from '../shared/settings-store.js';
import { applyTheme } from '../shared/theme.js';
import { applyFonts } from '../shared/fonts.js';
import { CUSTOM_LANGUAGES_KEY, englishTemplate, t } from '../shared/i18n.js';
import {
  fetchAvailableSounds,
  getSelectedSound,
  playDoneSound,
  setDoneNotifyEnabled,
  requestNotifyPermission,
  registerPushSubscription,
  unregisterPushSubscription,
} from '../session/chat/done-notifier.js';

export async function runSettingsPage({
  documentImpl = document,
  windowImpl = window,
} = {}) {
  const fetchImpl = windowImpl.fetch ? windowImpl.fetch.bind(windowImpl) : undefined;
  configureSettingsSync({ fetchImpl });

  const storage = windowImpl.localStorage;

  // Back button: return to wherever the user came from (e.g. a session detail
  // page) when they arrived from within the app, instead of always going home.
  setupBackLink(documentImpl, windowImpl);

  const savedHint = documentImpl.querySelector('[data-settings-saved]');
  let savedTimer = null;
  function flashSaved() {
    if (!savedHint) return;
    savedHint.classList.add('visible');
    windowImpl.clearTimeout(savedTimer);
    savedTimer = windowImpl.setTimeout(() => savedHint.classList.remove('visible'), 1200);
  }

  const controls = Array.from(documentImpl.querySelectorAll('[data-setting]'));

  // Populate the done-sound dropdown before applying stored values.
  const soundSelect = documentImpl.querySelector('[data-setting-sound]');
  if (soundSelect) {
    const data = await fetchAvailableSounds({ fetchImpl: fetchImpl || fetch });
    const sounds = data.sounds || ['cat.mp3', 'done.mp3'];
    soundSelect.innerHTML = '';
    for (const name of sounds) {
      const opt = documentImpl.createElement('option');
      opt.value = name;
      opt.textContent = name;
      soundSelect.appendChild(opt);
    }
  }

  // Populate the auto-title model dropdown before applying stored values, so
  // the persisted "provider/id" selection can be reflected.
  const titleModelSelect = documentImpl.querySelector('[data-auto-title-model]');
  if (titleModelSelect) {
    await populateModelSelect(titleModelSelect, { documentImpl, fetchImpl: fetchImpl || fetch });
  }

  // Pull the authoritative values from the server (falls back to the cache /
  // defaults the server returns) and reflect them in the controls.
  const settings = (await hydrateSettings({ fetchImpl, storage })) || readFromStorage(storage, controls);

  for (const el of controls) {
    const key = el.dataset.setting;
    const value = settings && key in settings ? settings[key] : storage?.getItem(key);
    if (value == null) continue;
    if (el.dataset.settingBool !== undefined) {
      el.checked = String(value) === 'true';
    } else {
      el.value = String(value);
    }
  }

  // Re-default the sound selector if the stored value is no longer available.
  if (soundSelect && !Array.from(soundSelect.options).some((o) => o.value === soundSelect.value)) {
    soundSelect.value = getSelectedSound({ storage });
  }

  for (const el of controls) {
    const key = el.dataset.setting;
    el.addEventListener('change', async () => {
      if (el.dataset.settingTheme !== undefined) {
        // applyTheme writes through (theme + cookie) and updates the DOM live.
        applyTheme(windowImpl, documentImpl, el.value);
      } else if (el.dataset.settingLocale !== undefined) {
        // Language affects strings baked into both Svelte and once-rendered
        // vanilla-JS DOM, so reload to re-render everything in the new locale.
        writeSetting(key, el.value, { storage });
        windowImpl.location.reload();
        return;
      } else if (el.dataset.settingSize !== undefined) {
        writeSetting(key, el.value, { storage });
        applyFonts(documentImpl, el.dataset.settingSize === 'ui'
          ? { uiSize: el.value }
          : { contentSize: el.value });
      } else if (el.dataset.settingNotify !== undefined) {
        await handleNotifyToggle(el);
      } else if (el.dataset.settingBool !== undefined) {
        writeSetting(key, el.checked ? 'true' : 'false', { storage });
      } else {
        writeSetting(key, el.value, { storage });
        if (el.dataset.settingSound !== undefined) {
          playDoneSound({ windowImpl, storage });
        }
      }
      flashSaved();
    });
  }

  setupCustomLanguages({ documentImpl, windowImpl, storage });

  // Font family controls (separate from the generic loop): a curated select
  // plus "Detect installed fonts…" (Local Font Access API) and "Custom…" paths.
  const FONT_KEYS = { ui: 'pi-web:v1:font-ui', content: 'pi-web:v1:font-content', code: 'pi-web:v1:font-code' };
  const fontControls = [];

  function injectDetectedFonts(select, families) {
    const old = select.querySelector('optgroup[data-detected]');
    if (old) old.remove();
    const group = documentImpl.createElement('optgroup');
    group.label = 'Installed';
    group.setAttribute('data-detected', '');
    for (const fam of families) {
      const opt = documentImpl.createElement('option');
      opt.value = fam;
      opt.textContent = fam;
      group.appendChild(opt);
    }
    const actions = select.querySelector('optgroup[label="Actions"]');
    select.insertBefore(group, actions);
  }

  async function detectInstalledFonts() {
    if (typeof windowImpl.queryLocalFonts !== 'function') {
      windowImpl.alert?.('This browser cannot list installed fonts. Use Custom… to type a font name.');
      return;
    }
    let families;
    try {
      const fonts = await windowImpl.queryLocalFonts();
      families = Array.from(new Set(fonts.map((f) => f.family)))
        .sort((a, b) => a.localeCompare(b));
    } catch {
      windowImpl.alert?.('Could not read installed fonts (permission denied). Use Custom… to type a font name.');
      return;
    }
    if (!families.length) return;
    for (const ctrl of fontControls) {
      injectDetectedFonts(ctrl.select, families);
      ctrl.resync();
    }
    flashSaved();
  }

  function setupFontControl(kind) {
    const key = FONT_KEYS[kind];
    const select = documentImpl.querySelector(`[data-font-select="${kind}"]`);
    const custom = documentImpl.querySelector(`[data-font-custom="${kind}"]`);
    if (!select) return;

    const stored = () => (settings && key in settings ? settings[key] : storage?.getItem(key)) || 'mono';

    function resync() {
      const value = stored();
      const hasOption = Array.from(select.options).some((o) => o.value === value);
      if (hasOption) {
        select.value = value;
        if (custom) custom.hidden = true;
      } else {
        select.value = '__custom__';
        if (custom) { custom.value = value; custom.hidden = false; }
      }
    }

    function commit(value) {
      writeSetting(key, value, { storage });
      applyFonts(documentImpl, { [kind]: value });
      flashSaved();
    }

    select.addEventListener('change', async () => {
      const v = select.value;
      if (v === '__detect__') {
        resync(); // revert the visible selection; detection runs async
        await detectInstalledFonts();
        return;
      }
      if (v === '__custom__') {
        if (custom) { custom.hidden = false; custom.focus(); }
        return;
      }
      if (custom) custom.hidden = true;
      commit(v);
    });

    if (custom) {
      custom.addEventListener('change', () => {
        const fam = custom.value.trim();
        if (fam) commit(fam);
      });
    }

    fontControls.push({ select, resync });
    resync();
  }

  setupFontControl('ui');
  setupFontControl('content');
  setupFontControl('code');

  // Enabling notifications also requests browser permission and registers a
  // push subscription for THIS device (the subscription is per-device and is
  // not part of the synced setting); disabling unregisters it.
  async function handleNotifyToggle(el) {
    if (!el.checked) {
      setDoneNotifyEnabled(false, { storage });
      await unregisterPushSubscription({ windowImpl, fetchImpl: fetchImpl || fetch });
      return;
    }
    const permission = await requestNotifyPermission({ windowImpl });
    const granted = permission === 'granted';
    el.checked = granted;
    setDoneNotifyEnabled(granted, { storage });
    if (granted) {
      await registerPushSubscription({ windowImpl, fetchImpl: fetchImpl || fetch });
    }
  }
}

// Custom-language editor: a JSON textarea backed by pi-web:v1:custom-languages,
// a "Copy English keys" template button, and a "Save & apply" button that
// validates the JSON, persists it, and reloads so the registry + picker refresh.
export function setupCustomLanguages({ documentImpl = document, windowImpl = window, storage } = {}) {
  const textarea = documentImpl.querySelector('[data-custom-languages]');
  if (!textarea) return;
  const copyBtn = documentImpl.querySelector('[data-copy-en-keys]');
  const saveBtn = documentImpl.querySelector('[data-save-custom-languages]');
  const status = documentImpl.querySelector('[data-custom-languages-status]');

  function showStatus(message, isError) {
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('is-error', !!isError);
  }

  // Hydrate from storage, pretty-printed when it parses.
  let stored = '';
  try {
    stored = storage?.getItem(CUSTOM_LANGUAGES_KEY) || '';
  } catch {
    stored = '';
  }
  if (stored) {
    try {
      textarea.value = JSON.stringify(JSON.parse(stored), null, 2);
    } catch {
      textarea.value = stored;
    }
  }

  copyBtn?.addEventListener('click', async () => {
    const template = JSON.stringify(
      [{ code: 'xx', label: 'My Language', strings: englishTemplate() }],
      null,
      2,
    );
    try {
      await windowImpl.navigator?.clipboard?.writeText(template);
      showStatus(t('settings.copiedTemplate'), false);
    } catch {
      // Clipboard unavailable: drop it into the textarea so it's still usable.
      textarea.value = template;
      showStatus(t('settings.clipboardUnavailable'), false);
    }
  });

  saveBtn?.addEventListener('click', () => {
    const raw = textarea.value.trim();
    if (raw === '') {
      writeSetting(CUSTOM_LANGUAGES_KEY, '', { storage });
      windowImpl.location.reload();
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      showStatus(t('settings.invalidJson', { error: err?.message || 'parse error' }), true);
      return;
    }
    if (!Array.isArray(parsed) || parsed.some((l) => !l || typeof l.code !== 'string' || !l.code.trim())) {
      showStatus(t('settings.expectedArray'), true);
      return;
    }
    writeSetting(CUSTOM_LANGUAGES_KEY, JSON.stringify(parsed), { storage });
    windowImpl.location.reload();
  });
}

// Wire the back link so it returns to the previous in-app page (a session
// detail page, the index, etc.) when the user navigated here from within the
// app. Falls back to the href="/" home link for direct visits.
export function setupBackLink(documentImpl, windowImpl) {
  const link = documentImpl.querySelector('[data-settings-back]');
  if (!link) return;

  let fromApp = false;
  try {
    const ref = documentImpl.referrer;
    fromApp = !!ref
      && new URL(ref).origin === windowImpl.location.origin
      && new URL(ref).pathname !== '/settings';
  } catch {
    fromApp = false;
  }

  if (fromApp) {
    const label = link.querySelector('[data-settings-back-label]');
    if (label) label.textContent = 'Back';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (windowImpl.history && windowImpl.history.length > 1) {
        windowImpl.history.back();
      } else {
        windowImpl.location.href = '/';
      }
    });
  }
}

// Fetch /api/models and append provider-grouped options to a model <select>.
// Keeps any pre-existing options (e.g. the "pi default" empty option). Values
// are stored as "provider/id" to match the --model pattern pi expects.
export async function populateModelSelect(select, { documentImpl = document, fetchImpl = fetch } = {}) {
  let models;
  try {
    const resp = await fetchImpl('/api/models', { headers: { Accept: 'application/json' } });
    if (!resp.ok) return;
    const data = await resp.json();
    models = Array.isArray(data?.models) ? data.models : null;
  } catch {
    return;
  }
  if (!models || !models.length) return;

  const byProvider = new Map();
  for (const m of models) {
    const id = m.id || m.modelId || '';
    const provider = m.provider || '';
    if (!id || !provider) continue;
    if (!byProvider.has(provider)) byProvider.set(provider, []);
    byProvider.get(provider).push({ id, name: m.name || id });
  }

  for (const provider of Array.from(byProvider.keys()).sort((a, b) => a.localeCompare(b))) {
    const group = documentImpl.createElement('optgroup');
    group.label = provider;
    for (const { id, name } of byProvider.get(provider)) {
      const opt = documentImpl.createElement('option');
      opt.value = `${provider}/${id}`;
      opt.textContent = name;
      group.appendChild(opt);
    }
    select.appendChild(group);
  }
}

function readFromStorage(storage, controls) {
  const out = {};
  for (const el of controls) {
    const key = el.dataset.setting;
    try {
      const v = storage?.getItem(key);
      if (v != null) out[key] = v;
    } catch {
      // ignore
    }
  }
  return out;
}
