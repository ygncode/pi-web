import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupSessionUi } from './session-ui-runner.js';
import * as searchFiltersApi from './search-filters.js';
import * as sidebarApi from './sidebar.js';
import * as toggleStateApi from './toggle-state.js';
import { sessionRuntime, resetSessionRuntime } from '../session-runtime.js';

afterEach(() => resetSessionRuntime());

describe('session UI runner', () => {
  it('sets up markdown, sidebar, and toggles', () => {
    const dom = new JSDOM('<body><button id="hamburger"></button><div id="sidebar"></div><div id="sidebar-overlay"></div><div id="sidebar-resizer"></div><button id="hide-sidebar" class="hide-sidebar"></button><input id="tree-search"><button class="filter-btn" data-filter="all"></button></body>');
    dom.window.matchMedia = () => ({ matches: false });
    const markdownApi = { configureSessionMarkdown: vi.fn(), safeMarkedParse: vi.fn((text) => `<p>${text}</p>`) };
    const result = setupSessionUi({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      storage: { getItem: () => null, setItem: vi.fn() },
      marked: {},
      hljs: {},
      escapeHtml: String,
      markdownApi,
      searchFiltersApi,
      sidebarApi,
      toggleStateApi,
      getLeafId: () => 'leaf',
      setSearchQuery: vi.fn(),
      setFilterMode: vi.fn(),
      forceTreeRerender: vi.fn(),
      navigateTo: vi.fn()
    });
    expect(markdownApi.configureSessionMarkdown).toHaveBeenCalled();
    expect(result.safeMarkedParse('x')).toBe('<p>x</p>');
    expect(sessionRuntime.toggleState).toBeTruthy();
    expect(typeof result.attachHeaderHandlers).toBe('function');
  });

  it('applies desktop sidebar collapsed state on init', () => {
    const dom = new JSDOM('<body><button id="hamburger"></button><div id="sidebar"></div><div id="sidebar-overlay"></div><div id="sidebar-resizer"></div><button id="hide-sidebar" class="hide-sidebar"></button><input id="tree-search"><button class="filter-btn" data-filter="all"></button></body>');
    dom.window.matchMedia = () => ({ matches: false });
    const markdownApi = { configureSessionMarkdown: vi.fn(), safeMarkedParse: vi.fn((text) => `<p>${text}</p>`) };
    setupSessionUi({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      storage: { getItem: () => 'true', setItem: vi.fn() },
      marked: {},
      hljs: {},
      escapeHtml: String,
      markdownApi,
      searchFiltersApi,
      sidebarApi,
      toggleStateApi,
      getLeafId: () => 'leaf',
      setSearchQuery: vi.fn(),
      setFilterMode: vi.fn(),
      forceTreeRerender: vi.fn(),
      navigateTo: vi.fn()
    });
    expect(dom.window.document.body.classList.contains('sidebar-collapsed')).toBe(true);
  });
});
