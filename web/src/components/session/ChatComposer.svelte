<script module>
  // The chat composer runtime, absorbed from chat-composer-runner.js + the four
  // selector modules (model/thinking/slash/mention) — Svelte migration teardown,
  // docs/dev/svelte-migration-plan.md §11. runChatComposer stays a DI-friendly
  // exported function (its selector params default to the absorbed setups, but
  // tests can still inject mocks). The pure chat-selectors helpers + the chat API
  // stay as separate modules.
  import { icon, Maximize2, Paperclip, TextQuote, X } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
  import {
    THINKING_LEVELS,
    detectCurrentModel,
    findModel,
    groupModelsByProvider,
    isScopedModel,
    modelDisplayLabel,
    detectCurrentThinkingLevel,
    supportedThinkingLevels,
  } from '../../session/chat/chat-selectors.js';

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
  chatSelectors = { THINKING_LEVELS },
  modelSelector = { setupModelSelector },
  thinkingSelector = { setupThinkingLevelSelector },
  slashSelector = { setupSlashCommands },
  mentionSelector = { setupMentionAutocomplete },
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
  const __piMentionSelector = mentionSelector;
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
        showCwdToast(t('composer.pathCopied'));
      } else {
        showCwdToast(t('common.copyFailed'), true);
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
    // Text selections added via the annotations "Add to chat" button. Rendered as
    // clickable chips alongside image attachments and folded into the message on send.
    let selectedTextAttachments = [];
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
      return (v && v.trim().length > 0)
        || (typeof selectedChatFiles !== 'undefined' && selectedChatFiles.length > 0)
        || (typeof selectedTextAttachments !== 'undefined' && selectedTextAttachments.length > 0);
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
        remove.innerHTML = icon(X, { size: 13 });
        remove.addEventListener('click', () => {
          const [removed] = selectedChatFiles.splice(index, 1);
          if (removed) revokeAttachmentObjectUrl(removed);
          renderAttachments();
        });
        item.appendChild(remove);
        fragment.appendChild(item);
      });

      selectedTextAttachments.forEach((att, index) => {
        const item = document.createElement('span');
        item.className = 'pi-chat-attachment pi-chat-attachment-text';
        item.setAttribute('role', 'button');
        item.tabIndex = 0;
        item.title = t('composer.viewAttachment');

        const name = document.createElement('span');
        name.className = 'pi-chat-attachment-name';
        name.innerHTML = icon(TextQuote, { size: 12 });
        const label = document.createElement('span');
        label.textContent = textAttachmentLabel(att);
        name.appendChild(label);
        item.appendChild(name);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'pi-chat-remove';
        remove.setAttribute('aria-label', t('composer.removeAttachment'));
        remove.innerHTML = icon(X, { size: 13 });
        remove.addEventListener('click', (event) => {
          event.stopPropagation();
          selectedTextAttachments.splice(index, 1);
          renderAttachments();
        });
        item.appendChild(remove);

        item.addEventListener('click', (event) => {
          if (event.target.closest('.pi-chat-remove')) return;
          openTextAttachment(att);
        });
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openTextAttachment(att);
          }
        });
        fragment.appendChild(item);
      });

      attachmentList.replaceChildren(fragment);
      updateSendEnabled();
    }

    function textAttachmentLabel(att) {
      const snippet = String(att.original || '').replace(/\s+/g, ' ').trim();
      return snippet.length > 48 ? snippet.slice(0, 48) + '…' : (snippet || t('composer.attachmentText'));
    }

    attachButton.addEventListener('click', () => fileInput.click());

    // ── text-attachment viewer ("take a look" at a Add-to-chat selection) ──────
    const attachmentModal = document.getElementById('pi-chat-attachment-modal');
    const attachmentQuote = attachmentModal ? attachmentModal.querySelector('.pi-chat-attachment-card-quote') : null;
    const attachmentNote = attachmentModal ? attachmentModal.querySelector('.pi-chat-attachment-card-note') : null;

    function openTextAttachment(att) {
      if (!attachmentModal) return;
      if (attachmentQuote) attachmentQuote.textContent = att.original || '';
      if (attachmentNote) {
        attachmentNote.textContent = att.note || '';
        attachmentNote.hidden = !att.note;
      }
      attachmentModal.hidden = false;
    }
    function closeTextAttachment() {
      if (attachmentModal) attachmentModal.hidden = true;
    }
    if (attachmentModal) {
      attachmentModal.addEventListener('click', (event) => {
        if (event.target.closest('[data-action="close-attachment"]')) closeTextAttachment();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !attachmentModal.hidden) closeTextAttachment();
      });
    }

    // Selections handed off from the annotations layer ("Add to chat").
    window.addEventListener('pi-chat-attach-text', (event) => {
      const detail = (event && event.detail) || {};
      const original = String(detail.original || '').trim();
      if (!original) return;
      selectedTextAttachments.push({
        id: 'txt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        original,
        note: String(detail.note || '').trim(),
      });
      renderAttachments();
      if (textarea && typeof textarea.focus === 'function') textarea.focus();
    });

    // Fold text attachments into the outgoing message: each selection becomes a
    // blockquote (plus its note), with the typed message last.
    function composeMessage(typed) {
      if (selectedTextAttachments.length === 0) return typed;
      const blocks = selectedTextAttachments.map((att) => {
        const quoted = att.original.split('\n').map((line) => '> ' + line).join('\n');
        return att.note ? quoted + '\n\n' + att.note : quoted;
      });
      if (typed) blocks.push(typed);
      return blocks.join('\n\n');
    }

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
      if (_mentionSelectorApi && _mentionSelectorApi.handleKeydown(event)) return;
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
      const typed = textarea.value.trim();
      const filesToSend = selectedChatFiles.slice();
      const textAttachmentsToSend = selectedTextAttachments.slice();
      const message = composeMessage(typed);
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
      selectedTextAttachments = [];
      fileInput.value = '';
      renderAttachments();
      autoResizeTextarea();
      updateSendEnabled();

      const sent = await sendChatMessage(message, filesToSend);
      if (!sent) {
        textarea.value = typed;
        selectedChatFiles = filesToSend;
        selectedTextAttachments = textAttachmentsToSend;
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

      // The popover renders as a sibling of the capsule (outside the toolbar for
      // overflow safety), so clicks inside it never reach the capsule listener
      // above. Handle the close button — and swallow inner clicks so the
      // document-level outside-click handler doesn't immediately reopen/close.
      popover.addEventListener('click', (e) => {
        if (e.target.closest('.pi-popover-close')) {
          popover.style.display = 'none';
        }
        e.stopPropagation();
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
  let _mentionSelectorApi = null;

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
    _thinkingSelectorApi = loadThinkingSelector();
    _slashSelectorApi = loadSlashSelector();
    _mentionSelectorApi = loadMentionSelector();
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

  // ── @mention path autocomplete ───────────────────────────────────────
  function loadMentionSelector() {
    if (!__piMentionSelector || typeof __piMentionSelector.setupMentionAutocomplete !== 'function') {
      return { handleKeydown: () => false };
    }
    const sessionId = new URLSearchParams(window.location.search).get('id') || (document.getElementById('pi-chat-composer') || {}).dataset?.sessionId || '';
    return __piMentionSelector.setupMentionAutocomplete({
      documentImpl: document,
      windowImpl: window,
      sessionId,
      chatApi: __piChatApi,
      escapeHtml
    });
  }

  // ── Thinking level selector ──────────────────────────────────────────
  function loadThinkingSelector() {
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

  // ── Model selector (absorbed from model-selector.js) ─────────────────────

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

  // ── Thinking-level selector (absorbed from thinking-selector.js) ─────────

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

  // ── Slash-command palette (absorbed from slash-command.js) ───────────────
// Slash-command palette for the chat composer. Typing "/" at the start of the
// message opens a popup listing every command pi loaded for the session
// (extensions, prompt templates, and skills), filtered as you type. Picking one
// inserts "/<name> " into the composer.
//
// Commands only count to pi when the message *starts* with the slash, so the
// trigger is deliberately anchored to position 0 — a slash mid-message (e.g. a
// file path) never opens the palette.

const SOURCE_ORDER = ["prompt", "skill"];
const SOURCE_LABELS = {
  prompt: "Prompts",
  skill: "Skills",
};

// Only prompt templates and skills expand into a normal agent turn over the
// headless RPC worker. Extension commands (e.g. /insights, /view) drive pi's
// TUI via extension_ui_request events and never emit agent_end, so sending one
// leaves the session stuck "running" forever. They are excluded from the
// palette rather than offered and then hanging the composer.
const PALETTE_SOURCES = new Set(["prompt", "skill"]);

export function isPaletteCommand(cmd) {
  return !!cmd && PALETTE_SOURCES.has(cmd.source);
}

// parseSlashTrigger inspects the textarea value + caret position and returns the
// active command token, or null when the palette should not be open. The token
// spans from the leading "/" (which must be the first character) up to the first
// whitespace; once the caret moves past that token (i.e. the user typed a space
// and is now writing arguments) it returns null so the popup closes.
export function parseSlashTrigger(text, caret) {
  if (typeof text !== "string" || !text.startsWith("/")) return null;
  const wsMatch = text.match(/\s/);
  const tokenEnd = wsMatch ? wsMatch.index : text.length;
  if (caret > tokenEnd) return null;
  return { query: text.slice(1, tokenEnd), start: 0, end: tokenEnd };
}

export function filterCommands(commands, query) {
  const list = Array.isArray(commands) ? commands : [];
  const q = (query || "").toLowerCase();
  if (!q) return list.slice();
  return list.filter((c) => (c.name || "").toLowerCase().includes(q));
}

// groupCommands returns ordered, non-empty groups (extensions, prompts, skills).
// Sources pi may add in the future fall into a trailing "Other" group so they
// are still reachable rather than silently dropped.
export function groupCommands(commands) {
  const buckets = new Map();
  (commands || []).forEach((c) => {
    const source = c.source || "other";
    if (!buckets.has(source)) buckets.set(source, []);
    buckets.get(source).push(c);
  });
  const groups = [];
  SOURCE_ORDER.forEach((source) => {
    if (buckets.has(source)) {
      groups.push({
        source,
        label: SOURCE_LABELS[source],
        items: buckets.get(source),
      });
      buckets.delete(source);
    }
  });
  for (const [source, items] of buckets) {
    groups.push({ source, label: "Other", items, _source: source });
  }
  return groups;
}

export function renderCommandList(
  commands,
  { query = "", escapeHtml = String, loading = false } = {},
) {
  if (loading) return '<div class="slash-empty">Loading commands…</div>';
  const filtered = filterCommands(commands, query);
  if (filtered.length === 0)
    return '<div class="slash-empty">No commands match</div>';

  let html = "";
  groupCommands(filtered).forEach((group) => {
    html += `<div class="slash-group">${escapeHtml(group.label)}</div>`;
    group.items.forEach((cmd) => {
      const name = cmd.name || "";
      const desc = cmd.description || "";
      const descHtml = desc
        ? `<span class="slash-item-desc">${escapeHtml(desc)}</span>`
        : "";
      html +=
        `<button type="button" class="slash-item" data-insert="${escapeHtml(name)}">` +
        `<span class="slash-item-name">/${escapeHtml(name)}</span>${descHtml}</button>`;
    });
  });
  return html;
}

export function setupSlashCommands({
  documentImpl = document,
  sessionId,
  chatApi,
  escapeHtml = String,
} = {}) {
  const textarea = documentImpl.getElementById("pi-chat-message");
  const popup = documentImpl.getElementById("pi-chat-slash-popup");
  const list = documentImpl.getElementById("pi-chat-slash-list");
  if (!textarea || !popup || !list) return { handleKeydown: () => false };

  let allCommands = [];
  let loaded = false;
  let loading = false;
  let trigger = null;

  function isOpen() {
    return popup.style.display !== "none" && popup.style.display !== "";
  }

  function items() {
    return list.querySelectorAll(".slash-item");
  }

  function setActive(index) {
    const all = items();
    const clamped = Math.max(0, Math.min(index, all.length - 1));
    list.dataset.activeIndex = String(all.length ? clamped : -1);
    all.forEach((el, i) => el.classList.toggle("active", i === clamped));
    all[clamped]?.scrollIntoView?.({ block: "nearest" });
  }

  function render() {
    list.innerHTML = renderCommandList(allCommands, {
      query: trigger ? trigger.query : "",
      escapeHtml,
      loading: loading && !loaded,
    });
    setActive(0);
  }

  function open() {
    popup.style.display = "block";
    render();
    if (!loaded && !loading) {
      loading = true;
      render();
      chatApi
        .getCommands(sessionId, { load: true })
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("commands error")),
        )
        .then((data) => {
          allCommands = (data.commands || []).filter(isPaletteCommand);
        })
        .catch(() => {
          allCommands = [];
        })
        .finally(() => {
          loaded = true;
          loading = false;
          if (isOpen()) render();
        });
    }
  }

  function close() {
    popup.style.display = "none";
    trigger = null;
  }

  function refresh() {
    const next = parseSlashTrigger(
      textarea.value,
      textarea.selectionStart ?? textarea.value.length,
    );
    if (!next) {
      if (isOpen()) close();
      return;
    }
    const wasOpen = isOpen();
    trigger = next;
    if (wasOpen) render();
    else open();
  }

  function insert(name) {
    if (!trigger) return;
    const value = textarea.value;
    const replacement = `/${name} `;
    textarea.value =
      value.slice(0, trigger.start) + replacement + value.slice(trigger.end);
    const caret = trigger.start + replacement.length;
    textarea.selectionStart = textarea.selectionEnd = caret;
    close();
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Called by the composer's own keydown handler *before* its Enter-to-submit
  // logic so navigation/selection wins while the palette is open. Returns true
  // when the key was consumed.
  function handleKeydown(event) {
    if (!isOpen()) return false;
    const all = items();
    let active = parseInt(list.dataset.activeIndex || "-1", 10);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive(active + 1);
        return true;
      case "ArrowUp":
        event.preventDefault();
        setActive(active - 1);
        return true;
      case "Enter":
      case "Tab":
        if (active >= 0 && all[active]) {
          event.preventDefault();
          all[active].click();
          return true;
        }
        return false;
      case "Escape":
        event.preventDefault();
        close();
        return true;
      default:
        return false;
    }
  }

  textarea.addEventListener("input", refresh);

  list.addEventListener("click", (event) => {
    const item = event.target.closest(".slash-item");
    if (!item) return;
    insert(item.dataset.insert || "");
  });

  documentImpl.addEventListener("click", (event) => {
    if (isOpen() && !popup.contains(event.target) && event.target !== textarea)
      close();
  });

  return { handleKeydown, open, close, isOpen, refresh };
}

  // ── @mention path autocomplete (absorbed from mention-autocomplete.js) ───
// @mention path autocomplete for the chat composer. Typing "@" opens a popup
// listing files and folders from the session's working directory, fetched from
// GET /api/files. Filtering, ranking, and bounds live on the server; this module
// just anchors the trigger, debounces requests, and inserts the chosen path.
//
// Unlike the slash palette (anchored to position 0), "@" can appear anywhere in
// the message, so the trigger scans backward from the caret to the nearest "@"
// at a token boundary. Selecting a directory keeps the popup open with a scoped
// query (e.g. "@src/" then "@src/foo"); selecting a file inserts the path plus a
// trailing space and closes.

// parseAtTrigger inspects the textarea value + caret and returns the active
// mention token, or null when the popup should be closed. The token starts at an
// "@" that is either at the start of the message or preceded by whitespace, and
// runs to the caret with no intervening whitespace. This deliberately ignores
// emails like "foo@bar" because the "@" there is preceded by a non-space.
export function parseAtTrigger(text, caret) {
  if (typeof text !== "string") return null;
  if (caret == null) caret = text.length;
  let at = -1;
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "@") {
      at = i;
      break;
    }
    if (/\s/.test(ch)) return null;
  }
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(text[at - 1])) return null;
  return { query: text.slice(at + 1, caret), start: at, end: caret };
}

