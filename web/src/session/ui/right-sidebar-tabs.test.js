import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupRightSidebarTabs } from './right-sidebar.js';

function makeDom() {
  const dom = new JSDOM(`
    <aside id="right-sidebar">
      <div class="right-sidebar-tabs">
        <button class="right-sidebar-tab active" data-pane="scratchpad" aria-selected="true">Scratchpad</button>
        <button class="right-sidebar-tab" data-pane="artifacts" aria-selected="false">Artifacts</button>
      </div>
      <div class="right-sidebar-content">
        <div id="right-pane-scratchpad" class="right-sidebar-pane active"></div>
        <div id="right-pane-artifacts" class="right-sidebar-pane" hidden></div>
      </div>
    </aside>
  `);
  return dom.window.document;
}

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

describe('setupRightSidebarTabs', () => {
  it('switches panes and aria state on tab click', () => {
    const doc = makeDom();
    setupRightSidebarTabs({ documentImpl: doc, storage: memoryStorage() });

    doc.querySelector('[data-pane="artifacts"]').click();

    expect(doc.querySelector('[data-pane="artifacts"]').classList.contains('active')).toBe(true);
    expect(doc.querySelector('[data-pane="artifacts"]').getAttribute('aria-selected')).toBe('true');
    expect(doc.querySelector('[data-pane="scratchpad"]').getAttribute('aria-selected')).toBe('false');
    expect(doc.getElementById('right-pane-artifacts').hasAttribute('hidden')).toBe(false);
    expect(doc.getElementById('right-pane-scratchpad').hasAttribute('hidden')).toBe(true);
  });

  it('persists the active tab and restores it on the next setup', () => {
    const storage = memoryStorage();
    const doc1 = makeDom();
    setupRightSidebarTabs({ documentImpl: doc1, storage });
    doc1.querySelector('[data-pane="artifacts"]').click();
    expect(storage.getItem('pi-web:v1:right-sidebar-tab')).toBe('artifacts');

    const doc2 = makeDom();
    setupRightSidebarTabs({ documentImpl: doc2, storage });
    expect(doc2.getElementById('right-pane-artifacts').hasAttribute('hidden')).toBe(false);
    expect(doc2.querySelector('[data-pane="artifacts"]').classList.contains('active')).toBe(true);
  });

  it('returns a no-op activate when tabs are absent', () => {
    const dom = new JSDOM('<div></div>');
    const { activate } = setupRightSidebarTabs({ documentImpl: dom.window.document, storage: memoryStorage() });
    expect(() => activate('artifacts')).not.toThrow();
  });

  it('marks the active tab on the sidebar for tab-scoped chrome (help button)', () => {
    const doc = makeDom();
    setupRightSidebarTabs({ documentImpl: doc, storage: memoryStorage() });
    expect(doc.getElementById('right-sidebar').dataset.activeTab).toBe('scratchpad');
    doc.querySelector('[data-pane="artifacts"]').click();
    expect(doc.getElementById('right-sidebar').dataset.activeTab).toBe('artifacts');
  });

  it('ignores activation for an unknown pane name', () => {
    const doc = makeDom();
    const { activate } = setupRightSidebarTabs({ documentImpl: doc, storage: memoryStorage() });
    activate('nonexistent');
    expect(doc.querySelector('[data-pane="scratchpad"]').classList.contains('active')).toBe(true);
  });
});
