export function clearChatPreview(state) {
  if (state.chatPreviewEl && state.chatPreviewEl.parentNode) {
    state.chatPreviewEl.parentNode.removeChild(state.chatPreviewEl);
  }
  state.chatPreviewEl = null;
}

export function renderChatPreview(payload, state, {
  documentImpl = document,
  renderMarkdown,
  shouldFollow = () => false,
  forceFollowToBottom = () => {},
  scrollAfterLayout = () => {}
} = {}) {
  if (!payload || typeof payload.content !== 'string' || payload.content.length === 0) return false;
  const container = documentImpl.getElementById('messages') || documentImpl.getElementById('content') || documentImpl.body;
  if (!state.chatPreviewEl) {
    state.chatPreviewEl = documentImpl.createElement('div');
    state.chatPreviewEl.id = 'chat-preview-stream';
    state.chatPreviewEl.className = 'assistant-message chat-preview-stream';
    state.chatPreviewEl.innerHTML = '<div class="message-content assistant-text"></div><div class="preview-label">working<span class="working-dots" aria-hidden="true"></span></div>';
    container.appendChild(state.chatPreviewEl);
  }
  const content = state.chatPreviewEl.querySelector('.message-content');
  if (content) content.innerHTML = renderMarkdown(payload.content);
  state.chatPreviewEl.classList.toggle('done', !!payload.done);
  if (shouldFollow()) {
    forceFollowToBottom(false);
    scrollAfterLayout(false, state.chatPreviewEl);
  }
  return true;
}
