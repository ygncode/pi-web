export function runChatComposer({
  documentImpl = document,
  windowImpl = window,
  locationImpl = windowImpl.location,
  localEntries = [],
  leafId = '',
  urlTargetId = '',
  byId = new Map(),
  navigateTo = () => {},
  escapeHtml = (text) => String(text),
  chatApi,
  chatSelectors,
  modelSelector,
  thinkingSelector,
  FormDataImpl = FormData,
  URLSearchParamsImpl = URLSearchParams,
  CustomEventImpl = CustomEvent,
  setIntervalImpl = setInterval
} = {}) {
  const document = documentImpl;
  const window = windowImpl;
  const location = locationImpl;
  const entries = localEntries;
  const __piChatApi = chatApi;
  const __piChatSelectors = chatSelectors;
  const __piModelSelector = modelSelector;
  const __piThinkingSelector = thinkingSelector;
  const FormData = FormDataImpl;
  const URLSearchParams = URLSearchParamsImpl;
  const CustomEvent = CustomEventImpl;
  const setInterval = setIntervalImpl;
  let onWorkerModelUpdate = null;
  let knownModelLabel = '';
  let knownThinkingLevel = '';
  let currentModelForThinking = null;

  function setChatStatus(text, cls) {
    const status = document.getElementById('pi-chat-status');
    const cancelButton = document.getElementById('pi-chat-cancel');
    const isRunning = cls === 'running' || text === 'running' || text === 'sending' || text === 'accepted' || text === 'cancelling';
    if (status) {
      status.textContent = text;
      status.className = 'pi-chat-status' + (cls ? ' ' + cls : '');
    }
    if (cancelButton) {
      cancelButton.style.display = isRunning ? '' : 'none';
      cancelButton.disabled = text === 'cancelling';
    }
  }

  function setModelLabel(label) {
    const btn = document.getElementById('pi-chat-model-label');
    if (!btn) return;
    if (label) {
      btn.textContent = label;
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  }

  const THINKING_LEVELS = __piChatSelectors.THINKING_LEVELS;
  const THINKING_COLORS = {
    off: 'var(--thinkingOff)',
    minimal: 'var(--thinkingMinimal)',
    low: 'var(--thinkingLow)',
    medium: 'var(--thinkingMedium)',
    high: 'var(--thinkingHigh)',
    xhigh: 'var(--thinkingXhigh)'
  };

  function setThinkingLabel(level) {
    const btn = document.getElementById('pi-chat-thinking-label');
    if (!btn) return;
    if (level) {
      btn.textContent = level;
      btn.style.display = '';
      btn.className = 'pi-chat-thinking-label thinking-' + level;
    } else {
      btn.style.display = 'none';
    }
  }

  function setupPiChatComposer() {
    const form = document.getElementById('pi-chat-composer');
    if (!form) return false;
    const sessionId = form.dataset.sessionId;
    const chatAvailable = form.dataset.chatAvailable !== 'false';
    if (!chatAvailable) {
      const reason = form.dataset.chatDisabledReason || 'chat unavailable';
      setChatStatus('unavailable', 'error');
      form.title = reason;
      return false;
    }
    const textarea = document.getElementById('pi-chat-message');
    const fileInput = document.getElementById('pi-chat-images');
    const attachButton = document.getElementById('pi-chat-attach');
    const attachmentList = document.getElementById('pi-chat-attachments');
    const status = document.getElementById('pi-chat-status');
    const sendButton = document.getElementById('pi-chat-send');
    const cancelButton = document.getElementById('pi-chat-cancel');
    let selectedChatFiles = [];

    function setStatus(text, cls) {
      setChatStatus(text, cls);
    }

    function fileKey(file) {
      return [file.name, file.size, file.lastModified].join(':');
    }

    function isMobileTextInputMode() {
      return !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    }

    function renderAttachments() {
      attachmentList.innerHTML = '';
      selectedChatFiles.forEach((file, index) => {
        const item = document.createElement('span');
        item.className = 'pi-chat-attachment';
        const name = document.createElement('span');
        name.className = 'pi-chat-attachment-name';
        name.textContent = '▧ ' + file.name;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'pi-chat-remove';
        remove.setAttribute('aria-label', 'Remove ' + file.name);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          selectedChatFiles.splice(index, 1);
          renderAttachments();
        });
        item.append(name, remove);
        attachmentList.appendChild(item);
      });
    }

    attachButton.addEventListener('click', () => fileInput.click());
    if (cancelButton) {
      cancelButton.addEventListener('click', async () => {
        cancelButton.disabled = true;
        setStatus('cancelling', 'running');
        try {
          const response = await __piChatApi.cancelChat(sessionId);
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'cancel failed');
          setStatus('idle', '');
          refreshWorkerStatus();
        } catch (error) {
          setStatus(error.message || String(error), 'error');
        } finally {
          cancelButton.disabled = false;
        }
      });
    }
    fileInput.addEventListener('change', () => {
      const seen = new Set(selectedChatFiles.map(fileKey));
      for (const file of fileInput.files) {
        if (!seen.has(fileKey(file))) {
          selectedChatFiles.push(file);
          seen.add(fileKey(file));
        }
      }
      fileInput.value = '';
      renderAttachments();
    });
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        if (isMobileTextInputMode()) return;
        event.preventDefault();
        form.requestSubmit();
      }
    });

    async function sendChatMessage(message, files = selectedChatFiles) {
      if (!message && files.length === 0) {
        setStatus('message or image required', 'error');
        return false;
      }
      const body = new FormData();
      body.set('message', message);
      for (const file of files) body.append('images', file);
      sendButton.disabled = true;
      setStatus('sending', 'running');
      window.dispatchEvent(new CustomEvent('pi-chat-message-sent'));
      try {
        const response = await __piChatApi.sendChat(sessionId, body);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'chat request failed');
        setStatus('accepted', 'running');
        return true;
      } catch (error) {
        setStatus(error.message || String(error), 'error');
        return false;
      } finally {
        sendButton.disabled = false;
      }
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = textarea.value.trim();
      const sent = await sendChatMessage(message);
      if (sent) {
        textarea.value = '';
        selectedChatFiles = [];
        fileInput.value = '';
        renderAttachments();
      }
    });

    document.addEventListener('click', async (event) => {
      // Submit button: send all collected answers
      const submitBtn = event.target.closest?.('.ask-question-submit-btn');
      if (submitBtn) {
        event.preventDefault();
        const card = submitBtn.closest('.ask-question-card');
        if (!card) return;
        const parts = [];
        card.querySelectorAll('.ask-question-block').forEach(block => {
          const questionText = block.dataset.questionText || '';
          const sel = block.querySelector('.ask-question-option-action.selected');
          if (sel && questionText) parts.push(`"${questionText}" = "${sel.dataset.answer || ''}"`);
        });
        if (parts.length === 0) return;
        card.querySelectorAll('.ask-question-option-action').forEach(b => { b.disabled = true; });
        submitBtn.disabled = true;
        const sent = await sendChatMessage(parts.join('\n'), []);
        if (!sent) {
          card.querySelectorAll('.ask-question-option-action').forEach(b => { b.disabled = false; });
          submitBtn.disabled = false;
        }
        return;
      }

      // Option click
      const option = event.target.closest?.('.ask-question-option-action');
      if (!option) return;
      event.preventDefault();

      const card = option.closest('.ask-question-card');
      const block = option.closest('.ask-question-block');
      const questionCount = parseInt(card?.dataset.questionCount || '1', 10);

      if (questionCount === 1) {
        // Single question: send immediately
        const question = option.dataset.question || 'Question';
        const answer = option.dataset.answer || option.textContent.trim();
        option.disabled = true;
        const sent = await sendChatMessage(`"${question}" = "${answer}"`, []);
        if (!sent) option.disabled = false;
        return;
      }

      // Multi-question: mark selection, show submit button
      if (block) {
        block.querySelectorAll('.ask-question-option-action').forEach(b => b.classList.remove('selected'));
        option.classList.add('selected');
      }
      const actions = card?.querySelector('.ask-question-actions');
      if (actions) actions.style.display = '';
    });

    let workerStatusInflight = false;
    async function refreshWorkerStatus() {
      if (workerStatusInflight) return;
      workerStatusInflight = true;
      try {
        const response = await __piChatApi.getWorkerStatus(sessionId);
        if (!response.ok) return;
        const data = await response.json();
        const apiModelLabel = data.model ? data.model + (data.modelProvider ? ' @ ' + data.modelProvider : '') : '';
        if (apiModelLabel) knownModelLabel = apiModelLabel;
        if (data.thinkingLevel) knownThinkingLevel = data.thinkingLevel;
        if (data.state === 'running') setStatus('running', 'running');
        if (data.state === 'idle') setStatus('idle', '');
        if (data.state === 'error') setStatus(data.error || 'worker error', 'error');
        setModelLabel(knownModelLabel);
        setThinkingLabel(knownThinkingLevel);
        if (data.modelProvider && data.model && onWorkerModelUpdate) {
          onWorkerModelUpdate(data.modelProvider, data.model);
        }
      } catch {
        setStatus('status unavailable', 'error');
      } finally {
        workerStatusInflight = false;
      }
    }

    setInterval(refreshWorkerStatus, 3000);
    refreshWorkerStatus();
    return true;
  }

  function initPiChatControls() {
    if (!setupPiChatComposer()) return;
    loadModelSelector();
    setupThinkingLevelSelector();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPiChatControls);
  } else {
    initPiChatControls();
  }

  // Model selector
  async function loadModelSelector() {
    const sessionId = new URLSearchParams(window.location.search).get('id') || (document.getElementById('pi-chat-composer') || {}).dataset?.sessionId || '';
    return __piModelSelector.setupModelSelector({
      documentImpl: document,
      sessionId,
      entries,
      chatApi: __piChatApi,
      escapeHtml,
      setModelLabel,
      setChatStatus,
      setKnownModelLabel: (label) => { knownModelLabel = label; },
      getKnownModelLabel: () => knownModelLabel,
      setCurrentModelForThinking: (model) => { currentModelForThinking = model; },
      setWorkerModelUpdate: (handler) => { onWorkerModelUpdate = handler; }
    });
  }

  // ── Thinking level selector ──────────────────────────────────────────
  function setupThinkingLevelSelector() {
    const sessionId = new URLSearchParams(window.location.search).get('id') || (document.getElementById('pi-chat-composer') || {}).dataset?.sessionId || '';
    return __piThinkingSelector.setupThinkingLevelSelector({
      documentImpl: document,
      windowImpl: window,
      sessionId,
      entries,
      getCurrentModel: () => currentModelForThinking,
      getKnownThinkingLevel: () => knownThinkingLevel,
      setKnownThinkingLevel: (level) => { knownThinkingLevel = level; },
      setThinkingLabel,
      setChatStatus,
      chatApi: __piChatApi
    });
  }

  // Initial render
  // If URL has targetId, scroll to that specific message; otherwise stay at top
  if (leafId) {
    if (urlTargetId && byId.has(urlTargetId)) {
      // Deep link: navigate to leaf and scroll to target message
      navigateTo(leafId, 'target', urlTargetId);
    } else {
      navigateTo(leafId, 'none');
    }
  } else if (entries.length > 0) {
    // Fallback: use last entry if no leafId
    navigateTo(entries[entries.length - 1].id, 'none');
  }
}
