import { describe, expect, it, vi } from 'vitest';
import { setupBackLink } from './settings.js';

function makeLink() {
  const label = { textContent: 'Sessions' };
  const handlers = {};
  const link = {
    querySelector: (sel) => (sel === '[data-settings-back-label]' ? label : null),
    addEventListener: (type, fn) => { handlers[type] = fn; },
    _click() {
      const e = { preventDefault: vi.fn() };
      handlers.click?.(e);
      return e;
    },
    _label: label,
    _hasClick: () => !!handlers.click,
  };
  return link;
}

function makeDoc(link, referrer) {
  return {
    referrer,
    querySelector: (sel) => (sel === '[data-settings-back]' ? link : null),
  };
}

function makeWin({ historyLength = 3 } = {}) {
  return {
    location: { origin: 'http://localhost:31415', href: '' },
    history: { length: historyLength, back: vi.fn() },
  };
}

describe('setupBackLink', () => {
  it('goes back in history when arriving from an in-app page', () => {
    const link = makeLink();
    const doc = makeDoc(link, 'http://localhost:31415/session?id=abc');
    const win = makeWin();

    setupBackLink(doc, win);

    expect(link._label.textContent).toBe('Back');
    const e = link._click();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(win.history.back).toHaveBeenCalled();
  });

  it('leaves the home link alone on a direct visit (no referrer)', () => {
    const link = makeLink();
    const doc = makeDoc(link, '');
    const win = makeWin();

    setupBackLink(doc, win);

    expect(link._label.textContent).toBe('Sessions');
    expect(link._hasClick()).toBe(false);
  });

  it('ignores a referrer from the settings page itself', () => {
    const link = makeLink();
    const doc = makeDoc(link, 'http://localhost:31415/settings');
    const win = makeWin();

    setupBackLink(doc, win);

    expect(link._hasClick()).toBe(false);
  });

  it('ignores a cross-origin referrer', () => {
    const link = makeLink();
    const doc = makeDoc(link, 'https://evil.example.com/page');
    const win = makeWin();

    setupBackLink(doc, win);

    expect(link._hasClick()).toBe(false);
  });

  it('falls back to home when there is no usable history', () => {
    const link = makeLink();
    const doc = makeDoc(link, 'http://localhost:31415/session?id=abc');
    const win = makeWin({ historyLength: 1 });

    setupBackLink(doc, win);
    link._click();

    expect(win.history.back).not.toHaveBeenCalled();
    expect(win.location.href).toBe('/');
  });
});
