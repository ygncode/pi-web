/**
 * Cat Gatekeeper — a focus/break companion for pi-web.
 *
 * A background pomodoro timer counts down "focus" time only while the user is
 * actively in the pi-web tab (the timer pauses on blur / hidden / idle). When
 * focus runs out a full-screen cat overlay enforces a break with a countdown.
 * A separate bedtime triggers a sleepy cat that, after a short reminder, locks
 * pi-web for the rest of the session.
 *
 * State is intentionally per-session for the sleep lock (a reload clears it),
 * while the remaining focus time survives short reloads via localStorage.
 */

import { loadCatSettings, showCatSettings } from './cat-settings.js';

const TICK_MS = 1000;
// Cap how much a single focus tick can subtract so a throttled/backgrounded
// tab that fires a delayed tick can't burn a big chunk of focus time at once.
const MAX_FOCUS_STEP_MS = 2000;
// How long after bedtime the goodnight nudge still fires (handles opening
// pi-web well after bedtime, including past midnight).
const SLEEP_WINDOW_MIN = 8 * 60;
// Remaining-focus persistence is only trusted across short reloads.
const FOCUS_RESTORE_MAX_AGE_MS = 30 * 60 * 1000;

const FOCUS_REMAINING_KEY = 'pi-web:v1:cat:focus-remaining-ms';
const FOCUS_SAVED_AT_KEY = 'pi-web:v1:cat:focus-saved-at';

// The cat ships as a looping, muted WebM (served at /cat.webm). Both the break
// and the sleepy bedtime overlay reuse it; the sleepy look is a CSS filter.
const CAT_VIDEO_SRC = '/cat.webm';
function catVideoHTML() {
  return `<video class="cat-video" src="${CAT_VIDEO_SRC}" autoplay loop muted playsinline aria-label="cat"></video>`;
}

