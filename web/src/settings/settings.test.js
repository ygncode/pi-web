import { describe, expect, it, vi } from 'vitest';
import { setupBackLink, populateModelSelect } from './settings.js';

function makeFakeDoc() {
  const make = (tag) => {
    const node = { tag, children: [], label: '', value: '', textContent: '' };
    node.appendChild = (c) => node.children.push(c);
    return node;
  };
  return { createElement: (tag) => make(tag) };
}

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

describe('populateModelSelect', () => {
  it('appends provider-grouped options with provider/id values', async () => {
    const select = { children: [], appendChild(c) { this.children.push(c); } };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { provider: 'anthropic', id: 'sonnet', name: 'Sonnet' },
          { provider: 'anthropic', modelId: 'haiku', name: 'Haiku' },
          { provider: 'openai', id: 'gpt-4o', name: 'GPT-4o' },
        ],
      }),
    });

    await populateModelSelect(select, { documentImpl: makeFakeDoc(), fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith('/api/models', expect.anything());
    // Two provider optgroups, sorted alphabetically.
    expect(select.children.map((g) => g.label)).toEqual(['anthropic', 'openai']);
    const anthropic = select.children[0];
    expect(anthropic.children.map((o) => o.value)).toEqual([
      'anthropic/sonnet',
      'anthropic/haiku',
    ]);
    expect(anthropic.children.map((o) => o.textContent)).toEqual(['Sonnet', 'Haiku']);
    expect(select.children[1].children[0].value).toBe('openai/gpt-4o');
  });

  it('no-ops on fetch failure', async () => {
    const select = { children: [], appendChild(c) { this.children.push(c); } };
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    await populateModelSelect(select, { documentImpl: makeFakeDoc(), fetchImpl });
    expect(select.children).toHaveLength(0);
  });
});
