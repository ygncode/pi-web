export const TOGGLE_STATE_STORAGE_KEY = 'pi.sessionDetail.toggleState';
export const TOGGLE_DEFAULT_SETTING_KEYS = {
  thinkingExpanded: 'pi-web:v1:toggle:thinking',
  toolsVisible: 'pi-web:v1:toggle:tools',
  toolOutputsExpanded: 'pi-web:v1:toggle:tool-outputs',
};
export const toggleStateDefaults = {
  thinkingExpanded: true,
  toolsVisible: true,
  toolOutputsExpanded: false,
};

function readBoolSetting(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch (_) {}
  return fallback;
}

// Read the persisted per-session map. Older builds stored a single flat state
// object at this key (one shared override for every session); that shape is
// discarded here so the configured Session Display defaults apply going
// forward instead of being shadowed by a stale global toggle.
function readSessionMap(storage) {
  try {
    const raw = storage?.getItem(TOGGLE_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    if (
      'thinkingExpanded' in parsed ||
      'toolsVisible' in parsed ||
      'toolOutputsExpanded' in parsed
    ) {
      // Old flat-state shape — treat as no overrides.
      return {};
    }
    return parsed;
  } catch (_) {
    return {};
  }
}

// loadToggleState builds the initial header-toggle state in three layers:
// 1. Hardcoded defaults (toggleStateDefaults).
// 2. Server-backed per-user defaults (TOGGLE_DEFAULT_SETTING_KEYS), already
//    mirrored into localStorage by the settings hydration on page load.
// 3. The per-session override for `sessionId`, if any — set when the user
//    toggled a header button in that specific session, so the next time they
//    open the SAME session it remembers their last choice. Other sessions are
//    not affected, so changing a default in /settings takes effect everywhere
//    the user hasn't explicitly overridden it.
export function loadToggleState({ sessionId = '', storage = globalThis.localStorage } = {}) {
  const state = { ...toggleStateDefaults };
  for (const [stateKey, settingKey] of Object.entries(TOGGLE_DEFAULT_SETTING_KEYS)) {
    state[stateKey] = readBoolSetting(storage, settingKey, state[stateKey]);
  }
  if (!sessionId) return state;
  const saved = readSessionMap(storage)[sessionId];
  if (saved && typeof saved === 'object') {
    if (typeof saved.thinkingExpanded === 'boolean')
      state.thinkingExpanded = saved.thinkingExpanded;
    if (typeof saved.toolsVisible === 'boolean') state.toolsVisible = saved.toolsVisible;
    if (typeof saved.toolOutputsExpanded === 'boolean')
      state.toolOutputsExpanded = saved.toolOutputsExpanded;
  }
  return state;
}

export function saveToggleState(state, { sessionId = '', storage = globalThis.localStorage } = {}) {
  if (!sessionId) return;
  try {
    const map = readSessionMap(storage);
    map[sessionId] = {
      thinkingExpanded: state.thinkingExpanded,
      toolsVisible: state.toolsVisible,
      toolOutputsExpanded: state.toolOutputsExpanded,
    };
    storage?.setItem(TOGGLE_STATE_STORAGE_KEY, JSON.stringify(map));
  } catch (_) {}
}

export function applyToggleStateToNode(node, state) {
  if (!node) return;
  node.querySelectorAll('.thinking-text').forEach((el) => {
    el.style.display = state.thinkingExpanded ? '' : 'none';
  });
  node.querySelectorAll('.thinking-collapsed').forEach((el) => {
    el.style.display = state.thinkingExpanded ? 'none' : 'block';
  });
  node.querySelectorAll('.tool-execution, .compaction').forEach((el) => {
    el.style.display = state.toolsVisible ? '' : 'none';
  });
  // Mirrors the .thinking-text / .thinking-collapsed pair: show a "Tool: <name>
  // ..." placeholder so a hidden tool call still has a visible marker (and an
  // assistant message whose only content is a tool call isn't a stranded
  // timestamp). The placeholder lives next to each .tool-execution in
  // ToolCall.svelte.
  node.querySelectorAll('.tool-call-collapsed').forEach((el) => {
    el.style.display = state.toolsVisible ? 'none' : 'block';
  });
  node.querySelectorAll('.tool-output.expandable').forEach((el) => {
    el.classList.toggle('expanded', state.toolOutputsExpanded);
  });
  node.querySelectorAll('.compaction').forEach((el) => {
    el.classList.toggle('expanded', state.toolOutputsExpanded);
  });
}

export function syncToggleButtons(documentImpl, state) {
  const buttons = [
    [documentImpl.querySelector('[data-action="toggle-thinking"]'), state.thinkingExpanded],
    [documentImpl.querySelector('[data-action="toggle-tools"]'), state.toolsVisible],
    [documentImpl.querySelector('[data-action="toggle-tool-output"]'), state.toolOutputsExpanded],
  ];
  buttons.forEach(([btn, isActive]) => {
    if (!btn) return;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  // The tool-output toggle has no visible effect while tool calls are hidden,
  // since the output blocks live inside the .tool-execution wrapper that's
  // already display:none. Disable it (and its keyboard shortcut, see
  // createToggleController.toggleToolOutputs) so the control doesn't claim to
  // do something it can't until tools are turned back on.
  const toolOutputBtn = documentImpl.querySelector('[data-action="toggle-tool-output"]');
  if (toolOutputBtn) {
    toolOutputBtn.disabled = !state.toolsVisible;
  }
}

export function createToggleController({
  documentImpl = document,
  storage = globalThis.localStorage,
  sessionId = '',
  initialState = loadToggleState({ sessionId, storage }),
} = {}) {
  const state = initialState;
  const applyToNode = (node) => applyToggleStateToNode(node, state);
  const syncButtons = () => syncToggleButtons(documentImpl, state);
  const save = () => saveToggleState(state, { sessionId, storage });
  const toggle = (key) => {
    state[key] = !state[key];
    save();
    applyToNode(documentImpl);
    syncButtons();
  };

  return {
    state,
    get thinkingExpanded() {
      return state.thinkingExpanded;
    },
    get toolsVisible() {
      return state.toolsVisible;
    },
    get toolOutputsExpanded() {
      return state.toolOutputsExpanded;
    },
    applyToNode,
    syncButtons,
    toggleThinking: () => toggle('thinkingExpanded'),
    toggleToolsVisibility: () => toggle('toolsVisible'),
    toggleToolOutputs: () => {
      // Hidden tool calls have no visible output to expand or collapse — no-op
      // so the P shortcut and a disabled button click both stay quiet.
      if (!state.toolsVisible) return;
      toggle('toolOutputsExpanded');
    },
    attachHeaderHandlers() {
      documentImpl
        .querySelector('[data-action="toggle-thinking"]')
        ?.addEventListener('click', this.toggleThinking);
      documentImpl
        .querySelector('[data-action="toggle-tools"]')
        ?.addEventListener('click', this.toggleToolsVisibility);
      documentImpl
        .querySelector('[data-action="toggle-tool-output"]')
        ?.addEventListener('click', this.toggleToolOutputs);
      syncButtons();
    },
  };
}
