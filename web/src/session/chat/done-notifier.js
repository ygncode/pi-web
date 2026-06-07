import { writeSetting } from '../../shared/settings-store.js';

export const DONE_NOTIFY_STORAGE_KEY = 'pi-share:v1:notify-on-done';
export const DONE_SOUND_STORAGE_KEY = 'pi-share:v1:done-sound';

export function isDoneNotifyEnabled({ storage = globalThis.localStorage } = {}) {
  try {
    return storage?.getItem(DONE_NOTIFY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDoneNotifyEnabled(enabled, { storage = globalThis.localStorage } = {}) {
  writeSetting(DONE_NOTIFY_STORAGE_KEY, String(!!enabled), { storage });
}

export function getSelectedSound({ storage = globalThis.localStorage } = {}) {
  try {
    return storage?.getItem(DONE_SOUND_STORAGE_KEY) || 'cat.mp3';
  } catch {
    return 'cat.mp3';
  }
}

export function setSelectedSound(name, { storage = globalThis.localStorage } = {}) {
  writeSetting(DONE_SOUND_STORAGE_KEY, name || 'cat.mp3', { storage });
}

export function playDoneSound({ windowImpl = window, audioSrc, storage = globalThis.localStorage } = {}) {
  try {
    const AudioCtor = windowImpl.Audio;
    if (!AudioCtor) return;
    const src = audioSrc || `/sounds/${getSelectedSound({ storage })}`;
    const audio = new AudioCtor(src);
    audio.volume = 0.7;
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // ignore
  }
}


export function showDoneNotification({ windowImpl = window, documentImpl = document, title = 'pi session', body = 'Response ready' } = {}) {
  try {
    const N = windowImpl.Notification;
    if (!N || N.permission !== 'granted') return;
    if (!documentImpl.hidden) return;
    const n = new N(title, { body, icon: '/icon.svg', tag: 'pi-session-done' });
    n.onclick = () => {
      try { windowImpl.focus(); } catch (_) {}
      n.close();
    };
  } catch {
    // ignore
  }
}

export async function requestNotifyPermission({ windowImpl = window } = {}) {
  try {
    const N = windowImpl.Notification;
    if (!N) return 'denied';
    if (N.permission === 'granted' || N.permission === 'denied') return N.permission;
    const result = await N.requestPermission();
    return result;
  } catch {
    return 'denied';
  }
}

// Decodes the URL-safe base64 VAPID key the server returns into the
// Uint8Array PushManager.subscribe expects.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Calls pushManager.subscribe(). If it throws (e.g. stale/incompatible
// subscription left over from a VAPID key rotation), force-unsubscribes the
// stale entry and retries once before giving up.
async function _subscribePush(reg, publicKey) {
  const opts = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) };
  try {
    return await reg.pushManager.subscribe(opts);
  } catch (firstErr) {
    const stale = await reg.pushManager.getSubscription().catch(() => null);
    if (stale) {
      await stale.unsubscribe().catch(() => {});
      return await reg.pushManager.subscribe(opts);
    }
    throw firstErr;
  }
}

export async function registerPushSubscription({ windowImpl = window, fetchImpl = fetch } = {}) {
  try {
    const navImpl = windowImpl.navigator;
    if (!navImpl || !navImpl.serviceWorker || !windowImpl.PushManager) return false;
    const reg = await navImpl.serviceWorker.ready;
    const keyResp = await fetchImpl('/api/push/vapid');
    if (!keyResp.ok) return false;
    const { publicKey } = await keyResp.json();
    if (!publicKey) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await _subscribePush(reg, publicKey);
    }
    const body = sub.toJSON ? sub.toJSON() : sub;
    await fetchImpl('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return true;
  } catch (err) {
    try { windowImpl.console?.warn('push subscribe failed', err); } catch (_) {}
    return false;
  }
}

export async function unregisterPushSubscription({ windowImpl = window, fetchImpl = fetch } = {}) {
  try {
    const navImpl = windowImpl.navigator;
    if (!navImpl || !navImpl.serviceWorker) return;
    const reg = await navImpl.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetchImpl('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });
  } catch {
    // ignore
  }
}

export function setupDoneNotifyToggle({ documentImpl = document, windowImpl = window, storage = globalThis.localStorage, fetchImpl = (typeof fetch !== 'undefined' ? fetch : null) } = {}) {
  const btn = documentImpl.getElementById('notify-toggle');
  if (!btn) return;

  const render = () => {
    const enabled = isDoneNotifyEnabled({ storage });
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.classList.toggle('active', enabled);
    btn.title = enabled ? 'Disable done notifications' : 'Notify when response is ready';
    const span = btn.querySelector('span');
    if (span) span.textContent = enabled ? '◉' : '◌';
  };

  render();

  // If the user previously enabled notifications, make sure the push
  // subscription is registered on this device (it may be a new browser,
  // or the SW may have been reset). Cheap to call when already subscribed.
  if (isDoneNotifyEnabled({ storage }) && fetchImpl) {
    registerPushSubscription({ windowImpl, fetchImpl });
  }

  btn.addEventListener('click', async () => {
    const enabled = isDoneNotifyEnabled({ storage });
    if (enabled) {
      setDoneNotifyEnabled(false, { storage });
      if (fetchImpl) unregisterPushSubscription({ windowImpl, fetchImpl });
      render();
      return;
    }
    const permission = await requestNotifyPermission({ windowImpl });
    const granted = permission === 'granted';
    setDoneNotifyEnabled(granted, { storage });
    if (granted && fetchImpl) {
      await registerPushSubscription({ windowImpl, fetchImpl });
    }
    render();
  });
}

export function notifyDone({ windowImpl = window, documentImpl = document, storage = globalThis.localStorage } = {}) {
  if (!isDoneNotifyEnabled({ storage })) return;
  playDoneSound({ windowImpl, storage });
  showDoneNotification({ windowImpl, documentImpl });
  // Badge only when the user isn't watching this session — covers background
  // tabs, minimized windows, and other apps in front. Cleared on
  // visibilitychange/focus via setupAppBadgeClearing.
  if (documentImpl.hidden) {
    try {
      const nav = windowImpl.navigator;
      if (nav && nav.setAppBadge) {
        const p = nav.setAppBadge(1);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {
      // ignore
    }
  }
}

// Clears the app-icon badge set by the service worker on a background push.
// No-op where the Badging API is unsupported.
export function clearAppBadge({ windowImpl = window } = {}) {
  try {
    const nav = windowImpl.navigator;
    if (nav && nav.clearAppBadge) {
      const p = nav.clearAppBadge();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch {
    // ignore
  }
}

// Clears the badge whenever the app comes to the foreground, so the user
// doesn't see a stale count after opening it directly (rather than via the
// notification tap, which the service worker handles).
export function setupAppBadgeClearing({ documentImpl = document, windowImpl = window } = {}) {
  const clear = () => {
    if (!documentImpl.hidden) clearAppBadge({ windowImpl });
  };
  clear();
  documentImpl.addEventListener('visibilitychange', clear);
  windowImpl.addEventListener('focus', clear);
}

export async function fetchAvailableSounds({ fetchImpl = fetch } = {}) {
  try {
    const resp = await fetchImpl('/api/sounds');
    if (!resp.ok) {
      return { sounds: ['cat.mp3', 'done.mp3'], default: 'cat.mp3' };
    }
    return await resp.json();
  } catch {
    return { sounds: ['cat.mp3', 'done.mp3'], default: 'cat.mp3' };
  }
}

export async function setupSoundSelector({ documentImpl = document, windowImpl = window, storage = globalThis.localStorage, fetchImpl = (typeof fetch !== 'undefined' ? fetch : null) } = {}) {
  const selectors = Array.from(documentImpl.querySelectorAll('.sound-selector'));
  if (selectors.length === 0) return;

  // Prevent event propagation inside the selector from triggering the parent button's click toggle
  selectors.forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('mousedown', (e) => e.stopPropagation());
  });

  if (!fetchImpl) return;

  // Fetch the available sounds
  const data = await fetchAvailableSounds({ fetchImpl });
  const sounds = data.sounds || ['cat.mp3', 'done.mp3'];
  const activeSound = getSelectedSound({ storage });

  selectors.forEach(sel => {
    // Clear existing options
    sel.replaceChildren();
    
    // Add options
    sounds.forEach(soundName => {
      const opt = documentImpl.createElement('option');
      opt.value = soundName;
      opt.textContent = soundName;
      if (soundName === activeSound) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });

    // When value changes, update localStorage, play preview, and sync other sound selector elements!
    sel.addEventListener('change', (e) => {
      const newSound = e.target.value;
      setSelectedSound(newSound, { storage });

      // Sync all other selectors on the page to the new value
      selectors.forEach(otherSel => {
        if (otherSel !== sel) {
          otherSel.value = newSound;
        }
      });

      // Preview the sound
      playDoneSound({ windowImpl, storage });
    });
  });
}

