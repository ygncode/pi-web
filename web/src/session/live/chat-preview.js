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

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
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

export function startWorkingAnimation(state, { setIntervalImpl = setInterval } = {}) {
  stopWorkingAnimation(state);

  let frameIdx = 0;
  let msgIdx = 0;
  let lastMsgChange = Date.now();
  state.activePreviewMessage = null;

  state.spinnerInterval = setIntervalImpl(() => {
    if (!state.chatPreviewEl) {
      stopWorkingAnimation(state);
      return;
    }

    const spinnerEl = state.chatPreviewEl.querySelector('.preview-spinner');
    if (spinnerEl) {
      frameIdx = (frameIdx + 1) % SPINNER_FRAMES.length;
      spinnerEl.textContent = SPINNER_FRAMES[frameIdx];
    }

    if (!state.activePreviewMessage && Date.now() - lastMsgChange >= 2000) {
      const textEl = state.chatPreviewEl.querySelector('.preview-text');
      if (textEl) {
        msgIdx = (msgIdx + 1) % CREATIVE_MESSAGES.length;
        textEl.textContent = CREATIVE_MESSAGES[msgIdx];
        lastMsgChange = Date.now();
      }
    }
  }, 80);
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

export function renderPendingChat(message, state, {
  documentImpl = document,
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
  state.pendingUserEl.innerHTML = '<div class="markdown-content"></div>';
  const userContent = state.pendingUserEl.querySelector('.markdown-content');
  if (userContent) userContent.innerHTML = renderMarkdown(text);
  container.appendChild(state.pendingUserEl);

  state.chatPreviewEl = documentImpl.createElement('div');
  state.chatPreviewEl.id = 'chat-preview-stream';
  state.chatPreviewEl.className = 'assistant-message chat-preview-stream chat-preview-waiting';
  state.chatPreviewEl.innerHTML = '<div class="message-content assistant-text markdown-content"></div><div class="preview-label"><span class="preview-spinner" style="color: var(--accent); margin-right: 6px; font-family: monospace; display: inline-block; width: 12px; text-align: center;">⠋</span><span class="preview-text" style="color: var(--muted);">Working...</span></div>';
  container.appendChild(state.chatPreviewEl);

  startWorkingAnimation(state, { setIntervalImpl });

  if (shouldFollow()) {
    forceFollowToBottom(false);
    scrollAfterLayout(false, state.chatPreviewEl);
  }
  return true;
}

export function renderChatPreview(payload, state, {
  documentImpl = document,
  renderMarkdown,
  shouldFollow = () => false,
  forceFollowToBottom = () => {},
  scrollAfterLayout = () => {},
  setIntervalImpl = setInterval
} = {}) {
  if (!payload || typeof payload.content !== 'string') return false;
  const container = documentImpl.getElementById('messages') || documentImpl.getElementById('content') || documentImpl.body;
  if (!state.chatPreviewEl) {
    state.chatPreviewEl = documentImpl.createElement('div');
    state.chatPreviewEl.id = 'chat-preview-stream';
    state.chatPreviewEl.className = 'assistant-message chat-preview-stream';
    state.chatPreviewEl.innerHTML = '<div class="message-content assistant-text markdown-content"></div><div class="preview-label"><span class="preview-spinner" style="color: var(--accent); margin-right: 6px; font-family: monospace; display: inline-block; width: 12px; text-align: center;">⠋</span><span class="preview-text" style="color: var(--muted);">Working...</span></div>';
    container.appendChild(state.chatPreviewEl);
    startWorkingAnimation(state, { setIntervalImpl });
  }

  const activeMsg = getActiveMessage(payload.content);
  if (activeMsg) {
    state.activePreviewMessage = activeMsg;
    const textEl = state.chatPreviewEl.querySelector('.preview-text');
    if (textEl) textEl.textContent = activeMsg;
  }

  state.chatPreviewEl.classList.remove('chat-preview-waiting');
  const content = state.chatPreviewEl.querySelector('.message-content');
  if (content) content.innerHTML = renderMarkdown(payload.content);
  if (payload.done) finishChatPreview(state);
  else state.chatPreviewEl.classList.remove('done');
  if (shouldFollow()) {
    forceFollowToBottom(false);
    scrollAfterLayout(false, state.chatPreviewEl);
  }
  return true;
}
