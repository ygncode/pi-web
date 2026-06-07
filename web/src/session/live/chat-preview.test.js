import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { clearChatPreviewState as clearChatPreview, finishChatPreviewState as finishChatPreview, renderChatPreviewState as renderChatPreview, renderPendingChatState as renderPendingChat } from '../../components/session/LiveReload.svelte';

describe('chat preview', () => {
  it('renders, updates, follows, and clears preview', () => {
    const dom = new JSDOM('<body><div id="messages"></div></body>');
    const state = { chatPreviewEl: null, pendingUserEl: null };
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
    // Must include markdown-content so the streaming preview picks up the
    // same heading/hr/list/code styles as the settled assistant message.
    expect(state.chatPreviewEl.querySelector('.message-content').classList.contains('markdown-content')).toBe(true);
    expect(forceFollowToBottom).toHaveBeenCalledWith(false);

    renderChatPreview({ content: 'done', done: true }, state, {
      documentImpl: dom.window.document,
      renderMarkdown: (text) => text,
      shouldFollow: () => false
    });
    expect(state.chatPreviewEl.classList.contains('done')).toBe(true);
    expect(state.chatPreviewEl.textContent.toLowerCase()).not.toContain('working');

    clearChatPreview(state);
    expect(dom.window.document.getElementById('chat-preview-stream')).toBe(null);
    expect(state.chatPreviewEl).toBe(null);
  });

  it('renders pending user message and working placeholder immediately', () => {
    const dom = new JSDOM('<body><div id="messages"></div></body>');
    const state = { chatPreviewEl: null, pendingUserEl: null };
    const forceFollowToBottom = vi.fn();

    expect(renderPendingChat('hello **pi**', state, {
      documentImpl: dom.window.document,
      renderMarkdown: (text) => `<p>${text}</p>`,
      shouldFollow: () => true,
      forceFollowToBottom
    })).toBe(true);

    expect(dom.window.document.getElementById('chat-pending-user')).toBeTruthy();
    expect(dom.window.document.getElementById('chat-pending-user').textContent).toContain('hello **pi**');
    expect(dom.window.document.getElementById('chat-preview-stream')).toBeTruthy();
    expect(dom.window.document.getElementById('chat-preview-stream').textContent.toLowerCase()).toContain('working');
    expect(forceFollowToBottom).toHaveBeenCalledWith(false);

    clearChatPreview(state);
    expect(dom.window.document.getElementById('chat-pending-user')).toBe(null);
    expect(dom.window.document.getElementById('chat-preview-stream')).toBe(null);
  });

  it('can finish a pending preview without removing assistant text', () => {
    const dom = new JSDOM('<body><div id="messages"></div></body>');
    const state = { chatPreviewEl: null, pendingUserEl: null };

    renderChatPreview({ content: 'final answer', done: false }, state, {
      documentImpl: dom.window.document,
      renderMarkdown: (text) => text,
    });

    expect(finishChatPreview(state)).toBe(true);
    expect(dom.window.document.getElementById('chat-preview-stream').textContent).toContain('final answer');
    expect(dom.window.document.getElementById('chat-preview-stream').textContent.toLowerCase()).not.toContain('working');
    expect(state.chatPreviewEl.classList.contains('done')).toBe(true);
  });

  it('clears pending user but keeps assistant preview when keepAssistant option is true', () => {
    const dom = new JSDOM('<body><div id="messages"></div></body>');
    const state = { chatPreviewEl: null, pendingUserEl: null };

    renderPendingChat('hello pi', state, {
      documentImpl: dom.window.document,
      renderMarkdown: (text) => text,
    });

    expect(dom.window.document.getElementById('chat-pending-user')).toBeTruthy();
    expect(dom.window.document.getElementById('chat-preview-stream')).toBeTruthy();

    clearChatPreview(state, { keepAssistant: true });
    // pending user element should be removed from the DOM and cleared
    expect(dom.window.document.getElementById('chat-pending-user')).toBeNull();
    expect(state.pendingUserEl).toBeNull();
    // assistant preview should still be in the DOM and NOT cleared
    expect(dom.window.document.getElementById('chat-preview-stream')).toBeTruthy();
    expect(state.chatPreviewEl).toBeTruthy();

    // And clearing it without keepAssistant removes it
    clearChatPreview(state, { keepAssistant: false });
    expect(dom.window.document.getElementById('chat-preview-stream')).toBeNull();
    expect(state.chatPreviewEl).toBeNull();
  });
});

