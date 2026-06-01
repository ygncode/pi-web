import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  applySidebarWidth, clampSidebarWidth, loadSidebarWidth, saveSidebarWidth,
  setSidebarOpen, SIDEBAR_WIDTH_STORAGE_KEY,
  loadSidebarCollapsed, saveSidebarCollapsed, setSidebarCollapsed,
  SIDEBAR_COLLAPSED_STORAGE_KEY, setupSidebarCollapse, setupSidebarResize
} from './sidebar.js';

function dom() {
  const jsdom = new JSDOM(`<body>
    <button id="hamburger"></button>
    <aside id="sidebar"></aside>
    <div id="sidebar-overlay"></div>
    <div id="sidebar-resizer"></div>
    <button id="hide-sidebar" class="hide-sidebar"></button>
  </body>`);
  Object.defineProperty(jsdom.window, 'innerWidth', { value: 1000, configurable: true });
  jsdom.window.matchMedia = () => ({ matches: false });
  return jsdom;
}

describe('sidebar helpers', () => {
  it('loads and saves sidebar width', () => {
    expect(loadSidebarWidth({ storage: { getItem: () => '420' } })).toBe(420);
    expect(loadSidebarWidth({ storage: { getItem: () => 'nope' } })).toBe(null);

    const storage = { setItem: vi.fn() };
    const jsdom = dom();
    saveSidebarWidth(500, { storage, documentImpl: jsdom.window.document, windowImpl: jsdom.window });
    expect(storage.setItem).toHaveBeenCalledWith(SIDEBAR_WIDTH_STORAGE_KEY, '500');
  });

  it('clamps and applies width using CSS vars', () => {
    const jsdom = dom();
    jsdom.window.document.documentElement.style.setProperty('--sidebar-min-width', '240px');
    jsdom.window.document.documentElement.style.setProperty('--sidebar-max-width', '720px');

    expect(clampSidebarWidth(100, { documentImpl: jsdom.window.document, windowImpl: jsdom.window })).toBe(240);
    expect(clampSidebarWidth(900, { documentImpl: jsdom.window.document, windowImpl: jsdom.window })).toBe(680);
    applySidebarWidth(333.4, { documentImpl: jsdom.window.document, windowImpl: jsdom.window });
    expect(jsdom.window.document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('333px');
  });

  it('toggles sidebar open state', () => {
    const jsdom = dom();
    setSidebarOpen(true, { documentImpl: jsdom.window.document });
    expect(jsdom.window.document.getElementById('sidebar').classList.contains('open')).toBe(true);
    expect(jsdom.window.document.body.classList.contains('sidebar-open')).toBe(true);
    expect(jsdom.window.document.getElementById('hamburger').style.display).toBe('none');

    setSidebarOpen(false, { documentImpl: jsdom.window.document });
    expect(jsdom.window.document.getElementById('sidebar').classList.contains('open')).toBe(false);
    expect(jsdom.window.document.getElementById('hamburger').style.display).toBe('');
  });
});

describe('sidebar collapsed state', () => {
  it('loads collapsed state from storage', () => {
    expect(loadSidebarCollapsed({ storage: { getItem: () => 'true' } })).toBe(true);
    expect(loadSidebarCollapsed({ storage: { getItem: () => 'false' } })).toBe(false);
    expect(loadSidebarCollapsed({ storage: { getItem: () => null } })).toBe(false);
    expect(loadSidebarCollapsed({ storage: { getItem: () => { throw new Error('fail'); } } })).toBe(false);
  });

  it('saves collapsed state to storage', () => {
    const storage = { setItem: vi.fn() };
    saveSidebarCollapsed(true, { storage });
    expect(storage.setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');
    saveSidebarCollapsed(false, { storage });
    expect(storage.setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY, 'false');
  });

  it('toggles sidebar-collapsed class on body and hamburger visibility', () => {
    const jsdom = dom();
    setSidebarCollapsed(true, { documentImpl: jsdom.window.document });
    expect(jsdom.window.document.body.classList.contains('sidebar-collapsed')).toBe(true);
    expect(jsdom.window.document.getElementById('hamburger').style.display).toBe('');

    setSidebarCollapsed(false, { documentImpl: jsdom.window.document });
    expect(jsdom.window.document.body.classList.contains('sidebar-collapsed')).toBe(false);
    expect(jsdom.window.document.getElementById('hamburger').style.display).toBe('none');
  });
});

describe('setupSidebarCollapse', () => {
  function collapseDom() {
    const jsdom = new JSDOM(`<body>
      <button id="hamburger"></button>
      <button id="tree-toggle" aria-pressed="true"></button>
      <aside id="sidebar"></aside>
      <div id="sidebar-overlay"></div>
      <button id="hide-sidebar" class="hide-sidebar"></button>
      <button id="sidebar-close" class="sidebar-close"></button>
    </body>`);
    Object.defineProperty(jsdom.window, 'innerWidth', { value: 1200, configurable: true });
    jsdom.window.matchMedia = () => ({ matches: false });
    return jsdom;
  }

  it('applies saved collapsed state on init', () => {
    const jsdom = collapseDom();
    const storage = { getItem: () => 'true', setItem: vi.fn() };
    setupSidebarCollapse({ documentImpl: jsdom.window.document, windowImpl: jsdom.window, storage });
    expect(jsdom.window.document.body.classList.contains('sidebar-collapsed')).toBe(true);
  });

  it('does not flash expanded sidebar when class already set before js runs', () => {
    const jsdom = collapseDom();
    jsdom.window.document.body.classList.add('sidebar-collapsed');
    const storage = { getItem: () => 'true', setItem: vi.fn() };
    setupSidebarCollapse({ documentImpl: jsdom.window.document, windowImpl: jsdom.window, storage });
    expect(jsdom.window.document.body.classList.contains('sidebar-collapsed')).toBe(true);
  });

  it('hamburger click expands collapsed sidebar', () => {
    const jsdom = collapseDom();
    const storage = { getItem: () => 'true', setItem: vi.fn() };
    setupSidebarCollapse({ documentImpl: jsdom.window.document, windowImpl: jsdom.window, storage });
    jsdom.window.document.getElementById('hamburger').click();
    expect(jsdom.window.document.body.classList.contains('sidebar-collapsed')).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY, 'false');
  });

  it('hide-sidebar click collapses expanded sidebar', () => {
    const jsdom = collapseDom();
    const storage = { getItem: () => 'false', setItem: vi.fn() };
    setupSidebarCollapse({ documentImpl: jsdom.window.document, windowImpl: jsdom.window, storage });
    jsdom.window.document.getElementById('hide-sidebar').click();
    expect(jsdom.window.document.body.classList.contains('sidebar-collapsed')).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');
  });

  it('sidebar-close click closes the open mobile sidebar', () => {
    const jsdom = collapseDom();
    jsdom.window.matchMedia = () => ({ matches: true });
    const storage = { getItem: () => 'false', setItem: vi.fn() };
    setupSidebarCollapse({ documentImpl: jsdom.window.document, windowImpl: jsdom.window, storage });
    const sidebar = jsdom.window.document.getElementById('sidebar');
    sidebar.classList.add('open');
    jsdom.window.document.body.classList.add('sidebar-open');
    jsdom.window.document.getElementById('sidebar-close').click();
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(jsdom.window.document.body.classList.contains('sidebar-open')).toBe(false);
  });

  it('tree-toggle click toggles collapse and reflects aria-pressed', () => {
    const jsdom = collapseDom();
    const storage = { getItem: () => 'false', setItem: vi.fn() };
    setupSidebarCollapse({ documentImpl: jsdom.window.document, windowImpl: jsdom.window, storage });
    const treeToggle = jsdom.window.document.getElementById('tree-toggle');
    expect(treeToggle.getAttribute('aria-pressed')).toBe('true');

    treeToggle.click();
    expect(jsdom.window.document.body.classList.contains('sidebar-collapsed')).toBe(true);
    expect(treeToggle.getAttribute('aria-pressed')).toBe('false');
    expect(storage.setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');

    treeToggle.click();
    expect(jsdom.window.document.body.classList.contains('sidebar-collapsed')).toBe(false);
    expect(treeToggle.getAttribute('aria-pressed')).toBe('true');
    expect(storage.setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY, 'false');
  });

});

describe('setupSidebarResize', () => {
  function resizeDom() {
    const jsdom = new JSDOM(`<body>
      <button id="hamburger"></button>
      <aside id="sidebar" style="width:400px;"></aside>
      <div id="sidebar-resizer"></div>
    </body>`);
    Object.defineProperty(jsdom.window, 'innerWidth', { value: 1200, configurable: true });
    jsdom.window.matchMedia = () => ({ matches: false });
    return jsdom;
  }

  it('does not toggle collapsed state via resizer drag area', () => {
    const jsdom = resizeDom();
    const storage = { getItem: () => 'false', setItem: vi.fn() };
    setupSidebarResize({ documentImpl: jsdom.window.document, windowImpl: jsdom.window, storage });
    jsdom.window.document.getElementById('sidebar-resizer').click();
    expect(jsdom.window.document.body.classList.contains('sidebar-collapsed')).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