export function renderFileList(
  files,
  { escapeHtml = String, loading = false } = {},
) {
  if (loading) return '<div class="slash-empty">Searching files…</div>';
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0)
    return '<div class="slash-empty">No files match</div>';
  let html = "";
  list.forEach((f) => {
    const path = f.path || "";
    const display = f.isDir ? path + "/" : path;
    html +=
      `<button type="button" class="slash-item" data-insert="${escapeHtml(path)}" data-isdir="${f.isDir ? "1" : ""}">` +
      `<span class="slash-item-name">${escapeHtml(display)}</span></button>`;
  });
  return html;
}

export function setupMentionAutocomplete({
  documentImpl = document,
  windowImpl = window,
  sessionId,
  chatApi,
  escapeHtml = String,
  debounceMs = 120,
  setTimeoutImpl = (windowImpl || globalThis).setTimeout.bind(windowImpl || globalThis),
  clearTimeoutImpl = (windowImpl || globalThis).clearTimeout.bind(windowImpl || globalThis),
  AbortControllerImpl = (windowImpl || globalThis).AbortController,
} = {}) {
  const textarea = documentImpl.getElementById("pi-chat-message");
  const popup = documentImpl.getElementById("pi-chat-mention-popup");
  const list = documentImpl.getElementById("pi-chat-mention-list");
  if (!textarea || !popup || !list) return { handleKeydown: () => false };

  let trigger = null;
  let debounceTimer = null;
  let inflight = null;
  let reqSeq = 0;

  function isOpen() {
    return popup.style.display !== "none" && popup.style.display !== "";
  }

  function items() {
    return list.querySelectorAll(".slash-item");
  }

  function setActive(index) {
    const all = items();
    const clamped = Math.max(0, Math.min(index, all.length - 1));
    list.dataset.activeIndex = String(all.length ? clamped : -1);
    all.forEach((el, i) => el.classList.toggle("active", i === clamped));
    all[clamped]?.scrollIntoView?.({ block: "nearest" });
  }

  function renderFiles(files, loading) {
    list.innerHTML = renderFileList(files, { escapeHtml, loading });
    setActive(0);
  }

  function open() {
    popup.style.display = "block";
  }

  function close() {
    popup.style.display = "none";
    trigger = null;
    if (debounceTimer != null) {
      clearTimeoutImpl(debounceTimer);
      debounceTimer = null;
    }
    if (inflight) {
      inflight.abort();
      inflight = null;
    }
  }

  function fetchAndRender() {
    if (!trigger) return;
    const query = trigger.query;
    const seq = ++reqSeq;
    if (inflight) inflight.abort();
    inflight = AbortControllerImpl ? new AbortControllerImpl() : null;
    const signal = inflight ? inflight.signal : undefined;
    chatApi
      .getFiles(sessionId, query, { signal })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("files error")),
      )
      .then((data) => {
        if (seq !== reqSeq || !isOpen()) return; // stale response
        renderFiles(data.files || [], false);
      })
      .catch((err) => {
        if (err && err.name === "AbortError") return;
        if (seq !== reqSeq || !isOpen()) return;
        renderFiles([], false);
      });
  }

  function refresh() {
    const next = parseAtTrigger(
      textarea.value,
      textarea.selectionStart ?? textarea.value.length,
    );
    if (!next) {
      if (isOpen()) close();
      return;
    }
    trigger = next;
    if (!isOpen()) {
      open();
      renderFiles([], true);
    }
    if (debounceTimer != null) clearTimeoutImpl(debounceTimer);
    debounceTimer = setTimeoutImpl(() => {
      debounceTimer = null;
      fetchAndRender();
    }, debounceMs);
  }

  function insert(path, isDir) {
    if (!trigger) return;
    const value = textarea.value;
    const replacement = isDir ? `@${path}/` : `${path} `;
    textarea.value =
      value.slice(0, trigger.start) + replacement + value.slice(trigger.end);
    const caret = trigger.start + replacement.length;
    textarea.selectionStart = textarea.selectionEnd = caret;
    if (!isDir) close();
    textarea.focus();
    // Re-running input lets a directory selection re-trigger a scoped query and
    // a file selection close cleanly (no "@" remains before the caret).
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Called by the composer's keydown handler before its Enter-to-submit logic so
  // navigation/selection wins while the popup is open. Returns true when the key
  // was consumed.
  function handleKeydown(event) {
    if (!isOpen()) return false;
    const all = items();
    let active = parseInt(list.dataset.activeIndex || "-1", 10);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive(active + 1);
        return true;
      case "ArrowUp":
        event.preventDefault();
        setActive(active - 1);
        return true;
      case "Enter":
      case "Tab":
        if (active >= 0 && all[active]) {
          event.preventDefault();
          all[active].click();
          return true;
        }
        return false;
      case "Escape":
        event.preventDefault();
        close();
        return true;
      default:
        return false;
    }
  }

  textarea.addEventListener("input", refresh);

  list.addEventListener("click", (event) => {
    const item = event.target.closest(".slash-item");
    if (!item) return;
    insert(item.dataset.insert || "", item.dataset.isdir === "1");
  });

  documentImpl.addEventListener("click", (event) => {
    if (isOpen() && !popup.contains(event.target) && event.target !== textarea)
      close();
  });

  return { handleKeydown, open, close, isOpen, refresh };
}
</script>

