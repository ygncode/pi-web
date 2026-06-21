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

// loadToggleState builds the initial header-toggle state in three layers:
// 1. Hardcoded defaults (toggleStateDefaults).
// 2. Server-backed per-user defaults (TOGGLE_DEFAULT_SETTING_KEYS), already
//    mirrored into localStorage by the settings hydration on page load.
// 3. The per-session JSON blob (TOGGLE_STATE_STORAGE_KEY), which remembers the
//    user's most recent in-session toggle and wins over the configured default.
//    The settings UI clears the relevant blob entry on save (see
//    clearPersistedToggleOverride) so changing a default takes effect on next
//    session load instead of being shadowed by a stale runtime override.
export function loadToggleState({ storage = globalThis.localStorage } = {}) {
  const state = { ...toggleStateDefaults };
  for (const [stateKey, settingKey] of Object.entries(TOGGLE_DEFAULT_SETTING_KEYS)) {
    state[stateKey] = readBoolSetting(storage, settingKey, state[stateKey]);
  }
  try {
    const saved = JSON.parse(storage?.getItem(TOGGLE_STATE_STORAGE_KEY) || '{}');
    if (typeof saved.thinkingExpanded === 'boolean')
      state.thinkingExpanded = saved.thinkingExpanded;
    if (typeof saved.toolsVisible === 'boolean') state.toolsVisible = saved.toolsVisible;
    if (typeof saved.toolOutputsExpanded === 'boolean')
      state.toolOutputsExpanded = saved.toolOutputsExpanded;
  } catch (_) {}
  return state;
}

// Drop one key from the persisted per-session blob so the next loadToggleState
// falls back to the (just-changed) configured default. Other keys in the blob
// are preserved.
export function clearPersistedToggleOverride(stateKey, { storage = globalThis.localStorage } = {}) {
  try {
    const saved = JSON.parse(storage?.getItem(TOGGLE_STATE_STORAGE_KEY) || '{}');
    if (!(stateKey in saved)) return;
    delete saved[stateKey];
    if (Object.keys(saved).length === 0) {
      storage?.removeItem(TOGGLE_STATE_STORAGE_KEY);
    } else {
      storage?.setItem(TOGGLE_STATE_STORAGE_KEY, JSON.stringify(saved));
    }
  } catch (_) {}
}

export function saveToggleState(state, { storage = globalThis.localStorage } = {}) {
  try {
    storage?.setItem(TOGGLE_STATE_STORAGE_KEY, JSON.stringify(state));
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
}

export function createToggleController({
  documentImpl = document,
  storage = globalThis.localStorage,
  initialState = loadToggleState({ storage }),
} = {}) {
  const state = initialState;
  const applyToNode = (node) => applyToggleStateToNode(node, state);
  const syncButtons = () => syncToggleButtons(documentImpl, state);
  const save = () => saveToggleState(state, { storage });
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
    toggleToolOutputs: () => toggle('toolOutputsExpanded'),
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
