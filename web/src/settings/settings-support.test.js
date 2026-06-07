import { describe, it, expect, vi } from 'vitest';
import { setupBackLink } from './settings-support.js';

function makeLink() {
  const label = { textContent: '' };
  let clickHandler = null;
  const link = {
    querySelector: (sel) => (sel === '[data-settings-back-label]' ? label : null),
    addEventListener: (type, handler) => { if (type === 'click') clickHandler = handler; },
    _click: (init = {}) => {
      const e = {
        button: 0,
        defaultPrevented: false,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: vi.fn(),
        ...init,
      };
      clickHandler?.(e);
      return e;
    },
  };
  return { link, label };
}

function makeDoc(link, referrer) {
  return {
    referrer,
    querySelector: (sel) => (sel === '[data-settings-back]' ? link : null),
  };
}

function makeWin({ historyLength = 5 } = {}) {
  return {
    location: { origin: 'http://localhost', href: '' },
    history: { length: historyLength, back: vi.fn(), pushState: vi.fn() },
  };
}

describe('setupBackLink', () => {
  it('does nothing when the back link is absent', () => {
    const doc = makeDoc(null, 'http://localhost/');
    expect(() => setupBackLink(doc, makeWin())).not.toThrow();
  });

  it('from within the app: relabels and steps back through history', () => {
    const { link, label } = makeLink();
    const doc = makeDoc(link, 'http://localhost/');
    const win = makeWin({ historyLength: 5 });

    setupBackLink(doc, win);
    expect(label.textContent).toBeTruthy(); // relabelled to "Back"

    const e = link._click();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(win.history.back).toHaveBeenCalled();
    expect(win.history.pushState).not.toHaveBeenCalled();
  });

  it('direct load (no app referrer): navigates client-side to the index', () => {
    const { link } = makeLink();
    const doc = makeDoc(link, '');
    const win = makeWin();

    setupBackLink(doc, win);
    const e = link._click();

    expect(e.preventDefault).toHaveBeenCalled();
    expect(win.history.pushState).toHaveBeenCalledWith({}, '', '/');
    expect(win.history.back).not.toHaveBeenCalled();
    expect(win.location.href).toBe('');
  });

  it('from app but no history to pop: falls back to client-side navigate', () => {
    const { link } = makeLink();
    const doc = makeDoc(link, 'http://localhost/');
    const win = makeWin({ historyLength: 1 });

    setupBackLink(doc, win);
    link._click();

    expect(win.history.back).not.toHaveBeenCalled();
    expect(win.history.pushState).toHaveBeenCalledWith({}, '', '/');
  });

  it('defers to the browser for modified clicks', () => {
    const { link } = makeLink();
    const doc = makeDoc(link, '');
    const win = makeWin();

    setupBackLink(doc, win);
    const e = link._click({ metaKey: true });

    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(win.history.pushState).not.toHaveBeenCalled();
    expect(win.history.back).not.toHaveBeenCalled();
  });
});
