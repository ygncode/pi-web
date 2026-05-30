import { detectCurrentModel, findModel, groupModelsByProvider, isScopedModel, modelDisplayLabel } from './chat-selectors.js';

export function renderModelList(models, { filter = '', selectedModel = null, escapeHtml = String } = {}) {
  const byProvider = groupModelsByProvider(models, filter);
  const providers = Object.keys(byProvider).sort();
  if (providers.length === 0) return '<div class="model-empty">No models match</div>';

  let html = '';
  providers.forEach((provider) => {
    html += `<div class="model-provider">${escapeHtml(provider)}</div>`;
    byProvider[provider].forEach((model) => {
      const id = model.id || model.modelId || '';
      const name = model.name || id;
      const scoped = isScopedModel(model) ? '<span class="model-scope-badge">scoped</span>' : '';
      const active = selectedModel && selectedModel.provider === provider && (selectedModel.id === id || selectedModel.modelId === id) ? ' selected' : '';
      html += `<button type="button" class="model-item${active}" data-provider="${escapeHtml(provider)}" data-model-id="${escapeHtml(id)}">${escapeHtml(name)}${scoped}</button>`;
    });
  });
  return html;
}

export function setupModelSelector({
  documentImpl = document,
  sessionId,
  entries = [],
  chatApi,
  escapeHtml = String,
  setModelLabel = () => {},
  setChatStatus = () => {},
  setKnownModelLabel = () => {},
  getKnownModelLabel = () => '',
  setCurrentModelForThinking = () => {},
  setWorkerModelUpdate = () => {}
} = {}) {
  let allModels = [];
  let selectedModel = null;

  function setSelected(model) {
    selectedModel = model;
    setCurrentModelForThinking(model || null);
  }

  const popup = documentImpl.getElementById('pi-chat-model-popup');
  const popupSearch = documentImpl.getElementById('pi-chat-model-search');
  const popupList = documentImpl.getElementById('pi-chat-model-list');
  const modelLabelBtn = documentImpl.getElementById('pi-chat-model-label');

  // Always show the label button so the user can open the model picker.
  // Server may have hidden it when no model was detected at page load.
  if (modelLabelBtn) modelLabelBtn.style.display = '';

  function renderPopupList(filter) {
    if (!popupList) return;
    popupList.innerHTML = renderModelList(allModels, { filter, selectedModel, escapeHtml });
    popupList.dataset.activeIndex = '-1';
  }

  function openPopup() {
    if (!popup) return;
    popup.style.display = 'flex';
    if (popupSearch) {
      popupSearch.value = '';
      popupSearch.focus();
    }
    renderPopupList('');
  }

  function closePopup(focusTextarea = false) {
    if (popup) popup.style.display = 'none';
    if (focusTextarea) {
      const textarea = documentImpl.getElementById('pi-chat-message');
      if (textarea) textarea.focus();
    }
  }

  const api = {
    open: openPopup,
    close: closePopup,
  };

  // Attach click handlers immediately so the button is responsive
  // even before the model list finishes loading.
  modelLabelBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popup && popup.style.display !== 'none') closePopup();
    else openPopup();
  });

  popupSearch?.addEventListener('input', () => renderPopupList(popupSearch.value));
  popupSearch?.addEventListener('keydown', (e) => {
    const items = popupList ? popupList.querySelectorAll('.model-item') : [];
    let popupActive = parseInt((popupList && popupList.dataset.activeIndex) || '-1', 10);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      popupActive = Math.min(popupActive + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      popupActive = Math.max(popupActive - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (popupActive >= 0 && items[popupActive]) items[popupActive].click();
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
      modelLabelBtn?.focus();
      return;
    }
    if (popupList) popupList.dataset.activeIndex = popupActive;
    items.forEach((item, i) => item.classList.toggle('active', i === popupActive));
    items[popupActive]?.scrollIntoView?.({ block: 'nearest' });
  });

  popupList?.addEventListener('click', async (e) => {
    const item = e.target.closest('.model-item');
    if (!item) return;
    const provider = item.dataset.provider;
    const modelId = item.dataset.modelId;
    if (!provider || !modelId) return;
    closePopup(true);
    try {
      const setRes = await chatApi.setModel(sessionId, { provider, modelId });
      const setData = await setRes.json();
      if (!setRes.ok) throw new Error(setData.error || 'set model failed');
      const model = findModel(allModels, provider, modelId);
      setSelected(model || { provider, id: modelId, name: modelId });
      const newLabel = modelDisplayLabel(model || { provider, id: modelId, name: modelId });
      setKnownModelLabel(newLabel);
      setModelLabel(newLabel);
    } catch (err) {
      setChatStatus(err.message || String(err), 'error');
    }
  });

  documentImpl.addEventListener('click', (e) => {
    if (popup && popup.style.display !== 'none') {
      const modelLabelBtnEl = documentImpl.getElementById('pi-chat-model-label');
      if (!popup.contains(e.target) && e.target !== modelLabelBtnEl) closePopup();
    }
  });

  // Load the model list asynchronously; the button is already wired.
  // Fire-and-forget: the popup opens immediately (Ctrl+L) and renders
  // available models as they load.
  chatApi.listModels()
    .then((res) => {
      if (!res.ok) throw new Error('api error');
      return res.json();
    })
    .then((data) => {
      if (!data.models || data.models.length === 0) {
        allModels = [];
        if (popupList) {
          popupList.innerHTML = '<div class="model-empty">No models configured<br><small>Run <code>pi setup</code> to configure</small></div>';
        }
        return;
      }
      allModels = data.models;
      if (popup && popup.style.display !== 'none') {
        renderPopupList(popupSearch ? popupSearch.value : '');
      }
      function updateToggleFromStatus(provider, modelId) {
        if (!provider || !modelId) return;
        const model = findModel(allModels, provider, modelId);
        if (model) setSelected(model);
      }
      setWorkerModelUpdate(updateToggleFromStatus);
      const detected = detectCurrentModel(entries);
      if (detected.modelId) {
        const model = findModel(allModels, detected.provider, detected.modelId);
        if (model) {
          setSelected(model);
          const detectedLabel = modelDisplayLabel(model);
          if (detectedLabel && !getKnownModelLabel()) {
            setKnownModelLabel(detectedLabel);
            setModelLabel(detectedLabel);
          }
        }
      }
    })
    .catch(() => {
      // Model list fetch failed; button still works (shows empty list).
      if (popupList) {
        popupList.innerHTML = '<div class="model-empty">Failed to load models<br><small>Check that <code>pi</code> is on PATH</small></div>';
      }
    });

  return api;
}
