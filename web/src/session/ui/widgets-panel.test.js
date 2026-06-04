import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupRightSidebarTabs, setupWidgetsPanel } from './widgets-panel.js';

function dom() {
  return new JSDOM(`<body>
    <aside id="right-sidebar">
      <div class="right-sidebar-header">
        <div class="right-sidebar-tabs">
          <button class="right-sidebar-tab is-active" data-pane="scratchpad" aria-selected="true">Scratchpad</button>
          <button class="right-sidebar-tab" data-pane="widgets" aria-selected="false">Widgets</button>
        </div>
      </div>
      <div id="right-sidebar-pane-scratchpad" class="right-sidebar-content right-sidebar-pane is-active"></div>
      <div id="right-sidebar-pane-widgets" class="right-sidebar-content right-sidebar-pane" hidden>
        <div id="widgets-panel" class="widgets-panel"></div>
      </div>
      <div class="right-sidebar-footer"><span id="scratchpad-status">Saved</span></div>
    </aside>
  </body>`);
}

function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, v); },
  };
}

describe('setupRightSidebarTabs', () => {
  it('activates the widgets tab on click', () => {
    const jsdom = dom();
    const doc = jsdom.window.document;
    setupRightSidebarTabs({ documentImpl: doc, storage: makeStorage() });

    const widgetsTab = doc.querySelector('.right-sidebar-tab[data-pane="widgets"]');
    widgetsTab.click();

    expect(widgetsTab.classList.contains('is-active')).toBe(true);
    expect(widgetsTab.getAttribute('aria-selected')).toBe('true');
    expect(doc.getElementById('right-sidebar-pane-widgets').hasAttribute('hidden')).toBe(false);
    expect(doc.getElementById('right-sidebar-pane-scratchpad').hasAttribute('hidden')).toBe(true);
  });

  it('hides scratchpad-status footer on widgets tab', () => {
    const jsdom = dom();
    const doc = jsdom.window.document;
    setupRightSidebarTabs({ documentImpl: doc, storage: makeStorage() });
    doc.querySelector('.right-sidebar-tab[data-pane="widgets"]').click();
    expect(doc.querySelector('.right-sidebar-footer').style.display).toBe('none');
  });

  it('persists the active pane to storage', () => {
    const jsdom = dom();
    const doc = jsdom.window.document;
    const storage = makeStorage();
    setupRightSidebarTabs({ documentImpl: doc, storage });
    doc.querySelector('.right-sidebar-tab[data-pane="widgets"]').click();
    expect(storage.getItem('pi-web:v1:right-sidebar-pane')).toBe('widgets');
  });

  it('restores the active pane from storage on init', () => {
    const jsdom = dom();
    const doc = jsdom.window.document;
    const storage = makeStorage();
    storage.setItem('pi-web:v1:right-sidebar-pane', 'widgets');
    setupRightSidebarTabs({ documentImpl: doc, storage });
    expect(doc.getElementById('right-sidebar-pane-widgets').hasAttribute('hidden')).toBe(false);
  });
});

describe('setupWidgetsPanel', () => {
  it('renders an empty-state when no widgets', async () => {
    const jsdom = dom();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ widgets: [] }) }));
    setupWidgetsPanel({
      sessionId: 's1',
      documentImpl: jsdom.window.document,
      windowImpl: jsdom.window,
      fetchImpl: fetchMock,
      EventSourceImpl: null,
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledWith('/api/widgets?session=s1');
    expect(jsdom.window.document.getElementById('widgets-panel').textContent).toMatch(/No widgets yet/);
  });

  it('renders widget sections from snapshot', async () => {
    const jsdom = dom();
    const widgets = [
      { key: 'todos', lines: ['3 pending', '1 done'], placement: 'belowEditor' },
      { key: 'goals', lines: ['Migrate to PG'], placement: 'aboveEditor' },
    ];
    setupWidgetsPanel({
      sessionId: 's1',
      documentImpl: jsdom.window.document,
      windowImpl: jsdom.window,
      fetchImpl: async () => ({ ok: true, json: async () => ({ widgets }) }),
      EventSourceImpl: null,
    });
    await new Promise((r) => setTimeout(r, 0));
    const panel = jsdom.window.document.getElementById('widgets-panel');
    const sections = panel.querySelectorAll('section.widget');
    expect(sections.length).toBe(2);
    expect(sections[0].dataset.key).toBe('todos');
    expect(sections[0].textContent).toContain('3 pending');
  });

  it('patches a section on widget-update SSE event', async () => {
    const jsdom = dom();
    const listeners = new Map();
    class FakeES {
      constructor() { listeners.set('instance', this); }
      addEventListener(type, fn) { listeners.set(type, fn); }
      close() {}
    }
    setupWidgetsPanel({
      sessionId: 's1',
      documentImpl: jsdom.window.document,
      windowImpl: jsdom.window,
      fetchImpl: async () => ({ ok: true, json: async () => ({ widgets: [] }) }),
      EventSourceImpl: FakeES,
    });
    await new Promise((r) => setTimeout(r, 0));

    // Simulate the SSE event arrival.
    const handler = listeners.get('widget-update');
    handler({ data: JSON.stringify({
      session_id: 's1',
      widget: { key: 'todos', lines: ['2 pending'], placement: 'belowEditor' },
      removed: false,
    }) });

    const panel = jsdom.window.document.getElementById('widgets-panel');
    expect(panel.querySelector('section.widget[data-key="todos"]')).not.toBeNull();
    expect(panel.textContent).toContain('2 pending');
  });

  it('removes a section on widget-update with removed=true', async () => {
    const jsdom = dom();
    const widgets = [{ key: 'todos', lines: ['a'], placement: 'belowEditor' }];
    let handler;
    class FakeES {
      addEventListener(type, fn) { if (type === 'widget-update') handler = fn; }
      close() {}
    }
    setupWidgetsPanel({
      sessionId: 's1',
      documentImpl: jsdom.window.document,
      windowImpl: jsdom.window,
      fetchImpl: async () => ({ ok: true, json: async () => ({ widgets }) }),
      EventSourceImpl: FakeES,
    });
    await new Promise((r) => setTimeout(r, 0));
    handler({ data: JSON.stringify({
      session_id: 's1',
      widget: { key: 'todos' },
      removed: true,
    }) });

    const panel = jsdom.window.document.getElementById('widgets-panel');
    expect(panel.querySelector('section.widget[data-key="todos"]')).toBeNull();
    expect(panel.textContent).toMatch(/No widgets yet/);
  });
});
