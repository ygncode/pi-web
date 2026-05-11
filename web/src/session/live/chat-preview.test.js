import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { clearChatPreview, renderChatPreview } from './chat-preview.js';

describe('chat preview', () => {
  it('renders, updates, follows, and clears preview', () => {
    const dom = new JSDOM('<body><div id="messages"></div></body>');
    const state = { chatPreviewEl: null };
    const forceFollowToBottom = vi.fn();
    const scrollAfterLayout = vi.fn();

    expect(renderChatPreview({ content: 'hello', done: false }, state, {
      documentImpl: dom.window.document,
      renderMarkdown: (text) => `<p>${text}</p>`,
      shouldFollow: () => true,
      forceFollowToBottom,
      scrollAfterLayout
    })).toBe(true);

    expect(dom.window.document.getElementById('chat-preview-stream')).toBeTruthy();
    expect(state.chatPreviewEl.querySelector('.message-content').innerHTML).toBe('<p>hello</p>');
    expect(forceFollowToBottom).toHaveBeenCalledWith(false);

    renderChatPreview({ content: 'done', done: true }, state, {
      documentImpl: dom.window.document,
      renderMarkdown: (text) => text,
      shouldFollow: () => false
    });
    expect(state.chatPreviewEl.classList.contains('done')).toBe(true);

    clearChatPreview(state);
    expect(dom.window.document.getElementById('chat-preview-stream')).toBe(null);
    expect(state.chatPreviewEl).toBe(null);
  });
});