<script>
  import { onMount } from 'svelte';
  import { escapeHtml } from '../../session/render/session-format.js';
  import { getSessionRuntime } from '../../session/session-runtime-context.js';
  import * as chatApi from '../../session/chat/chat-api.js';
  import GitFooter from './GitFooter.svelte';

  let {
    sessionId = '',
    chatAvailable = true,
    chatDisabledReason = '',
    cwd = '',
    modelLabel = '',
  } = $props();

  // The composer runtime lives in <script module> (runChatComposer). It reads the
  // shared model + navigateTo (owned by SessionPage runtime context) at mount —
  // both are ready before this onMount. <LiveReload> mounts first, so its
  // pi-chat-message-sent listener is attached before the user can send. Live-only.
  onMount(() => {
    const target = window;
    const runtime = getSessionRuntime();
    const model = runtime.model || target.__piSessionDataModel;
    globalThis.__PI_TEST_CHAT_COMPOSER_HOOK__?.();
    runChatComposer({
      documentImpl: document,
      windowImpl: target,
      locationImpl: target.location,
      localEntries: model?.entries || [],
      leafId: model?.leafId || '',
      urlTargetId: model?.urlTargetId || '',
      byId: model?.byId || new Map(),
      navigateTo: runtime.navigateTo || target.navigateTo,
      escapeHtml: (text) => escapeHtml(text, { documentImpl: document }),
      chatApi,
      FormDataImpl: target.FormData,
      URLSearchParamsImpl: target.URLSearchParams,
      CustomEventImpl: target.CustomEvent,
      setIntervalImpl: target.setInterval.bind(target),
    });
  });
