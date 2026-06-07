import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionEntrypointLoaded, runSessionApp } from './session.js';

describe('session entrypoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    window.history.pushState({}, '', '/');
    delete window.__piSessionDataModel;
    delete window.__piTreeRenderer;
    delete window.__piSessionNavigator;
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
    window.fetch = vi.fn(async (url) => {
      if (String(url).startsWith('/api/session')) {
        return new Response(JSON.stringify({ entries: reloadedEntries }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    class FakeEventSource {
      static instances = [];
      constructor(url) {
        this.url = url;
        this.readyState = 1;
        this.listeners = new Map();
        FakeEventSource.instances.push(this);
      }
      addEventListener(type, handler) { this.listeners.set(type, handler); }
      close() { this.readyState = 2; }
    }
    window.EventSource = FakeEventSource;

    runSessionApp({ target: window });

    // The sidebar tree DOM is now rendered by <SessionTreeNodes> from the
    // model (see SessionTreeNodes.test.js); session.js owns reconciling the
    // shared model on live reload, which is what we assert here.
    const model = window.__piSessionDataModel;
    expect(model.entries.map((e) => e.id)).toEqual(['root']);

    FakeEventSource.instances[0].onmessage({ data: 'reload' });

    await vi.waitFor(() => {
      expect(model.entries.map((e) => e.id)).toEqual(['root', 'child']);
    });
    // the active leaf advances to the newest entry
    expect(model.currentLeafId).toBe('child');
  });

  it('initializes live reload before chat so optimistic send events are observed', () => {
    const calls = [];
    const target = {
      document: {
        getElementById: vi.fn((id) => {
          if (id === 'session-data') return { textContent: btoa(JSON.stringify({ entries: [] })) };
          if (id === 'content') return { addEventListener: vi.fn() };
          return null;
        }),
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(() => []),
        addEventListener: vi.fn(),
        createElement: vi.fn(() => ({ textContent: '', innerHTML: '' })),
        body: { appendChild: vi.fn(), classList: { toggle: vi.fn() }, scrollHeight: 0 },
        documentElement: { scrollHeight: 0 },
        readyState: 'complete'
      },
      location: { search: '' },
      atob: (value) => Buffer.from(value, 'base64').toString('utf8'),
      marked: { parse: (value) => value },
      fetch: vi.fn(),
      EventSource: class EventSource { constructor() { this.readyState = 1; this.addEventListener = vi.fn(); this.close = vi.fn(); } },
      requestAnimationFrame: vi.fn((fn) => fn()),
      scrollTo: vi.fn(),
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
      setInterval: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
      addEventListener: vi.fn(),
      navigator: {},
      CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
      FormData: class FormData {},
      URLSearchParams,
      __piSessionDataModel: {
        entries: [],
        byId: new Map(),
        toolCallMap: new Map(),
        leafId: '',
        urlTargetId: '',
        header: { cwd: '/tmp' }
      }
    };

    const original = {
      live: globalThis.__PI_TEST_LIVE_RELOAD_HOOK__,
      chat: globalThis.__PI_TEST_CHAT_COMPOSER_HOOK__
    };
    globalThis.__PI_TEST_LIVE_RELOAD_HOOK__ = () => calls.push('live');
    globalThis.__PI_TEST_CHAT_COMPOSER_HOOK__ = () => calls.push('chat');
    try {
      runSessionApp({ target });
    } finally {
      globalThis.__PI_TEST_LIVE_RELOAD_HOOK__ = original.live;
      globalThis.__PI_TEST_CHAT_COMPOSER_HOOK__ = original.chat;
    }

    expect(calls).toEqual(['live', 'chat']);
  });
});
