import { describe, it, expect, vi } from 'vitest';
import {
  notifyDone,
  setupAppBadgeClearing,
  clearAppBadge,
  DONE_NOTIFY_STORAGE_KEY,
} from './done-notifier.js';

function makeStorage(enabled = true) {
  const map = { [DONE_NOTIFY_STORAGE_KEY]: String(enabled) };
  return { getItem: (k) => map[k] ?? null, setItem: (k, v) => { map[k] = v; } };
}

function makeWindow({ badgeApi = true } = {}) {
  const badge = { set: [], cleared: 0 };
  const nav = badgeApi
    ? {
        setAppBadge: vi.fn(async (n) => { badge.set.push(n); }),
        clearAppBadge: vi.fn(async () => { badge.cleared += 1; }),
      }
    : {};
  return {
    windowImpl: { navigator: nav, Audio: null, Notification: null, addEventListener: vi.fn() },
    badge,
  };
}

describe('notifyDone — app badge', () => {
  it('sets badge when document is hidden', () => {
    const { windowImpl, badge } = makeWindow();
    notifyDone({ windowImpl, documentImpl: { hidden: true }, storage: makeStorage(true) });
    expect(badge.set).toEqual([1]);
  });

  it('does not set badge when document is visible', () => {
    const { windowImpl, badge } = makeWindow();
    notifyDone({ windowImpl, documentImpl: { hidden: false }, storage: makeStorage(true) });
    expect(badge.set).toEqual([]);
  });

  it('does not set badge when notifications are disabled', () => {
    const { windowImpl, badge } = makeWindow();
    notifyDone({ windowImpl, documentImpl: { hidden: true }, storage: makeStorage(false) });
    expect(badge.set).toEqual([]);
  });

  it('does nothing when Badging API is unavailable', () => {
    const { windowImpl } = makeWindow({ badgeApi: false });
    expect(() =>
      notifyDone({ windowImpl, documentImpl: { hidden: true }, storage: makeStorage(true) })
    ).not.toThrow();
  });
});

describe('clearAppBadge', () => {
  it('calls navigator.clearAppBadge', () => {
    const { windowImpl, badge } = makeWindow();
    clearAppBadge({ windowImpl });
    expect(badge.cleared).toBe(1);
  });

  it('does nothing when Badging API is unavailable', () => {
    const { windowImpl } = makeWindow({ badgeApi: false });
    expect(() => clearAppBadge({ windowImpl })).not.toThrow();
  });
});

describe('setupAppBadgeClearing', () => {
  it('clears badge immediately if document is already visible', () => {
    const { windowImpl, badge } = makeWindow();
    const listeners = {};
    const documentImpl = {
      hidden: false,
      addEventListener: (type, fn) => { listeners[type] = fn; },
    };
    windowImpl.addEventListener = (type, fn) => { listeners[type] = fn; };

    setupAppBadgeClearing({ documentImpl, windowImpl });

    expect(badge.cleared).toBe(1);
  });

  it('clears badge on visibilitychange when page becomes visible', () => {
    const { windowImpl, badge } = makeWindow();
    const listeners = {};
    const documentImpl = {
      hidden: true,
      addEventListener: (type, fn) => { listeners[type] = fn; },
    };
    windowImpl.addEventListener = (type, fn) => { listeners[type] = fn; };

    setupAppBadgeClearing({ documentImpl, windowImpl });
    expect(badge.cleared).toBe(0);

    documentImpl.hidden = false;
    listeners['visibilitychange']();
    expect(badge.cleared).toBe(1);
  });

  it('clears badge on window focus', () => {
    const { windowImpl, badge } = makeWindow();
    const listeners = {};
    const documentImpl = {
      hidden: false,
      addEventListener: (type, fn) => { listeners[type] = fn; },
    };
    windowImpl.addEventListener = (type, fn) => { listeners[type] = fn; };

    setupAppBadgeClearing({ documentImpl, windowImpl });
    badge.cleared = 0; // reset after the initial clear

    listeners['focus']();
    expect(badge.cleared).toBe(1);
  });
});
