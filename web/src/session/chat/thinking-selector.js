import { THINKING_LEVELS, detectCurrentThinkingLevel, supportedThinkingLevels } from './chat-selectors.js';

export function renderThinkingLevelList({ levels = THINKING_LEVELS, selectedLevel = '', currentModel = null } = {}) {
  const supported = supportedThinkingLevels(currentModel, levels);
  let html = '';
  levels.forEach((level) => {
    const active = level === selectedLevel ? ' selected' : '';
    const disabled = supported.indexOf(level) < 0 ? ' disabled title="Not supported by current model"' : '';
    const label = supported.indexOf(level) < 0 ? level + ' (unsupported)' : level;
    html += `<button type="button" class="thinking-level-item thinking-${level}${active}" data-level="${level}"${disabled}>${label}</button>`;
  });
  return html;
}

export function setupThinkingLevelSelector({
  documentImpl = document,
  windowImpl = window,
  sessionId,
  entries = [],
  getCurrentModel = () => null,
  getKnownThinkingLevel = () => '',
  setKnownThinkingLevel = () => {},
  setThinkingLabel = () => {},
  setChatStatus = () => {},
  chatApi
} = {}) {
  const thinkingLabelBtn = documentImpl.getElementById('pi-chat-thinking-label');
  const thinkingPopup = documentImpl.getElementById('pi-chat-thinking-popup');
  const thinkingList = documentImpl.getElementById('pi-chat-thinking-list');
  if (!thinkingLabelBtn || !thinkingPopup || !thinkingList) return false;

  let cycleGeneration = 0;
  let cycleQueue = Promise.resolve();
  let queuedCycles = 0;
  let confirmedThinkingLevel = getKnownThinkingLevel() || '';

  function renderThinkingList(selectedLevel) {
    thinkingList.innerHTML = renderThinkingLevelList({ selectedLevel, currentModel: getCurrentModel() });
  }

  function openThinkingPopup() {
    thinkingPopup.style.display = 'flex';
    renderThinkingList(getKnownThinkingLevel());
    const rect = thinkingLabelBtn.getBoundingClientRect();
    const minW = 120;
    let left = rect.right - minW;
    if (left < 4) left = 4;
    if (left + minW > windowImpl.innerWidth - 4) left = windowImpl.innerWidth - minW - 4;
    thinkingPopup.style.bottom = (windowImpl.innerHeight - rect.top + 4) + 'px';
    thinkingPopup.style.left = left + 'px';
    thinkingPopup.style.right = '';
  }

  function closeThinkingPopup() {
    thinkingPopup.style.display = 'none';
  }

  thinkingLabelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (thinkingPopup.style.display !== 'none') closeThinkingPopup();
    else openThinkingPopup();
  });

  thinkingList.addEventListener('click', async (e) => {
    const item = e.target.closest('.thinking-level-item');
    if (!item) return;
    if (item.disabled) return;
    const level = item.dataset.level;
    if (!level) return;
    closeThinkingPopup();
    const gen = ++cycleGeneration;
    const run = async () => {
      try {
        const res = await chatApi.setThinkingLevel(sessionId, level);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'set thinking level failed');
        const effectiveLevel = data.thinkingLevel || level;
        confirmedThinkingLevel = effectiveLevel;
        if (gen !== cycleGeneration) return;
        setKnownThinkingLevel(effectiveLevel);
        setThinkingLabel(effectiveLevel);
      } catch (err) {
        if (gen !== cycleGeneration) return;
        setKnownThinkingLevel(confirmedThinkingLevel);
        setThinkingLabel(confirmedThinkingLevel);
        setChatStatus(err.message || String(err), 'error');
      }
    };
    cycleQueue = cycleQueue.catch(() => {}).then(run);
    await cycleQueue;
  });

  documentImpl.addEventListener('click', (e) => {
    if (thinkingPopup.style.display !== 'none' && !thinkingPopup.contains(e.target) && e.target !== thinkingLabelBtn) {
      closeThinkingPopup();
    }
  });

  // Cycle to the next supported thinking level without opening the popup.
  async function cycleThinkingLevel() {
    const supported = supportedThinkingLevels(getCurrentModel(), THINKING_LEVELS);
    const current = getKnownThinkingLevel() || '';
    const idx = supported.indexOf(current);
    const nextIdx = (idx + 1) % supported.length;
    const next = supported[nextIdx];
    if (!next || next === current) return;

    if (queuedCycles === 0) confirmedThinkingLevel = current;
    queuedCycles++;
    const gen = ++cycleGeneration;
    // Optimistically update local state so rapid Shift+Tab presses cycle through levels.
    setKnownThinkingLevel(next);
    setThinkingLabel(next);

    const run = async () => {
      try {
        if (gen !== cycleGeneration) return; // stale before reaching backend
        const res = await chatApi.setThinkingLevel(sessionId, next);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'set thinking level failed');
        const effectiveLevel = data.thinkingLevel || next;
        confirmedThinkingLevel = effectiveLevel;
        if (gen !== cycleGeneration) return; // stale — a newer cycle has started
        setKnownThinkingLevel(effectiveLevel);
        setThinkingLabel(effectiveLevel);
      } catch (err) {
        if (gen !== cycleGeneration) return; // stale — a newer cycle has started
        // Revert to the last level confirmed by the backend, not an optimistic value.
        setKnownThinkingLevel(confirmedThinkingLevel);
        setThinkingLabel(confirmedThinkingLevel);
        setChatStatus(err.message || String(err), 'error');
      } finally {
        queuedCycles = Math.max(0, queuedCycles - 1);
      }
    };

    // Queue requests so the backend observes the same order as the UI.
    cycleQueue = cycleQueue.catch(() => {}).then(run);
    return cycleQueue;
  }

  const detectedThinkingLevel = detectCurrentThinkingLevel(entries);
  if (detectedThinkingLevel) {
    confirmedThinkingLevel = detectedThinkingLevel;
    setKnownThinkingLevel(detectedThinkingLevel);
    setThinkingLabel(detectedThinkingLevel);
  }

  return {
    open: openThinkingPopup,
    close: closeThinkingPopup,
    cycle: cycleThinkingLevel,
  };
}
