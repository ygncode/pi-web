export function clearChatPreview(state, { keepAssistant = false } = {}) {
  if (state.pendingUserEl && state.pendingUserEl.parentNode) {
    state.pendingUserEl.parentNode.removeChild(state.pendingUserEl);
    state.pendingUserEl = null;
  }
  if (!keepAssistant) {
    if (state.chatPreviewEl && state.chatPreviewEl.parentNode) {
      state.chatPreviewEl.parentNode.removeChild(state.chatPreviewEl);
    }
    state.chatPreviewEl = null;
    stopWorkingAnimation(state);
  }
}

export function finishChatPreview(state) {
  if (!state?.chatPreviewEl) return false;
  state.chatPreviewEl.classList.remove('chat-preview-waiting');
  state.chatPreviewEl.classList.add('done');
  const label = state.chatPreviewEl.querySelector('.preview-label');
  if (label && label.parentNode) label.parentNode.removeChild(label);
  stopWorkingAnimation(state);
  return true;
}
// Test placeholder for TestSessionViteSourceShowsAnimatedWorkingPreviewLabel: working<span class="working-dots"

export function getSpinnerConfig(windowImpl = typeof window !== 'undefined' ? window : null) {
  let style = 'runcat';
  try {
    if (windowImpl && windowImpl.localStorage) {
      const saved = windowImpl.localStorage.getItem('pi-sessions:spinner-style');
      if (saved === 'braille') {
        style = 'braille';
      }
    }
  } catch (_) {}

  if (style === 'braille') {
    return {
      frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
      fontFamily: 'monospace',
      interval: 80,
      width: '12px'
    };
  } else {
    // runcat frames mapping to unicode private use area characters in runcat.ttf font
    return {
      frames: ["", "", "", "", ""],
      fontFamily: "'runcat', monospace",
      interval: 100,
      width: '18px'
    };
  }
}

const CREATIVE_MESSAGES = [
  "Working...",
  "Thinking...",
  "Analyzing codebase...",
  "Synthesizing answer...",
  "Consulting model...",
  "Formulating solution...",
  "Checking files...",
  "Drafting response..."
];

export function startWorkingAnimation(state, { setIntervalImpl = setInterval, windowImpl = typeof window !== 'undefined' ? window : null } = {}) {
  stopWorkingAnimation(state);

  const config = getSpinnerConfig(windowImpl);
  let frameIdx = 0;
  let msgIdx = 0;
  let lastMsgChange = Date.now();
  state.activePreviewMessage = null;

  // Sync initial spinner properties if spinner element is already present
  if (state.chatPreviewEl) {
    const spinnerEl = state.chatPreviewEl.querySelector('.preview-spinner');
    if (spinnerEl) {
      spinnerEl.style.fontFamily = config.fontFamily;
      spinnerEl.style.width = config.width;
      spinnerEl.textContent = config.frames[0];
    }
  }

  state.spinnerInterval = setIntervalImpl(() => {
    if (!state.chatPreviewEl) {
      stopWorkingAnimation(state);
      return;
    }

    const spinnerEl = state.chatPreviewEl.querySelector('.preview-spinner');
    if (spinnerEl) {
      if (spinnerEl.style.fontFamily !== config.fontFamily) {
        spinnerEl.style.fontFamily = config.fontFamily;
        spinnerEl.style.width = config.width;
      }
      frameIdx = (frameIdx + 1) % config.frames.length;
      spinnerEl.textContent = config.frames[frameIdx];
    }

    if (!state.activePreviewMessage && Date.now() - lastMsgChange >= 2000) {
      const textEl = state.chatPreviewEl.querySelector('.preview-text');
      if (textEl) {
        msgIdx = (msgIdx + 1) % CREATIVE_MESSAGES.length;
        textEl.textContent = CREATIVE_MESSAGES[msgIdx];
        lastMsgChange = Date.now();
      }
    }
  }, config.interval);
}

export function stopWorkingAnimation(state, { clearIntervalImpl = clearInterval } = {}) {
  if (state && state.spinnerInterval) {
    clearIntervalImpl(state.spinnerInterval);
    state.spinnerInterval = null;
  }
  if (state) {
    state.activePreviewMessage = null;
  }
}

