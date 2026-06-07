import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSessionGlobals } from './session-globals.js';
import { sessionModals, resetSessionModals } from './session-modals.svelte.js';
import { sessionRuntime, resetSessionRuntime } from './session-runtime.js';

// Focused coverage for the global keyboard shortcuts + relay buttons, which the
// e2e suite does not exercise. The other wiring (done-notifier, version, palette,
// component-owned pieces are covered by their own tests; here we just confirm
// setupSessionGlobals registers them without throwing in jsdom.

function dispatchKey(key, { meta = false, shift = false } = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    metaKey: meta,
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  }));
}

describe('setupSessionGlobals — keyboard shortcuts', () => {
  let model;
  let dispose;

  beforeEach(() => {
    document.body.innerHTML = `
      <aside id="sidebar"></aside>
      <button id="new-btn"></button>
      <button id="shortcuts-help-btn"></button>
      <button id="new-session-header-btn"></button>
    `;
    document.body.classList.remove('sidebar-collapsed');
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    window.fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    window.scrollTo = vi.fn();
    model = { truncated: false, reconcile: vi.fn(), leafId: 'leaf' };
    dispose = setupSessionGlobals({
      windowImpl: window,
      documentImpl: document,
      model,
      sessionId: 'sess1',
      navigateTo: vi.fn(),
    });
  });

  afterEach(() => {
    dispose?.();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    resetSessionModals();
    resetSessionRuntime();
    delete window.__piOpenSessionPalette;
  });

  it('Cmd+K calls the Svelte command-palette bridge when present', () => {
    const open = vi.fn();
    window.__piOpenSessionPalette = open;
    dispatchKey('k', { meta: true });
    expect(open).toHaveBeenCalledOnce();
  });

  it('Cmd+T clicks the hidden new-session relay', () => {
    const click = vi.fn();
    document.getElementById('new-btn').addEventListener('click', click);
    dispatchKey('t', { meta: true });
    expect(click).toHaveBeenCalledOnce();
  });

  it('Cmd+B toggles the sidebar-collapsed body class on desktop', () => {
    expect(document.body.classList.contains('sidebar-collapsed')).toBe(false);
    dispatchKey('b', { meta: true });
    expect(document.body.classList.contains('sidebar-collapsed')).toBe(true);
  });

  it('Cmd+Shift+N toggles the right sidebar via the runtime registry', () => {
    const toggle = vi.fn();
    sessionRuntime.rightSidebar = { toggle };
    dispatchKey('n', { meta: true, shift: true });
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('Cmd+/ opens the shortcuts modal via the modal store', () => {
    expect(sessionModals.shortcuts).toBe(false);
    dispatchKey('/', { meta: true });
    expect(sessionModals.shortcuts).toBe(true);
  });

  it('the shortcuts-help button opens the shortcuts modal', () => {
    expect(sessionModals.shortcuts).toBe(false);
    document.getElementById('shortcuts-help-btn').click();
    expect(sessionModals.shortcuts).toBe(true);
  });

  it('the header new-session button clicks the hidden new-session relay', () => {
    const click = vi.fn();
    document.getElementById('new-btn').addEventListener('click', click);
    document.getElementById('new-session-header-btn').click();
    expect(click).toHaveBeenCalledOnce();
  });
});
