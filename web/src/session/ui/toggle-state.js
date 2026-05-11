export const TOGGLE_STATE_STORAGE_KEY = 'pi.sessionDetail.toggleState';
export const toggleStateDefaults = { thinkingExpanded: true, toolsVisible: true, toolOutputsExpanded: false };

export function loadToggleState({ storage = globalThis.localStorage } = {}) {
  const state = { ...toggleStateDefaults };
  try {
    const saved = JSON.parse(storage?.getItem(TOGGLE_STATE_STORAGE_KEY) || '{}');
    if (typeof saved.thinkingExpanded === 'boolean') state.thinkingExpanded = saved.thinkingExpanded;
    if (typeof saved.toolsVisible === 'boolean') state.toolsVisible = saved.toolsVisible;
    if (typeof saved.toolOutputsExpanded === 'boolean') state.toolOutputsExpanded = saved.toolOutputsExpanded;
  } catch (_) {}
  return state;
}

export function saveToggleState(state, { storage = globalThis.localStorage } = {}) {
  try {
    storage?.setItem(TOGGLE_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

export function applyToggleStateToNode(node, state) {
  if (!node) return;
  node.querySelectorAll('.thinking-text').forEach(el => {
    el.style.display = state.thinkingExpanded ? '' : 'none';
  });
  node.querySelectorAll('.thinking-collapsed').forEach(el => {
    el.style.display = state.thinkingExpanded ? 'none' : 'block';
  });
  node.querySelectorAll('.tool-execution, .compaction').forEach(el => {
    el.style.display = state.toolsVisible ? '' : 'none';
  });
  node.querySelectorAll('.tool-output.expandable').forEach(el => {
    el.classList.toggle('expanded', state.toolOutputsExpanded);
  });
  node.querySelectorAll('.compaction').forEach(el => {
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
  initialState = loadToggleState({ storage })
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
    get thinkingExpanded() { return state.thinkingExpanded; },
    get toolsVisible() { return state.toolsVisible; },
    get toolOutputsExpanded() { return state.toolOutputsExpanded; },
    applyToNode,
    syncButtons,
    toggleThinking: () => toggle('thinkingExpanded'),
    toggleToolsVisibility: () => toggle('toolsVisible'),
    toggleToolOutputs: () => toggle('toolOutputsExpanded'),
    attachHeaderHandlers() {
      documentImpl.querySelector('[data-action="toggle-thinking"]')?.addEventListener('click', this.toggleThinking);
      documentImpl.querySelector('[data-action="toggle-tools"]')?.addEventListener('click', this.toggleToolsVisibility);
      documentImpl.querySelector('[data-action="toggle-tool-output"]')?.addEventListener('click', this.toggleToolOutputs);
      syncButtons();
    }
  };
}
