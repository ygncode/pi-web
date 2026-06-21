import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  applyToggleStateToNode,
  createToggleController,
  loadToggleState,
  saveToggleState,
  syncToggleButtons,
  TOGGLE_DEFAULT_SETTING_KEYS,
  TOGGLE_STATE_STORAGE_KEY,
} from './toggle-state.js';

function makeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
    _data: data,
  };
}

describe('toggle state helpers', () => {
  it('returns the hardcoded defaults when nothing is stored', () => {
    expect(loadToggleState({ storage: makeStorage() })).toEqual({
      thinkingExpanded: true,
      toolsVisible: true,
      toolOutputsExpanded: false,
    });
  });

  it('reads configured defaults from settings storage before falling back to hardcoded defaults', () => {
    const storage = makeStorage({
      [TOGGLE_DEFAULT_SETTING_KEYS.thinkingExpanded]: 'false',
      [TOGGLE_DEFAULT_SETTING_KEYS.toolOutputsExpanded]: 'true',
      // toolsVisible left unset → falls back to hardcoded default (true).
    });
    expect(loadToggleState({ storage })).toEqual({
      thinkingExpanded: false,
      toolsVisible: true,
      toolOutputsExpanded: true,
    });
  });

  it('per-session override wins over configured setting defaults, scoped to that session id', () => {
    const storage = makeStorage({
      [TOGGLE_DEFAULT_SETTING_KEYS.thinkingExpanded]: 'false',
      [TOGGLE_STATE_STORAGE_KEY]: JSON.stringify({
        'sess-a': { thinkingExpanded: true },
      }),
    });
    expect(loadToggleState({ sessionId: 'sess-a', storage })).toEqual({
      thinkingExpanded: true,
      toolsVisible: true,
      toolOutputsExpanded: false,
    });
    // Another session has no override, so the configured default applies.
    expect(loadToggleState({ sessionId: 'sess-b', storage })).toEqual({
      thinkingExpanded: false,
      toolsVisible: true,
      toolOutputsExpanded: false,
    });
  });

  it('discards the old global flat-state blob so the configured default applies', () => {
    // Simulate the pre-migration shape: a single flat state object at the key.
    // Without the migration, this would have shadowed every session.
    const storage = makeStorage({
      [TOGGLE_DEFAULT_SETTING_KEYS.toolOutputsExpanded]: 'false',
      [TOGGLE_STATE_STORAGE_KEY]: JSON.stringify({
        thinkingExpanded: true,
        toolsVisible: true,
        toolOutputsExpanded: true,
      }),
    });
    expect(loadToggleState({ sessionId: 'sess-a', storage })).toEqual({
      thinkingExpanded: true,
      toolsVisible: true,
      toolOutputsExpanded: false,
    });
  });

  it('saves state under the session id; no-ops without one', () => {
    const storage = makeStorage();
    saveToggleState(
      { thinkingExpanded: false, toolsVisible: true, toolOutputsExpanded: true },
      { sessionId: 'sess-a', storage },
    );
    expect(JSON.parse(storage.getItem(TOGGLE_STATE_STORAGE_KEY))).toEqual({
      'sess-a': {
        thinkingExpanded: false,
        toolsVisible: true,
        toolOutputsExpanded: true,
      },
    });

    // Saving for a different session preserves the first one's entry.
    saveToggleState(
      { thinkingExpanded: true, toolsVisible: false, toolOutputsExpanded: false },
      { sessionId: 'sess-b', storage },
    );
    expect(JSON.parse(storage.getItem(TOGGLE_STATE_STORAGE_KEY))).toEqual({
      'sess-a': {
        thinkingExpanded: false,
        toolsVisible: true,
        toolOutputsExpanded: true,
      },
      'sess-b': {
        thinkingExpanded: true,
        toolsVisible: false,
        toolOutputsExpanded: false,
      },
    });

    // Missing sessionId → no write (export view has no useful id).
    const empty = makeStorage();
    saveToggleState(
      { thinkingExpanded: false, toolsVisible: false, toolOutputsExpanded: true },
      { storage: empty },
    );
    expect(empty.getItem(TOGGLE_STATE_STORAGE_KEY)).toBeNull();
  });

  it('applies state to rendered nodes and buttons', () => {
    const dom = new JSDOM(`<div>
      <div class="thinking-text"></div><div class="thinking-collapsed"></div>
      <div class="tool-call-collapsed"></div><div class="tool-execution"></div><div class="tool-output expandable"></div><div class="compaction"></div>
      <button data-action="toggle-thinking"></button><button data-action="toggle-tools"></button><button data-action="toggle-tool-output"></button>
    </div>`);
    const state = { thinkingExpanded: false, toolsVisible: false, toolOutputsExpanded: true };
    applyToggleStateToNode(dom.window.document, state);
    syncToggleButtons(dom.window.document, state);

    expect(dom.window.document.querySelector('.thinking-text').style.display).toBe('none');
    expect(dom.window.document.querySelector('.thinking-collapsed').style.display).toBe('block');
    expect(dom.window.document.querySelector('.tool-execution').style.display).toBe('none');
    // Mirror placeholder appears when tools are hidden so a tool-only assistant
    // message keeps a visible marker instead of just a stranded timestamp.
    expect(dom.window.document.querySelector('.tool-call-collapsed').style.display).toBe('block');
    expect(dom.window.document.querySelector('.tool-output').classList.contains('expanded')).toBe(
      true,
    );
    expect(
      dom.window.document
        .querySelector('[data-action="toggle-thinking"]')
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      dom.window.document
        .querySelector('[data-action="toggle-tool-output"]')
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('disables the tool-output button when tools are hidden, re-enables when they reappear', () => {
    const dom = new JSDOM(
      `<button data-action="toggle-thinking"></button><button data-action="toggle-tools"></button><button data-action="toggle-tool-output"></button>`,
    );
    const toolOutputBtn = dom.window.document.querySelector('[data-action="toggle-tool-output"]');

    syncToggleButtons(dom.window.document, {
      thinkingExpanded: true,
      toolsVisible: false,
      toolOutputsExpanded: false,
    });
    expect(toolOutputBtn.disabled).toBe(true);

    syncToggleButtons(dom.window.document, {
      thinkingExpanded: true,
      toolsVisible: true,
      toolOutputsExpanded: false,
    });
    expect(toolOutputBtn.disabled).toBe(false);
  });

  it('toggleToolOutputs is a no-op while tools are hidden so the P shortcut stays quiet', () => {
    const dom = new JSDOM(
      `<button data-action="toggle-thinking"></button><button data-action="toggle-tools"></button><button data-action="toggle-tool-output"></button>`,
    );
    const storage = makeStorage();
    const controller = createToggleController({
      documentImpl: dom.window.document,
      storage,
      sessionId: 'sess-a',
      initialState: {
        thinkingExpanded: true,
        toolsVisible: false,
        toolOutputsExpanded: false,
      },
    });
    controller.toggleToolOutputs();
    expect(controller.toolOutputsExpanded).toBe(false);
    // Nothing was persisted, since no state change happened.
    expect(storage.getItem(TOGGLE_STATE_STORAGE_KEY)).toBeNull();

    // Re-enable tools, then the toggle works normally.
    controller.toggleToolsVisibility();
    controller.toggleToolOutputs();
    expect(controller.toolOutputsExpanded).toBe(true);
  });

  it('hides the tool-call placeholder when tools are visible', () => {
    const dom = new JSDOM(
      `<div><div class="tool-call-collapsed"></div><div class="tool-execution"></div></div>`,
    );
    applyToggleStateToNode(dom.window.document, {
      thinkingExpanded: true,
      toolsVisible: true,
      toolOutputsExpanded: false,
    });
    expect(dom.window.document.querySelector('.tool-call-collapsed').style.display).toBe('none');
    expect(dom.window.document.querySelector('.tool-execution').style.display).toBe('');
  });

  it('controller reload picks up settings written after creation (cold-cache first paint)', () => {
    // Simulate the cold-cache case: the controller is created before
    // hydrateSettings() has populated localStorage with the server-backed
    // defaults, so loadToggleState falls back to the hardcoded defaults. Once
    // hydration completes and the keys appear, reload() must re-read storage
    // and re-apply to the rendered DOM + buttons.
    const dom = new JSDOM(
      `<div class="thinking-text"></div><div class="thinking-collapsed"></div>` +
        `<button data-action="toggle-thinking"></button>` +
        `<button data-action="toggle-tools"></button>` +
        `<button data-action="toggle-tool-output"></button>`,
    );
    const storage = makeStorage();
    const controller = createToggleController({
      documentImpl: dom.window.document,
      storage,
      sessionId: 'sess-a',
    });
    controller.attachHeaderHandlers();
    // Initial state matches hardcoded defaults (true/true/false).
    expect(controller.thinkingExpanded).toBe(true);
    expect(
      dom.window.document
        .querySelector('[data-action="toggle-thinking"]')
        .getAttribute('aria-pressed'),
    ).toBe('true');

    // Hydration writes the server defaults under the user-setting keys.
    storage.setItem(TOGGLE_DEFAULT_SETTING_KEYS.thinkingExpanded, 'false');
    storage.setItem(TOGGLE_DEFAULT_SETTING_KEYS.toolsVisible, 'false');

    controller.reload();
    expect(controller.thinkingExpanded).toBe(false);
    expect(controller.toolsVisible).toBe(false);
    // Re-applied to the DOM: thinking text hidden, collapsed placeholder shown.
    expect(dom.window.document.querySelector('.thinking-text').style.display).toBe('none');
    expect(dom.window.document.querySelector('.thinking-collapsed').style.display).toBe('block');
    // Header button reflects the new state.
    expect(
      dom.window.document
        .querySelector('[data-action="toggle-thinking"]')
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('controller persists toggles under its session id and other sessions are unaffected', () => {
    const dom = new JSDOM(
      `<button data-action="toggle-thinking"></button><div class="thinking-text"></div><div class="thinking-collapsed"></div>`,
    );
    const storage = makeStorage();
    const controller = createToggleController({
      documentImpl: dom.window.document,
      storage,
      sessionId: 'sess-a',
    });
    controller.attachHeaderHandlers();

    dom.window.document.querySelector('[data-action="toggle-thinking"]').click();

    expect(controller.thinkingExpanded).toBe(false);
    expect(JSON.parse(storage.getItem(TOGGLE_STATE_STORAGE_KEY))).toEqual({
      'sess-a': {
        thinkingExpanded: false,
        toolsVisible: true,
        toolOutputsExpanded: false,
      },
    });

    // A fresh load for a different session ignores sess-a's override.
    expect(loadToggleState({ sessionId: 'sess-b', storage })).toEqual({
      thinkingExpanded: true,
      toolsVisible: true,
      toolOutputsExpanded: false,
    });
  });
});