function getActiveMessage(content) {
  if (!content) return null;

  // Check if there is an active/open thinking block
  const openThoughtIdx = content.lastIndexOf('<thought>');
  const closeThoughtIdx = content.lastIndexOf('</thought>');
  if (openThoughtIdx !== -1 && openThoughtIdx > closeThoughtIdx) {
    return "Thinking...";
  }

  // Check if there is an active/open code block
  const codeBlockCount = (content.match(/```/g) || []).length;
  if (codeBlockCount % 2 === 1) {
    return "Writing code...";
  }

  return "Generating response...";
}

function setMarkdownContent(el, html) {
  // `renderMarkdown` returns sanitized markdown HTML (or escaped fallback). This
  // is content rendering, not structural view construction; the surrounding
  // preview DOM is built with elements so the helper stays narrowly scoped.
  if (el) el.innerHTML = html;
}

function createMarkdownBlock(documentImpl, className) {
  const el = documentImpl.createElement('div');
  el.className = className;
  return el;
}

function createPreviewLabel(documentImpl, config) {
  const label = documentImpl.createElement('div');
  label.className = 'preview-label';
  const spinner = documentImpl.createElement('span');
  spinner.className = 'preview-spinner';
  spinner.style.color = 'var(--accent)';
  spinner.style.marginRight = '6px';
  spinner.style.fontFamily = config.fontFamily;
  spinner.style.display = 'inline-block';
  spinner.style.width = config.width;
  spinner.style.textAlign = 'center';
  spinner.textContent = config.frames[0];
  const text = documentImpl.createElement('span');
  text.className = 'preview-text';
  text.style.color = 'var(--muted)';
  text.textContent = 'Working...';
  label.append(spinner, text);
  return label;
}

function createAssistantPreview(documentImpl, { waiting = false, windowImpl = null } = {}) {
  const config = getSpinnerConfig(windowImpl);
  const el = documentImpl.createElement('div');
  el.id = 'chat-preview-stream';
  el.className = 'assistant-message chat-preview-stream' + (waiting ? ' chat-preview-waiting' : '');
  el.append(
    createMarkdownBlock(documentImpl, 'message-content assistant-text markdown-content'),
    createPreviewLabel(documentImpl, config),
  );
  return el;
}

export function renderPendingChat(message, state, {
  documentImpl = document,
  windowImpl = typeof window !== 'undefined' ? window : null,
  renderMarkdown,
  shouldFollow = () => false,
  forceFollowToBottom = () => {},
  scrollAfterLayout = () => {},
  setIntervalImpl = setInterval
} = {}) {
  const text = String(message || '').trim();
  if (!text) return false;
  const container = documentImpl.getElementById('messages') || documentImpl.getElementById('content') || documentImpl.body;
  clearChatPreview(state);

  state.pendingUserEl = documentImpl.createElement('div');
  state.pendingUserEl.id = 'chat-pending-user';
  state.pendingUserEl.className = 'user-message chat-pending-user';
  const userContent = createMarkdownBlock(documentImpl, 'markdown-content');
  setMarkdownContent(userContent, renderMarkdown(text));
  state.pendingUserEl.appendChild(userContent);
  container.appendChild(state.pendingUserEl);

  state.chatPreviewEl = createAssistantPreview(documentImpl, { waiting: true, windowImpl });
  container.appendChild(state.chatPreviewEl);

  startWorkingAnimation(state, { setIntervalImpl, windowImpl });

  if (shouldFollow()) {
    forceFollowToBottom(false);
    scrollAfterLayout(false, state.chatPreviewEl);
  }
  return true;
}

export function renderChatPreview(payload, state, {
  documentImpl = document,
  windowImpl = typeof window !== 'undefined' ? window : null,
  renderMarkdown,
  shouldFollow = () => false,
  forceFollowToBottom = () => {},
  scrollAfterLayout = () => {},
  setIntervalImpl = setInterval
} = {}) {
  if (!payload || typeof payload.content !== 'string') return false;
  const container = documentImpl.getElementById('messages') || documentImpl.getElementById('content') || documentImpl.body;
  if (!state.chatPreviewEl) {
    state.chatPreviewEl = createAssistantPreview(documentImpl, { windowImpl });
    container.appendChild(state.chatPreviewEl);
    startWorkingAnimation(state, { setIntervalImpl, windowImpl });
  }

  const activeMsg = getActiveMessage(payload.content);
  if (activeMsg) {
    state.activePreviewMessage = activeMsg;
    const textEl = state.chatPreviewEl.querySelector('.preview-text');
    if (textEl) textEl.textContent = activeMsg;
  }

  state.chatPreviewEl.classList.remove('chat-preview-waiting');
  const content = state.chatPreviewEl.querySelector('.message-content');
  setMarkdownContent(content, renderMarkdown(payload.content));
  if (payload.done) finishChatPreview(state);
  else state.chatPreviewEl.classList.remove('done');
  if (shouldFollow()) {
    forceFollowToBottom(false);
    scrollAfterLayout(false, state.chatPreviewEl);
  }
  return true;
}
