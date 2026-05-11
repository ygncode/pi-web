import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { applySidebarWidth, clampSidebarWidth, loadSidebarWidth, saveSidebarWidth, setSidebarOpen, SIDEBAR_WIDTH_STORAGE_KEY } from './sidebar.js';

function dom() {
  const jsdom = new JSDOM(`<body><button id="hamburger"></button><aside id="sidebar"></aside><div id="sidebar-overlay"></div><div id="sidebar-resizer"></div></body>`);
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
