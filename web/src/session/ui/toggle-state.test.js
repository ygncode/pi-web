import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { applyToggleStateToNode, createToggleController, loadToggleState, saveToggleState, syncToggleButtons, TOGGLE_STATE_STORAGE_KEY } from './toggle-state.js';

describe('toggle state helpers', () => {
  it('loads defaults and saved booleans defensively', () => {
    expect(loadToggleState({ storage: { getItem: () => null } })).toEqual({ thinkingExpanded: true, toolsVisible: true, toolOutputsExpanded: false });
    expect(loadToggleState({ storage: { getItem: () => '{"thinkingExpanded":false,"toolsVisible":false,"toolOutputsExpanded":true}' } })).toEqual({ thinkingExpanded: false, toolsVisible: false, toolOutputsExpanded: true });
  });

  it('saves state', () => {
    const storage = { setItem: vi.fn() };
    saveToggleState({ thinkingExpanded: false }, { storage });
    expect(storage.setItem).toHaveBeenCalledWith(TOGGLE_STATE_STORAGE_KEY, JSON.stringify({ thinkingExpanded: false }));
  });

  it('applies state to rendered nodes and buttons', () => {
    const dom = new JSDOM(`<div>
      <div class="thinking-text"></div><div class="thinking-collapsed"></div>
      <div class="tool-execution"></div><div class="tool-output expandable"></div><div class="compaction"></div>
      <button data-action="toggle-thinking"></button><button data-action="toggle-tools"></button><button data-action="toggle-tool-output"></button>
    </div>`);
    const state = { thinkingExpanded: false, toolsVisible: false, toolOutputsExpanded: true };
    applyToggleStateToNode(dom.window.document, state);
    syncToggleButtons(dom.window.document, state);

    expect(dom.window.document.querySelector('.thinking-text').style.display).toBe('none');
    expect(dom.window.document.querySelector('.thinking-collapsed').style.display).toBe('block');
    expect(dom.window.document.querySelector('.tool-execution').style.display).toBe('none');
    expect(dom.window.document.querySelector('.tool-output').classList.contains('expanded')).toBe(true);
    expect(dom.window.document.querySelector('[data-action="toggle-thinking"]').getAttribute('aria-pressed')).toBe('false');
    expect(dom.window.document.querySelector('[data-action="toggle-tool-output"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('creates a controller for header toggles', () => {
    const dom = new JSDOM(`<button data-action="toggle-thinking"></button><div class="thinking-text"></div><div class="thinking-collapsed"></div>`);
    const storage = { setItem: vi.fn(), getItem: () => null };
    const controller = createToggleController({ documentImpl: dom.window.document, storage });
    controller.attachHeaderHandlers();

    dom.window.document.querySelector('[data-action="toggle-thinking"]').click();

    expect(controller.thinkingExpanded).toBe(false);
    expect(dom.window.document.querySelector('.thinking-text').style.display).toBe('none');
    expect(storage.setItem).toHaveBeenCalled();
  });
});
