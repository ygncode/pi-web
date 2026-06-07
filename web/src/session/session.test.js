import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionEntrypointLoaded, runSessionApp } from './session.js';
import { createSessionNavigator } from './navigation/session-navigation.js';

// SessionPage owns navigateTo (built from the model) and exposes it on window
// before runSessionApp; mirror that here so the direct runSessionApp() calls have
// the shared navigator available.
function installNavigator(target) {
  const nav = createSessionNavigator({
    documentImpl: target.document,
    setTimeoutImpl: (fn) => { fn(); return 0; },
    onNavigate: (leaf, t) => {
      const m = target.__piSessionDataModel;
      if (m) { m.currentLeafId = leaf; m.currentTargetId = t; }
    },
  });
  target.navigateTo = nav.navigateTo;
  target.__piSessionNavigator = nav;
}

describe('session entrypoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    window.history.pushState({}, '', '/');
    delete window.__piSessionDataModel;
    delete window.__piTreeRenderer;
    delete window.__piSessionNavigator;
    delete window.navigateTo;
    delete window.applyToggleStateToNode;
    delete window.sessionToggleState;
  });

  it('exports a load marker for smoke testing', () => {
    expect(sessionEntrypointLoaded).toBe(true);
  });

  it('owns direct module runtime bootstrap', () => {
    expect(runSessionApp).toBeInstanceOf(Function);
  });

  it('reconciles the session model when live reload receives new entries', async () => {
    const initialEntries = [
      {
        id: 'root',
        type: 'message',
        timestamp: '2026-01-01T00:00:00.000Z',
        message: { role: 'user', content: 'hello' }
      }
    ];
    const reloadedEntries = [
      ...initialEntries,
      {
        id: 'child',
        parentId: 'root',
        type: 'message',
        timestamp: '2026-01-01T00:00:01.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'hi there' }] }
      }
    ];
    const payload = { leafId: 'root', entries: initialEntries, header: { cwd: '/tmp' } };
    document.body.innerHTML = `
      <script id="session-data" type="application/json">${btoa(JSON.stringify(payload))}</script>
      <button id="hamburger"></button>
      <aside id="sidebar"></aside>
      <div id="sidebar-overlay"></div>
      <div id="sidebar-resizer"></div>
      <button id="hide-sidebar"></button>
      <input id="tree-search" />
      <div id="tree-container"></div>
      <div id="tree-status"></div>
      <div id="content"><div id="header-container"></div><div id="messages"></div></div>
    `;
    window.history.pushState({}, '', '/session?id=sess1');
    window.requestAnimationFrame = (fn) => { fn(); return 1; };
    window.scrollTo = vi.fn();
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(window, 'navigator', { value: {}, configurable: true });
    window.fetch = vi.fn(async () => new Response('{}', { status: 200 }));

    installNavigator(window);
    runSessionApp({ target: window });

    // The sidebar tree DOM is rendered by <SessionTreeNodes> and live reload
    // (SSE) by <LiveReload>; session.js owns reconciling the shared model, which
    // it exposes on window.__piReconcileEntries for <LiveReload> to call. This
    // asserts that reconciliation path.
    const model = window.__piSessionDataModel;
    expect(model.entries.map((e) => e.id)).toEqual(['root']);
    expect(typeof window.__piReconcileEntries).toBe('function');

    window.__piReconcileEntries(reloadedEntries);

    expect(model.entries.map((e) => e.id)).toEqual(['root', 'child']);
    // the active leaf advances to the newest entry
    expect(model.currentLeafId).toBe('child');
  });
});