</script>

<form id="pi-chat-composer" class="pi-chat-composer" data-session-id={sessionId} data-chat-available={chatAvailable} data-chat-disabled-reason={chatDisabledReason}>
  <input id="pi-chat-images" name="images" type="file" accept="image/*" multiple hidden disabled={!chatAvailable}>
  <div class="pi-chat-shell">
    <button type="button" id="pi-chat-expand" class="pi-chat-expand-button" title={t('composer.expand')} aria-label={t('composer.expand')} aria-pressed="false" disabled={!chatAvailable}>{@html icon(Maximize2, { size: 14 })}</button>
    {#if cwd}<div class="pi-chat-toolbar pi-chat-cwd-bar"><span class="pi-chat-cwd" title={t('composer.copyPath')} data-cwd={cwd}>cwd: {cwd}</span><span class="pi-chat-focus-shortcut">{t('composer.focusShortcut')}</span></div>{/if}
    {#if !chatAvailable}<div class="pi-chat-disabled-notice">{chatDisabledReason}</div>{/if}
    <textarea id="pi-chat-message" name="message" rows="1" placeholder={t('composer.placeholder')} disabled={!chatAvailable}></textarea>
    <div id="pi-chat-attachments" class="pi-chat-attachments"></div>
    <div id="pi-chat-model-popup" class="pi-chat-model-popup" style="display: none"><input type="text" id="pi-chat-model-search" class="pi-chat-model-search" placeholder={t('composer.searchModels')} autocomplete="off"><div id="pi-chat-model-list" class="pi-chat-model-list"></div></div>
    <div id="pi-chat-thinking-popup" class="pi-chat-thinking-popup" style="display: none"><div id="pi-chat-thinking-list" class="pi-chat-thinking-list"></div></div>
    <div id="pi-chat-slash-popup" class="pi-chat-slash-popup" style="display: none"><div id="pi-chat-slash-list" class="pi-chat-slash-list"></div></div>
    <div id="pi-chat-mention-popup" class="pi-chat-slash-popup" style="display: none"><div id="pi-chat-mention-list" class="pi-chat-slash-list"></div></div>
    <div class="pi-chat-toolbar"><div class="pi-chat-toolbar-left"><button type="button" id="pi-chat-attach" class="pi-chat-icon-button pi-chat-photo-button" title={t('composer.attachPhotos')} aria-label={t('composer.attachPhotos')} disabled={!chatAvailable}>{@html icon(Paperclip, { size: 15 })}</button><span id="pi-chat-status" class="pi-chat-status">{chatAvailable ? t('composer.idle') : t('composer.unavailable')}</span><button type="button" id="pi-chat-thinking-label" class="pi-chat-thinking-label" style="display: none" title={t('composer.switchEffort')} disabled={!chatAvailable}></button><button type="button" id="pi-chat-model-label" class="pi-chat-model-label" title={t('composer.switchModel')} style:display={modelLabel ? '' : 'none'} disabled={!chatAvailable}>{modelLabel}</button><div id="pi-chat-context-usage" class="pi-chat-context-usage" style="display: none" title={t('composer.contextDetails')}><svg class="pi-context-circle" viewBox="0 0 36 36"><path class="pi-context-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/><path class="pi-context-fill" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/></svg><span class="pi-context-text">0%</span></div></div><div class="actions"><button type="button" id="pi-chat-cancel" class="pi-chat-cancel" style="display: none" title={t('composer.cancelRunning')} aria-label={t('composer.cancelRunning')} disabled={!chatAvailable}>{t('composer.cancel')}</button><button type="submit" id="pi-chat-send" class="pi-chat-send" disabled>{t('composer.send')}</button></div></div>
    <div id="pi-chat-context-popover" class="pi-chat-context-popover" style="display: none;">
      <div class="pi-popover-arrow"></div>
      <div class="pi-popover-header">
        <span class="pi-popover-title">Context</span>
        <span class="pi-popover-close">{@html icon(X, { size: 13 })}</span>
      </div>
      <div class="pi-popover-body">
        <div class="pi-popover-hero">
          <span class="pi-popover-used">0</span>
          <span class="pi-popover-divider">/</span>
          <span class="pi-popover-limit">128k</span>
        </div>
        <div class="pi-popover-progress-container">
          <div class="pi-popover-progress-bar" style="width: 0%;"></div>
        </div>
        <div class="pi-popover-details">
          <div class="pi-popover-row">
            <span class="pi-row-label">Input</span>
            <span class="pi-row-value" id="pi-popover-val-input">0</span>
          </div>
          <div class="pi-popover-row">
            <span class="pi-row-label">Cache read</span>
            <span class="pi-row-value" id="pi-popover-val-cache-read">0</span>
          </div>
          <div class="pi-popover-row">
            <span class="pi-row-label">Cache write</span>
            <span class="pi-row-value" id="pi-popover-val-cache-write">0</span>
          </div>
          <div class="pi-popover-row">
            <span class="pi-row-label">Output</span>
            <span class="pi-row-value" id="pi-popover-val-output">0</span>
          </div>
          <div class="pi-popover-separator"></div>
          <div class="pi-popover-row pi-popover-total">
            <span class="pi-row-label">Total I/O</span>
            <span class="pi-row-value" id="pi-popover-val-total">0</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div id="pi-chat-attachment-modal" class="pi-chat-attachment-modal" hidden>
    <div class="pi-chat-attachment-backdrop" data-action="close-attachment"></div>
    <div class="pi-chat-attachment-card" role="dialog" aria-modal="true" aria-label={t('composer.attachmentText')}>
      <div class="pi-chat-attachment-card-header">
        <span class="pi-chat-attachment-card-title">{t('composer.attachmentText')}</span>
        <button type="button" class="pi-chat-attachment-card-close" data-action="close-attachment" aria-label={t('common.close')}>{@html icon(X, { size: 15 })}</button>
      </div>
      <pre class="pi-chat-attachment-card-quote"></pre>
      <div class="pi-chat-attachment-card-note" hidden></div>
    </div>
  </div>
  <GitFooter {sessionId} />
</form>
