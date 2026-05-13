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

  it('attaches pasted image from clipboard', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span></form></body>');
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: { getWorkerStatus: () => Promise.resolve(new Response('{}', { status: 500 })) },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: { setupModelSelector: vi.fn() },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const textarea = dom.window.document.getElementById('pi-chat-message');
    const file = new dom.window.File(['blob'], 'screenshot.png', { type: 'image/png' });
    const pasteEvent = new dom.window.Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { files: [file], items: [] }
    });
    textarea.dispatchEvent(pasteEvent);

    expect(dom.window.document.getElementById('pi-chat-attachments').children.length).toBe(1);
    expect(pasteEvent.defaultPrevented).toBe(true);
  });

  it('ignores non-image paste', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span></form></body>');
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: { getWorkerStatus: () => Promise.resolve(new Response('{}', { status: 500 })) },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: { setupModelSelector: vi.fn() },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const textarea = dom.window.document.getElementById('pi-chat-message');
    const file = new dom.window.File(['text'], 'notes.txt', { type: 'text/plain' });
    const pasteEvent = new dom.window.Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { files: [file], items: [] }
    });
    textarea.dispatchEvent(pasteEvent);

    expect(dom.window.document.getElementById('pi-chat-attachments').children.length).toBe(0);
    expect(pasteEvent.defaultPrevented).toBe(false);
  });

  it('deduplicates pasted images', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span></form></body>');
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: { getWorkerStatus: () => Promise.resolve(new Response('{}', { status: 500 })) },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: { setupModelSelector: vi.fn() },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const textarea = dom.window.document.getElementById('pi-chat-message');
    const file = new dom.window.File(['blob'], 'dup.png', { type: 'image/png' });
    const pasteEvent = new dom.window.Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { files: [file, file], items: [] }
    });
    textarea.dispatchEvent(pasteEvent);

    expect(dom.window.document.getElementById('pi-chat-attachments').children.length).toBe(1);
  });
});
