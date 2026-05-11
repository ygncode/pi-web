import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { isEditableTarget, setupSessionKeyboardShortcuts, setupSessionSearchAndFilters } from './search-filters.js';

function dom() {
  return new JSDOM(`<body>
    <input id="tree-search" />
    <button class="filter-btn active" data-filter="default"></button>
    <button class="filter-btn" data-filter="all"></button>
  </body>`);
}

describe('session search/filter UI', () => {
  it('wires search input and filter buttons', () => {
    const jsdom = dom();
    const setSearchQuery = vi.fn();
    const setFilterMode = vi.fn();
    const forceTreeRerender = vi.fn();
    const navigateTo = vi.fn();
    const controls = setupSessionSearchAndFilters({
      documentImpl: jsdom.window.document,
      getLeafId: () => 'leaf',
      setSearchQuery,
      setFilterMode,
      forceTreeRerender,
      navigateTo
    });

    const input = jsdom.window.document.getElementById('tree-search');
    input.value = 'needle';
    input.dispatchEvent(new jsdom.window.Event('input', { bubbles: true }));
    expect(setSearchQuery).toHaveBeenCalledWith('needle');
    expect(forceTreeRerender).toHaveBeenCalledTimes(1);

    jsdom.window.document.querySelector('[data-filter="all"]').click();
    expect(setFilterMode).toHaveBeenCalledWith('all');
    expect(jsdom.window.document.querySelector('[data-filter="all"]').classList.contains('active')).toBe(true);

    controls.clearAndNavigateBottom();
    expect(input.value).toBe('');
    expect(setSearchQuery).toHaveBeenLastCalledWith('');
    expect(navigateTo).toHaveBeenCalledWith('leaf', 'bottom');
  });

  it('detects editable targets', () => {
    const jsdom = new JSDOM('<input><div contenteditable="true"><span></span></div><p></p>');
    expect(isEditableTarget(jsdom.window.document.querySelector('input'))).toBe(true);
    expect(isEditableTarget(jsdom.window.document.querySelector('span'))).toBe(true);
    expect(isEditableTarget(jsdom.window.document.querySelector('p'))).toBe(false);
  });

  it('wires keyboard shortcuts outside editable targets', () => {
    const jsdom = new JSDOM('<body><p tabindex="0"></p></body>');
    const clearSearch = vi.fn();
    const toggleThinking = vi.fn();
    const toggleToolsVisibility = vi.fn();
    const toggleToolOutputs = vi.fn();
    setupSessionKeyboardShortcuts({
      documentImpl: jsdom.window.document,
      clearSearch,
      toggleThinking,
      toggleToolsVisibility,
      toggleToolOutputs
    });

    jsdom.window.document.dispatchEvent(new jsdom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    jsdom.window.document.dispatchEvent(new jsdom.window.KeyboardEvent('keydown', { key: 't' }));
    jsdom.window.document.dispatchEvent(new jsdom.window.KeyboardEvent('keydown', { key: 'o' }));
    jsdom.window.document.dispatchEvent(new jsdom.window.KeyboardEvent('keydown', { key: 'p' }));

    expect(clearSearch).toHaveBeenCalled();
    expect(toggleThinking).toHaveBeenCalled();
    expect(toggleToolsVisibility).toHaveBeenCalled();
    expect(toggleToolOutputs).toHaveBeenCalled();
  });
});
