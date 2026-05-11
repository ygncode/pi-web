import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { runChatComposer } from './chat-composer-runner.js';

describe('chat composer runner', () => {
  it('returns without composer form', () => {
    const dom = new JSDOM('<body></body>');
    expect(() => runChatComposer({ documentImpl: dom.window.document, windowImpl: dom.window, chatApi: {}, chatSelectors: {}, modelSelector: {}, thinkingSelector: {} })).not.toThrow();
  });

  it('marks unavailable composer', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="false" data-chat-disabled-reason="no cwd"></form><span id="pi-chat-status"></span></body>');
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: {},
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: {},
      thinkingSelector: {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    expect(dom.window.document.getElementById('pi-chat-status').textContent).toBe('unavailable');
    expect(dom.window.document.getElementById('pi-chat-composer').title).toBe('no cwd');
  });

  it('passes escapeHtml into model selector setup', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span></form></body>');
    const setupModelSelector = vi.fn();
    const escapeHtml = vi.fn((text) => String(text));
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      escapeHtml,
      chatApi: { getWorkerStatus: () => Promise.resolve(new Response('{}', { status: 500 })) },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: { setupModelSelector },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    expect(setupModelSelector.mock.calls[0][0].escapeHtml).toBe(escapeHtml);
  });

  it('navigates initial session leaf', () => {
    const dom = new JSDOM('<body></body>');
    const navigateTo = vi.fn();
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      localEntries: [{ id: 'last' }],
      leafId: 'leaf',
      urlTargetId: 'target',
      byId: new Map([['target', {}]]),
      navigateTo,
      chatApi: {},
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: {},
      thinkingSelector: {}
    });
    expect(navigateTo).toHaveBeenCalledWith('leaf', 'target', 'target');
  });
});
