import { configureSettingsSync, hydrateSettings, writeSetting } from '../shared/settings-store.js';
import { applyTheme } from '../shared/theme.js';
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

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  runSettingsPage();
}
