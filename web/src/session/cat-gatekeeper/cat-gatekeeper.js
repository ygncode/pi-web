/**
 * Cat Gatekeeper — a focus/break companion for pi-web (timer/phase logic only).
 *
 * A background pomodoro timer counts down "focus" time only while the user is
 * actively in the pi-web tab. When focus runs out the controller asks the view
 * to show a full-screen cat overlay enforcing a break with a countdown. A
 * separate bedtime triggers a sleepy cat that, after a short reminder, locks
 * pi-web for the rest of the session.
 *
 * This module holds NO DOM/overlay rendering — that lives in
 * <CatGatekeeper.svelte>, injected as `view`. State is per-session for the sleep
 * lock (a reload clears it); the remaining focus time survives short reloads via
 * localStorage.
 */

import { loadCatSettings } from './cat-settings.js';
import { openCatSettings } from '../session-modals.svelte.js';

const TICK_MS = 1000;
// Cap how much a single focus tick can subtract so a throttled/backgrounded
// tab that fires a delayed tick can't burn a big chunk of focus time at once.
const MAX_FOCUS_STEP_MS = 2000;
// Remaining-focus persistence is only trusted across short reloads.
const FOCUS_RESTORE_MAX_AGE_MS = 30 * 60 * 1000;
// One-time snooze grants this much extra time at the bedtime soft warning.
const SNOOZE_MS = 5 * 60 * 1000;

const FOCUS_REMAINING_KEY = 'pi-web:v1:cat:focus-remaining-ms';
const FOCUS_SAVED_AT_KEY = 'pi-web:v1:cat:focus-saved-at';

const SLEEP_MESSAGE = 'Time to sleep!';
const LOCKED_MESSAGE = 'Locked for the night — get some rest.';

// No-op view so the controller is safe to construct/test without an overlay.
const noopView = { showBreak() {}, setBreakTimer() {}, showSleep() {}, hide() {} };

function formatMMSS(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function timeToMinutes(value, fallbackMin) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value));
  if (!match) return fallbackMin;
  return Number(match[1]) * 60 + Number(match[2]);
}

// Minutes from bedtime to wakeup, wrapping past midnight. 0 means the window is
// empty (bedtime === wakeup) and the sleepy cat never triggers.
function sleepWindowMinutes(bedtime, wakeup) {
  const bed = timeToMinutes(bedtime, 23 * 60);
  const wake = timeToMinutes(wakeup, 7 * 60);
  let span = (wake - bed) % 1440;
  if (span < 0) span += 1440;
  return span;
}

export { formatMMSS, timeToMinutes, sleepWindowMinutes };

export function setupCatGatekeeper({
  windowImpl = (typeof window !== 'undefined' ? window : undefined),
  storage = windowImpl?.localStorage,
  nowFn = () => Date.now(),
  // Whether the pi-web tab is currently active (visible + focused). Injected so
  // the view (which owns the document) decides; defaults to always-active.
  isActive = () => true,
  // Overlay renderer. See <CatGatekeeper.svelte>.
  view = noopView,
  setIntervalImpl = (typeof windowImpl?.setInterval === 'function' ? windowImpl.setInterval.bind(windowImpl) : () => 0),
  clearIntervalImpl = (typeof windowImpl?.clearInterval === 'function' ? windowImpl.clearInterval.bind(windowImpl) : () => {}),
} = {}) {
  let intervalId = null;

  const state = {
    phase: 'focus', // focus | break | sleep | snooze | sleep-locked
    focusRemainingMs: 0,
    breakRemainingMs: 0,
    sleepElapsedMs: 0,
    sleepTriggered: false,
    snoozeUsed: false,
    snoozeRemainingMs: 0,
    lastTickAt: nowFn(),
  };

  function settings() {
    return loadCatSettings({ storage });
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

  function inSleepWindow(bedtime, wakeup) {
    const window = sleepWindowMinutes(bedtime, wakeup);
    if (window <= 0) return false;
    const d = new Date(nowFn());
    const cur = d.getHours() * 60 + d.getMinutes();
    let diff = (cur - timeToMinutes(bedtime, 23 * 60)) % 1440;
    if (diff < 0) diff += 1440;
    return diff < window;
  }

  // --- overlay (delegated to the injected view) ----------------------------

  function renderSleep(locked) {
    view.showSleep({
      locked,
      // Snooze is offered only during the soft warning, and only until used once.
      showSnooze: !locked && !state.snoozeUsed,
      message: locked ? LOCKED_MESSAGE : SLEEP_MESSAGE,
    });
  }

  // --- phase transitions ---------------------------------------------------

  function enterBreak() {
    state.phase = 'break';
    state.breakRemainingMs = settings().breakMin * 60000;
    view.showBreak(formatMMSS(state.breakRemainingMs));
  }

  function endBreak() {
    state.phase = 'focus';
    state.focusRemainingMs = settings().focusMin * 60000;
    persistFocus();
    view.hide();
  }

  function enterSleep() {
    state.sleepTriggered = true;
    state.phase = 'sleep';
    state.sleepElapsedMs = 0;
    renderSleep(false);
  }

  // One-time bedtime snooze: dismisses the soft warning and grants SNOOZE_MS
  // before the sleepy cat returns. Ignored once already used or past the warning.
  function snooze() {
    if (state.phase !== 'sleep' || state.snoozeUsed) return;
    state.snoozeUsed = true;
    state.phase = 'snooze';
    state.snoozeRemainingMs = SNOOZE_MS;
    view.hide();
  }

  function tick() {
    const now = nowFn();
    const realDelta = Math.max(0, now - state.lastTickAt);
    state.lastTickAt = now;

    const cfg = settings();
    if (!cfg.enabled) {
      if (state.phase !== 'focus') { state.phase = 'focus'; view.hide(); }
      return;
    }

    // Bedtime overrides everything and, once triggered, is sticky for the session.
    if (state.phase !== 'sleep' && state.phase !== 'sleep-locked'
      && !state.sleepTriggered && isActive() && inSleepWindow(cfg.bedtime, cfg.wakeup)) {
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
        else view.setBreakTimer(formatMMSS(state.breakRemainingMs));
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
      case 'snooze': {
        state.snoozeRemainingMs -= realDelta;
        if (state.snoozeRemainingMs <= 0) {
          // Still night? Bring the cat back. Otherwise the window passed — resume focus.
          if (inSleepWindow(cfg.bedtime, cfg.wakeup)) enterSleep();
          else { state.phase = 'focus'; state.focusRemainingMs = cfg.focusMin * 60000; }
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
      case 'snooze': return `Snoozed — back to bed in ${formatMMSS(state.snoozeRemainingMs)}.`;
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
    // The settings sheet is the <CatGatekeeperSettings> Svelte component, opened
    // via the shared sessionModals store; it reads cat-settings storage directly.
    return openCatSettings({
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
          view.hide();
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
    view.hide();
  }

  const controller = { start, destroy, tick, getStatusText, skipToBreak, snooze, openSettings, getState: () => ({ ...state }) };
  return controller;
}
