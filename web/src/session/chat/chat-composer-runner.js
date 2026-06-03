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
  slashSelector,
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
  const __piSlashSelector = slashSelector;
  const FormData = FormDataImpl;
  const URLSearchParams = URLSearchParamsImpl;
  const CustomEvent = CustomEventImpl;
  const setInterval = setIntervalImpl;
  let onWorkerModelUpdate = null;
  let knownModelLabel = '';
  let knownThinkingLevel = '';
  let currentModelForThinking = null;
  let positionPopover = () => {};
  let modelContextWindows = {};

  // Load available models and their exact context windows from pi!
  if (chatApi && typeof chatApi.listModels === 'function') {
    chatApi.listModels()
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        (data.models || []).forEach((m) => {
          const provider = m.provider || '';
          const id = m.id || m.modelId || '';
          if (id) {
            modelContextWindows[id.toLowerCase()] = m.contextWindow || 0;
            if (provider) {
              modelContextWindows[`${provider}/${id}`.toLowerCase()] = m.contextWindow || 0;
            }
          }
        });
        updateContextUsage();
      })
      .catch(() => {});
  }

  function getModelContextLimit(modelId, provider = '') {
    if (!modelId) return 128000;
    const id = modelId.toLowerCase();
    const prov = provider.toLowerCase();

    // Check custom dynamic windows list
    if (prov && modelContextWindows[`${prov}/${id}`]) {
      return modelContextWindows[`${prov}/${id}`];
    }
    if (modelContextWindows[id]) {
      return modelContextWindows[id];
    }

    // Static fallback matching pi model configurations
    if (id.includes('deepseek')) {
      return 1000000; // DeepSeek has 1M context in pi configs
    }
    if (id.includes('gemini-1.5-pro') || id.includes('gemini-2.0-pro') || id.includes('gemini-2.5-pro') || id.includes('gemini-3.1-pro') || id.includes('agy-gemini-pro')) {
      return 1000000; // Gemini Pro is 1M in pi
    }
    if (id.includes('gemini-')) {
      return 1000000;
    }
    if (id.includes('claude-') || id.includes('sonnet') || id.includes('opus')) {
      return 200000;
    }
    if (id.includes('gpt-5')) {
      return 272000;
    }
    if (id.includes('gpt-4') || id.includes('gpt4') || id.includes('gpt-3.5') || id.includes('o1') || id.includes('o3')) {
      return 128000;
    }
    if (id.includes('llama-3') || id.includes('llama3') || id.includes('qwen') || id.includes('glm') || id.includes('mimo')) {
      return 128000;
    }
    if (id.includes('llama-2') || id.includes('llama2')) {
      return 4096;
    }
    return 128000;
  }

  function updateContextUsage() {
    const el = document.getElementById('pi-chat-context-usage');
    if (!el) return;

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;

    entries.forEach((entry) => {
      if (entry?.type !== 'message' || !entry.message) return;
      const message = entry.message;
      if (message.role === 'assistant' && message.usage) {
        inputTokens += message.usage.input || 0;
        outputTokens += message.usage.output || 0;
        cacheReadTokens += message.usage.cacheRead || 0;
        cacheWriteTokens += message.usage.cacheWrite || 0;
      }
    });

    const totalIOTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;

    // Find the last assistant message with valid usage to compute context window
    // pressure. Cumulative I/O across all turns double-counts cache reads (each
    // turn's cacheRead overlaps with prior turns) and inflates the percentage.
    // pi TUI uses the last assistant's totalTokens to estimate current context
    // size (see getContextUsage -> estimateContextTokens in pi's compaction code).
    let contextTokens = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry?.type !== 'message' || !entry.message) continue;
      const msg = entry.message;
      if (msg.role === 'assistant' && msg.usage) {
        contextTokens = msg.usage.totalTokens || (msg.usage.input || 0) + (msg.usage.output || 0) + (msg.usage.cacheRead || 0) + (msg.usage.cacheWrite || 0);
        break;
      }
    }

    if (contextTokens <= 0 && totalIOTokens <= 0) {
      el.style.display = 'none';
      return;
    }

    const modelName = knownModelLabel ? knownModelLabel.split(' @ ')[0].trim() : '';
    const providerName = knownModelLabel && knownModelLabel.includes(' @ ') ? knownModelLabel.split(' @ ')[1].trim() : '';
    const limit = getModelContextLimit(modelName, providerName);
    const percent = Math.min(100, Math.max(0, Math.round((contextTokens / limit) * 100)));

    const fillPath = el.querySelector('.pi-context-fill');
    const textSpan = el.querySelector('.pi-context-text');

    if (fillPath) {
      fillPath.setAttribute('stroke-dasharray', `${percent}, 100`);
    }
    if (textSpan) {
      textSpan.textContent = `${percent}%`;
    }

    const formatNumber = (num) => num.toLocaleString();
    el.setAttribute('title', `Click for details (${formatNumber(contextTokens)} / ${formatNumber(limit)} tokens used in context)`);

    el.classList.remove('warning', 'danger');
    if (percent >= 90) {
      el.classList.add('danger');
    } else if (percent >= 70) {
      el.classList.add('warning');
    }

    // Set popover breakdowns
    const popoverBox = document.getElementById('pi-chat-context-popover');
    const valInput = popoverBox ? popoverBox.querySelector('#pi-popover-val-input') : null;
    const valCacheRead = popoverBox ? popoverBox.querySelector('#pi-popover-val-cache-read') : null;
    const valCacheWrite = popoverBox ? popoverBox.querySelector('#pi-popover-val-cache-write') : null;
    const valOutput = popoverBox ? popoverBox.querySelector('#pi-popover-val-output') : null;
    const valTotal = popoverBox ? popoverBox.querySelector('#pi-popover-val-total') : null;
    
    const usedSpan = popoverBox ? popoverBox.querySelector('.pi-popover-used') : null;
    const limitSpan = popoverBox ? popoverBox.querySelector('.pi-popover-limit') : null;
    const popoverBar = popoverBox ? popoverBox.querySelector('.pi-popover-progress-bar') : null;

    const formatTokensDetail = (n) => {
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
      return n.toLocaleString();
    };
    
    const formatLimit = (n) => {
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
      return n.toLocaleString();
    };

    if (valInput) valInput.textContent = formatTokensDetail(inputTokens);
    if (valCacheRead) valCacheRead.textContent = formatTokensDetail(cacheReadTokens);
    if (valCacheWrite) valCacheWrite.textContent = formatTokensDetail(cacheWriteTokens);
    if (valOutput) valOutput.textContent = formatTokensDetail(outputTokens);
    if (valTotal) valTotal.textContent = formatTokensDetail(totalIOTokens);

    if (usedSpan) usedSpan.textContent = formatTokensDetail(contextTokens);
    if (limitSpan) limitSpan.textContent = formatLimit(limit);
    if (popoverBar) popoverBar.style.width = `${percent}%`;

    if (popoverBox) {
      popoverBox.classList.remove('warning', 'danger');
      if (percent >= 90) {
        popoverBox.classList.add('danger');
      } else if (percent >= 70) {
        popoverBox.classList.add('warning');
      }
    }

    if (popoverBox && popoverBox.style.display !== 'none') {
      positionPopover();
    }

    el.style.display = 'inline-flex';
  }

  function isMobileTextInputMode() {
    return !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }

  function setChatStatus(text, cls) {
    const status = document.getElementById('pi-chat-status');
    const cancelButton = document.getElementById('pi-chat-cancel');
    const isRunning = cls === 'running' || text === 'running' || text === 'sending' || text === 'queued' || text === 'accepted' || text === 'cancelling';
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
    } else if (!btn.textContent || btn.textContent.trim() === '') {
      // Show a placeholder so the button is always visible and clickable.
      btn.textContent = 'Model';
      btn.style.display = '';
    }
    if (isMobileTextInputMode()) {
      btn.setAttribute('title', 'Switch model');
    } else {
      btn.setAttribute('title', 'Switch model (Ctrl+I)');
    }
    updateContextUsage();
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
    if (isMobileTextInputMode()) {
      btn.setAttribute('title', 'Switch effort');
    } else {
      btn.setAttribute('title', 'Switch effort (Shift+Tab)');
    }
  }

  function showCwdToast(message, isError = false) {
    const composer = document.getElementById('pi-chat-composer');
    if (!composer) return;
    let notice = document.getElementById('pi-chat-cwd-toast');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'pi-chat-cwd-toast';
      notice.style.cssText = 'position:fixed;top:60px;right:8px;z-index:200;padding:2px 8px;font-size:10px;font-family:inherit;background:var(--accent);color:var(--body-bg);border-radius:3px;opacity:0;transition:opacity 0.3s;pointer-events:none;';
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.style.background = isError ? 'var(--error)' : 'var(--accent)';
    notice.style.opacity = '1';
    clearTimeout(notice._hideTimer);
    notice._hideTimer = setTimeout(() => {
      notice.style.opacity = '0';
      setTimeout(() => {
        if (notice.parentNode) notice.parentNode.removeChild(notice);
      }, 300);
    }, 1200);
  }

  function setupCwdCopy() {
    const cwdEl = document.querySelector('.pi-chat-cwd');
    if (!cwdEl) return;
    cwdEl.addEventListener('click', async () => {
      const path = cwdEl.dataset.cwd || cwdEl.textContent.replace(/^cwd:\s*/, '');
      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(path);
          ok = true;
        }
      } catch {
        /* ignore clipboard API failure, try fallback */
      }
      if (!ok) {
        try {
          const ta = document.createElement('textarea');
          ta.value = path;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch {
          /* ignore fallback copy failure */
        }
      }
      if (ok) {
        showCwdToast('Path copied');
      } else {
        showCwdToast('Copy failed', true);
      }
    });
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
    const attachmentObjectUrls = new WeakMap();

    function updateComposerHeightVar() {
      const height = Math.ceil(form.getBoundingClientRect().height || 0);
      document.documentElement.style.setProperty('--pi-chat-composer-height', height + 'px');
    }

    updateComposerHeightVar();
    window.addEventListener('resize', updateComposerHeightVar, { passive: true });
    if (window.ResizeObserver) {
      new ResizeObserver(updateComposerHeightVar).observe(form);
    }

    // Expand/collapse the composer for larger typing area. State persists
    // per-session in localStorage.
    const shell = form.querySelector('.pi-chat-shell');

    // Auto-grow textarea: track scrollHeight up to the CSS max-height so the
    // composer expands as the user types and shrinks when they delete content.
    function autoResizeTextarea() {
      if (!textarea || (shell && shell.classList.contains('expanded'))) return;
      textarea.style.height = 'auto';
      const cs = window.getComputedStyle(textarea);
      const max = parseFloat(cs.maxHeight) || 200;
      const min = parseFloat(cs.minHeight) || 48;
      const next = Math.max(min, Math.min(textarea.scrollHeight, max));
      textarea.style.height = next + 'px';
      updateComposerHeightVar();
    }

    // Enable Send only when there is text or an attachment.
    function hasComposerContent() {
      const v = textarea ? textarea.value : '';
      return (v && v.trim().length > 0) || (typeof selectedChatFiles !== 'undefined' && selectedChatFiles.length > 0);
    }
    function updateSendEnabled() {
      if (!sendButton) return;
      // Don't fight transient sending/disabled state set by sendChatMessage.
      if (sendButton.dataset.sending === '1') return;
      sendButton.disabled = !hasComposerContent();
    }

    if (textarea) {
      textarea.addEventListener('input', () => {
        autoResizeTextarea();
        updateSendEnabled();
      });
      // Initial sizing in case the textarea was pre-filled (e.g. browser autofill).
      autoResizeTextarea();
    }
    updateSendEnabled();


    const expandButton = document.getElementById('pi-chat-expand');
    const EXPAND_STORAGE_KEY = 'pi-chat:composer-expanded:' + (sessionId || 'default');
    function applyComposerExpanded(expanded) {
      if (!shell) return;
      shell.classList.toggle('expanded', !!expanded);
      if (expandButton) {
        const label = expanded ? 'Collapse composer' : 'Expand composer';
        expandButton.setAttribute('aria-pressed', expanded ? 'true' : 'false');
        expandButton.setAttribute('aria-label', label);
        expandButton.title = label;
      }
      updateComposerHeightVar();
    }
    let initialExpanded = false;
    try {
      initialExpanded = window.localStorage && window.localStorage.getItem(EXPAND_STORAGE_KEY) === '1';
    } catch (_) { /* localStorage unavailable */ }
    applyComposerExpanded(initialExpanded);
    if (expandButton) {
      expandButton.addEventListener('click', () => {
        const willExpand = !shell.classList.contains('expanded');
        applyComposerExpanded(willExpand);
        try {
          if (window.localStorage) window.localStorage.setItem(EXPAND_STORAGE_KEY, willExpand ? '1' : '0');
        } catch (_) { /* localStorage unavailable */ }
        if (willExpand && textarea && typeof textarea.focus === 'function') textarea.focus();
      });
    }

    function setStatus(text, cls) {
      setChatStatus(text, cls);
    }

    function fileKey(file) {
      return [file.name, file.size, file.lastModified].join(':');
    }

    function getAttachmentObjectUrl(file) {
      if (!file.type || !file.type.startsWith('image/')) return '';
      const urlApi = window.URL || window.webkitURL;
      if (!urlApi || typeof urlApi.createObjectURL !== 'function') return '';
      let url = attachmentObjectUrls.get(file);
      if (!url) {
        url = urlApi.createObjectURL(file);
        attachmentObjectUrls.set(file, url);
      }
      return url;
    }

    function revokeAttachmentObjectUrl(file) {
      const url = attachmentObjectUrls.get(file);
      const urlApi = window.URL || window.webkitURL;
      if (url && urlApi && typeof urlApi.revokeObjectURL === 'function') {
        urlApi.revokeObjectURL(url);
      }
      attachmentObjectUrls.delete(file);
    }

    function clearSelectedChatFiles() {
      selectedChatFiles.forEach(revokeAttachmentObjectUrl);
      selectedChatFiles = [];
    }

    function renderAttachments() {
      const fragment = document.createDocumentFragment();
      selectedChatFiles.forEach((file, index) => {
        const item = document.createElement('span');
        const previewUrl = getAttachmentObjectUrl(file);
        item.className = 'pi-chat-attachment' + (previewUrl ? ' image-only' : '');

        if (previewUrl) {
          const preview = document.createElement('img');
          preview.className = 'pi-chat-attachment-preview';
          preview.src = previewUrl;
          preview.alt = '';
          preview.loading = 'lazy';
          preview.decoding = 'async';
          item.appendChild(preview);
        } else {
          const name = document.createElement('span');
          name.className = 'pi-chat-attachment-name';
          name.textContent = file.name;
          item.appendChild(name);
        }

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'pi-chat-remove';
        remove.setAttribute('aria-label', 'Remove ' + file.name);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          const [removed] = selectedChatFiles.splice(index, 1);
          if (removed) revokeAttachmentObjectUrl(removed);
          renderAttachments();
        });
        item.appendChild(remove);
        fragment.appendChild(item);
      });
      attachmentList.replaceChildren(fragment);
      updateSendEnabled();
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
      // Slash-command palette gets first dibs on navigation keys while open so
      // Enter selects a command instead of submitting the message.
      if (_slashSelectorApi && _slashSelectorApi.handleKeydown(event)) return;
      if (event.key === 'Enter' && !event.shiftKey) {
        if (isMobileTextInputMode()) return;
        event.preventDefault();
        form.requestSubmit();
      }
      // Shift+Tab: cycle thinking level (matching pi CLI behavior)
      if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        if (_thinkingSelectorApi && _thinkingSelectorApi.cycle) {
          _thinkingSelectorApi.cycle();
        }
      }
      // Ctrl+I or Ctrl+L: open model selector, focus returns to textarea after selection
      if (event.ctrlKey && (event.key.toLowerCase() === 'i' || event.key.toLowerCase() === 'l')) {
        event.preventDefault();
        if (_modelSelectorApi && _modelSelectorApi.open) {
          _modelSelectorApi.open();
        }
      }
    });

    textarea.addEventListener('paste', (event) => {
      const data = event.clipboardData;
      if (!data) return;
      const seen = new Set(selectedChatFiles.map(fileKey));
      let added = false;

      if (data.items) {
        for (const item of data.items) {
          if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file && !seen.has(fileKey(file))) {
              selectedChatFiles.push(file);
              seen.add(fileKey(file));
              added = true;
            }
          }
        }
      }

      if (!added && data.files) {
        for (const file of data.files) {
          if (file.type && file.type.startsWith('image/') && !seen.has(fileKey(file))) {
            selectedChatFiles.push(file);
            seen.add(fileKey(file));
            added = true;
          }
        }
      }

      if (added) {
        const pastedText = data.getData?.('text/plain') || '';
        if (!pastedText) {
          event.preventDefault();
        }
        renderAttachments();
        textarea.focus();
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
      sendButton.dataset.sending = '1';
      sendButton.disabled = true;
      setStatus('sending', 'running');
      window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message } }));
      try {
        const response = await __piChatApi.sendChat(sessionId, body);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'chat request failed');
        setStatus(data.status || 'queued', 'running');
        return true;
      } catch (error) {
        setStatus(error.message || String(error), 'error');
        return false;
      } finally {
        delete sendButton.dataset.sending;
        sendButton.disabled = false;
        updateSendEnabled();
      }
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = textarea.value.trim();
      const filesToSend = selectedChatFiles.slice();
      if (!message && filesToSend.length === 0) {
        setStatus('message or image required', 'error');
        return;
      }

      // Optimistically move the draft out of the composer immediately. The
      // live preview area shows the pending user message + "working…" while
      // the backend starts/reuses the RPC worker. If the request fails before
      // pi accepts it, restore the draft so the user can retry.
      textarea.value = '';
      clearSelectedChatFiles();
      fileInput.value = '';
      renderAttachments();
      autoResizeTextarea();
      updateSendEnabled();

      const sent = await sendChatMessage(message, filesToSend);
      if (!sent) {
        textarea.value = message;
        selectedChatFiles = filesToSend;
        renderAttachments();
        autoResizeTextarea();
        updateSendEnabled();
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
          const answers = Array.from(block.querySelectorAll('.ask-question-option-action.selected'))
            .map(el => el.dataset.answer || '')
            .filter(Boolean);
          if (answers.length && questionText) parts.push(`"${questionText}" = "${answers.join(', ')}"`);
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
      const needsSubmit = card?.dataset.needsSubmit === 'true';

      if (!needsSubmit) {
        // Single, single-select question: send immediately
        const question = option.dataset.question || 'Question';
        const answer = option.dataset.answer || option.textContent.trim();
        option.disabled = true;
        const sent = await sendChatMessage(`"${question}" = "${answer}"`, []);
        if (!sent) option.disabled = false;
        return;
      }

      // Collect-then-submit: toggle selection, then reveal the submit button
      if (block) {
        if (block.dataset.multiSelect === 'true') {
          option.classList.toggle('selected');
        } else {
          block.querySelectorAll('.ask-question-option-action').forEach(b => b.classList.remove('selected'));
          option.classList.add('selected');
        }
      }
      const actions = card?.querySelector('.ask-question-actions');
      if (actions) actions.style.display = '';
    });

    let workerStatusInflight = false;
    let workerStatusPending = false;
    let lastWorkerState = null;
    async function refreshWorkerStatus() {
      if (workerStatusInflight) {
        // Mark a follow-up so the in-flight response doesn't swallow a
        // newer state change (e.g. assistant just finished while we were
        // polling stale "running" state).
        workerStatusPending = true;
        return;
      }
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
        if (lastWorkerState === 'running' && data.state === 'idle') {
          try {
            window.dispatchEvent(new CustomEvent('pi-worker-done'));
          } catch (_) {}
        }
        if (data.state) lastWorkerState = data.state;
        setModelLabel(knownModelLabel);
        setThinkingLabel(knownThinkingLevel);
        updateContextUsage();
        if (data.modelProvider && data.model && onWorkerModelUpdate) {
          onWorkerModelUpdate(data.modelProvider, data.model);
        }
      } catch {
        setStatus('status unavailable', 'error');
      } finally {
        workerStatusInflight = false;
        if (workerStatusPending) {
          workerStatusPending = false;
          // Drain follow-up immediately so a state change that arrived
          // during the previous request gets reflected without waiting
          // for the next poll tick.
          refreshWorkerStatus();
        }
      }
    }

    setInterval(refreshWorkerStatus, 1500);
    refreshWorkerStatus();
    updateContextUsage();

    // Trigger an immediate status refresh whenever the session reloads (the
    // file watcher fires this when the assistant's final message lands).
    // Without this, the Cancel button + "running" status linger until the
    // next poll tick, which feels broken right after a response completes.
    window.addEventListener('pi-session-reload', () => {
      refreshWorkerStatus();
      updateContextUsage();
    });

    // Focus the message textarea on page load so the user can start typing immediately.
    if (textarea && typeof textarea.focus === 'function') {
      textarea.focus();
    }

    // Setup Context Popover toggle
    const usageCapsule = document.getElementById('pi-chat-context-usage');
    const popover = document.getElementById('pi-chat-context-popover');
    if (usageCapsule && popover) {
      positionPopover = () => {
        const capsuleRect = usageCapsule.getBoundingClientRect();
        const shell = document.querySelector('.pi-chat-shell');
        if (!shell) return;
        const shellRect = shell.getBoundingClientRect();
        
        const capsuleCenter = capsuleRect.left + (capsuleRect.width / 2);
        
        // Center the 200px popover over the capsule
        let popoverLeft = capsuleCenter - shellRect.left - 100;
        
        // Keep it within shell bounds
        if (popoverLeft < 8) {
          popoverLeft = 8;
        }
        const maxLeft = shellRect.width - 208; // popover width + bounds margin
        if (popoverLeft > maxLeft) {
          popoverLeft = maxLeft;
        }
        
        popover.style.left = `${popoverLeft}px`;
        
        const popoverBottom = shellRect.bottom - capsuleRect.top + 8;
        popover.style.bottom = `${popoverBottom}px`;
        
        // Position the pointer arrow to point to capsule center
        const arrow = popover.querySelector('.pi-popover-arrow');
        if (arrow) {
          const arrowLeft = capsuleCenter - (shellRect.left + popoverLeft);
          const boundedArrowLeft = Math.min(180, Math.max(20, arrowLeft));
          arrow.style.left = `${boundedArrowLeft}px`;
        }
      };

      usageCapsule.addEventListener('click', (e) => {
        // Prevent click events inside the popover from triggering a toggle
        if (e.target.closest('#pi-chat-context-popover')) {
          e.stopPropagation();
          return;
        }
        
        // Handle close button
        if (e.target.closest('.pi-popover-close')) {
          popover.style.display = 'none';
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        
        const isShown = popover.style.display !== 'none';
        if (isShown) {
          popover.style.display = 'none';
        } else {
          popover.style.display = 'block';
          updateContextUsage(); // make sure it's fully populated and updated
          positionPopover();
        }
      });
      
      // Close popover when clicking anywhere else (excluding capsule and popover itself)
      document.addEventListener('click', (e) => {
        if (popover.style.display !== 'none') {
          if (!e.target.closest('#pi-chat-context-usage') && !e.target.closest('#pi-chat-context-popover')) {
            popover.style.display = 'none';
          }
        }
      });

      // Recalculate popover position on resize to keep arrow pointed at capsule
      window.addEventListener('resize', () => {
        if (popover.style.display !== 'none') {
          positionPopover();
        }
      }, { passive: true });
    }

    return true;
  }

  let _modelSelectorApi = null;
  let _thinkingSelectorApi = null;
  let _slashSelectorApi = null;

  function initPiChatControls() {
    setupCwdCopy();
    if (!setupPiChatComposer()) return;

    // Immediately set correct tooltips on load
    const modelBtn = document.getElementById('pi-chat-model-label');
    if (modelBtn) {
      if (isMobileTextInputMode()) {
        modelBtn.setAttribute('title', 'Switch model');
      } else {
        modelBtn.setAttribute('title', 'Switch model (Ctrl+I)');
      }
    }
    const thinkingBtn = document.getElementById('pi-chat-thinking-label');
    if (thinkingBtn) {
      if (isMobileTextInputMode()) {
        thinkingBtn.setAttribute('title', 'Switch effort');
      } else {
        thinkingBtn.setAttribute('title', 'Switch effort (Shift+Tab)');
      }
    }

    _modelSelectorApi = loadModelSelector();
    _thinkingSelectorApi = setupThinkingLevelSelector();
    _slashSelectorApi = loadSlashSelector();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPiChatControls);
  } else {
    initPiChatControls();
  }

  // Model selector
  function loadModelSelector() {
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

  // ── Slash-command palette ────────────────────────────────────────────
  function loadSlashSelector() {
    if (!__piSlashSelector || typeof __piSlashSelector.setupSlashCommands !== 'function') {
      return { handleKeydown: () => false };
    }
    const sessionId = new URLSearchParams(window.location.search).get('id') || (document.getElementById('pi-chat-composer') || {}).dataset?.sessionId || '';
    return __piSlashSelector.setupSlashCommands({
      documentImpl: document,
      sessionId,
      chatApi: __piChatApi,
      escapeHtml
    });
  }

  // ── Thinking level selector ──────────────────────────────────────────
  function setupThinkingLevelSelector() {
    const sessionId = new URLSearchParams(window.location.search).get('id') || (document.getElementById('pi-chat-composer') || {}).dataset?.sessionId || '';
    const api = __piThinkingSelector.setupThinkingLevelSelector({
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
    return api;
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