function formatMMSS(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function bedtimeToMinutes(bedtime) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(bedtime));
  if (!match) return 23 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function setupCatGatekeeper({
  documentImpl = document,
  windowImpl = window,
  storage = windowImpl.localStorage,
  nowFn = () => Date.now(),
  setIntervalImpl = (typeof windowImpl.setInterval === 'function' ? windowImpl.setInterval.bind(windowImpl) : () => 0),
  clearIntervalImpl = (typeof windowImpl.clearInterval === 'function' ? windowImpl.clearInterval.bind(windowImpl) : () => {}),
  requestAnimationFrameImpl = (cb) => (typeof windowImpl.requestAnimationFrame === 'function' ? windowImpl.requestAnimationFrame(cb) : cb()),
} = {}) {
  let overlay = null;
  let inputBlockers = null;
  let intervalId = null;

  const state = {
    phase: 'focus', // focus | break | sleep | sleep-locked
    focusRemainingMs: 0,
    breakRemainingMs: 0,
    sleepElapsedMs: 0,
    sleepTriggered: false,
    lastTickAt: nowFn(),
  };

  function settings() {
    return loadCatSettings({ storage });
  }

  function isActive() {
    const hidden = documentImpl.hidden === true || documentImpl.visibilityState === 'hidden';
    let focused = true;
    try {
      if (typeof documentImpl.hasFocus === 'function') focused = documentImpl.hasFocus();
    } catch { /* assume focused */ }
    return !hidden && focused;
  }

  function persistFocus() {
    try {
      storage?.setItem(FOCUS_REMAINING_KEY, String(Math.max(0, Math.round(state.focusRemainingMs))));
      storage?.setItem(FOCUS_SAVED_AT_KEY, String(nowFn()));
    } catch { /* ignore */ }
  }

  function restoreFocus(focusTotalMs) {
    try {
      const remaining = Number(storage?.getItem(FOCUS_REMAINING_KEY));
      const savedAt = Number(storage?.getItem(FOCUS_SAVED_AT_KEY));
      if (Number.isFinite(remaining) && Number.isFinite(savedAt)
        && remaining > 0 && remaining <= focusTotalMs
        && nowFn() - savedAt <= FOCUS_RESTORE_MAX_AGE_MS) {
        return remaining;
      }
    } catch { /* ignore */ }
    return focusTotalMs;
  }

  function inSleepWindow(bedtime) {
    const d = new Date(nowFn());
    const cur = d.getHours() * 60 + d.getMinutes();
    let diff = (cur - bedtimeToMinutes(bedtime)) % 1440;
    if (diff < 0) diff += 1440;
    return diff < SLEEP_WINDOW_MIN;
  }

  // --- overlay -------------------------------------------------------------

  function ensureOverlay() {
    if (overlay && documentImpl.body.contains(overlay)) return overlay;
    overlay = documentImpl.createElement('div');
    overlay.id = 'cat-gatekeeper-overlay';
    overlay.className = 'cat-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="cat-overlay-inner">
        <div class="cat-art" data-cat-art></div>
        <div class="cat-timer" data-cat-timer></div>
        <div class="cat-message" data-cat-message></div>
      </div>`;
    documentImpl.body.appendChild(overlay);
    return overlay;
  }

  function blockInput() {
    if (inputBlockers) return;
    const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
    const swallowWheel = (e) => { e.preventDefault(); };
    documentImpl.addEventListener('keydown', swallow, true);
    documentImpl.addEventListener('wheel', swallowWheel, { capture: true, passive: false });
    documentImpl.addEventListener('touchmove', swallowWheel, { capture: true, passive: false });
    inputBlockers = { swallow, swallowWheel };
    try { documentImpl.activeElement?.blur?.(); } catch { /* ignore */ }
  }

  function unblockInput() {
    if (!inputBlockers) return;
    documentImpl.removeEventListener('keydown', inputBlockers.swallow, true);
    documentImpl.removeEventListener('wheel', inputBlockers.swallowWheel, { capture: true });
    documentImpl.removeEventListener('touchmove', inputBlockers.swallowWheel, { capture: true });
    inputBlockers = null;
  }

  function showOverlay(variant) {
    const el = ensureOverlay();
    el.classList.remove('cat-overlay--break', 'cat-overlay--sleep', 'cat-overlay--locked', 'cat-overlay-hidden');
    el.classList.add(`cat-overlay--${variant}`);
    el.setAttribute('aria-hidden', 'false');
    const art = el.querySelector('[data-cat-art]');
    if (art && !art.querySelector('video')) art.innerHTML = catVideoHTML();
    const video = art?.querySelector('video');
    if (video) {
      try {
        video.currentTime = 0;
        video.playbackRate = 0.6; // calmer, slower cat
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      } catch { /* ignore */ }
    }
    blockInput();
    requestAnimationFrameImpl(() => el.classList.add('visible'));
  }

  function hideOverlay() {
    unblockInput();
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.add('cat-overlay-hidden');
  }

  function renderBreak() {
    const el = ensureOverlay();
    const timer = el.querySelector('[data-cat-timer]');
    const msg = el.querySelector('[data-cat-message]');
    if (timer) { timer.style.display = ''; timer.textContent = formatMMSS(state.breakRemainingMs); }
    // Break shows only the countdown box (no message overlapping the cat).
    if (msg) { msg.textContent = ''; msg.style.display = 'none'; }
  }

  function renderSleep(locked) {
    const el = ensureOverlay();
    const timer = el.querySelector('[data-cat-timer]');
    const msg = el.querySelector('[data-cat-message]');
    if (timer) timer.style.display = 'none';
    if (msg) { msg.style.display = ''; msg.textContent = locked ? 'Locked for the night — get some rest.' : 'Time to sleep!'; }
    if (locked) el.classList.add('cat-overlay--locked');
  }

  // --- phase transitions ---------------------------------------------------

  function enterBreak() {
    state.phase = 'break';
    state.breakRemainingMs = settings().breakMin * 60000;
    showOverlay('break');
    renderBreak();
  }

  function endBreak() {
    state.phase = 'focus';
    state.focusRemainingMs = settings().focusMin * 60000;
    persistFocus();
    hideOverlay();
  }

  function enterSleep() {
    state.sleepTriggered = true;
    state.phase = 'sleep';
    state.sleepElapsedMs = 0;
    showOverlay('sleep');
    renderSleep(false);
  }

  function tick() {
    const now = nowFn();
    const realDelta = Math.max(0, now - state.lastTickAt);
    state.lastTickAt = now;

    const cfg = settings();
    if (!cfg.enabled) {
      if (state.phase !== 'focus') { state.phase = 'focus'; hideOverlay(); }
      return;
    }

    // Bedtime overrides everything and, once triggered, is sticky for the session.
    if (state.phase !== 'sleep' && state.phase !== 'sleep-locked'
      && !state.sleepTriggered && isActive() && inSleepWindow(cfg.bedtime)) {
      enterSleep();
      return;
    }

    switch (state.phase) {
      case 'focus': {
        if (isActive()) {
          state.focusRemainingMs -= Math.min(realDelta, MAX_FOCUS_STEP_MS);
          persistFocus();
        }
        if (state.focusRemainingMs <= 0) enterBreak();
        break;
      }
      case 'break': {
        state.breakRemainingMs -= realDelta;
        if (state.breakRemainingMs <= 0) endBreak();
        else renderBreak();
        break;
      }
      case 'sleep': {
        state.sleepElapsedMs += realDelta;
        if (state.sleepElapsedMs >= cfg.sleepMin * 60000) {
          state.phase = 'sleep-locked';
          renderSleep(true);
        }
        break;
      }
      default:
        break;
    }
  }

  // --- public API ----------------------------------------------------------

  function getStatusText() {
    const cfg = settings();
    if (!cfg.enabled) return 'Cat Gatekeeper is off.';
    switch (state.phase) {
      case 'break': return `On a break — ${formatMMSS(state.breakRemainingMs)} left.`;
      case 'sleep':
      case 'sleep-locked': return 'Bedtime — time to sleep.';
      default: return `Next break in ${formatMMSS(state.focusRemainingMs)}.`;
    }
  }

  function skipToBreak() {
    if (!settings().enabled) return;
    if (state.phase === 'focus') enterBreak();
  }

  function openSettings() {
    return showCatSettings({
      documentImpl,
      windowImpl,
      storage,
      controller: { getStatusText, skipToBreak },
      onChange: (next) => {
        // Apply focus duration changes immediately when idle in focus phase so
        // a longer/shorter focus setting takes effect without a reload.
        if (state.phase === 'focus') {
          const focusTotal = next.focusMin * 60000;
          if (state.focusRemainingMs > focusTotal) state.focusRemainingMs = focusTotal;
          persistFocus();
        }
        if (!next.enabled && (state.phase === 'break')) {
          // Disabling mid-break releases the user.
          state.phase = 'focus';
          state.focusRemainingMs = next.focusMin * 60000;
          hideOverlay();
        }
      },
    });
  }

  function start() {
    const focusTotal = settings().focusMin * 60000;
    state.focusRemainingMs = restoreFocus(focusTotal);
    state.lastTickAt = nowFn();
    // Greet immediately if pi-web is opened after bedtime. Guarded so a hostile
    // or mocked environment can't break the rest of session init.
    try { tick(); } catch { /* ignore */ }
    intervalId = setIntervalImpl(tick, TICK_MS);
    return controller;
  }

  function destroy() {
    if (intervalId != null) clearIntervalImpl(intervalId);
    intervalId = null;
    unblockInput();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  const controller = { start, destroy, tick, getStatusText, skipToBreak, openSettings, getState: () => ({ ...state }) };
  return controller;
}
