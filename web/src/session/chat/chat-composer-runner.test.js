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

  it('refreshes worker status immediately when pi-session-reload fires', async () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><div class="pi-chat-shell"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-cancel" style="display:none"></button><button id="pi-chat-send"></button><span id="pi-chat-status"></span><button id="pi-chat-model-label" style="display:none"></button><button id="pi-chat-thinking-label" style="display:none"></button></div></form></body>');
    const getWorkerStatus = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ state: 'idle' }), { status: 200 })));
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: { getWorkerStatus, cancelChat: vi.fn() },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: { setupModelSelector: vi.fn() },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      setIntervalImpl: () => {}
    });
    // JSDOM document is already "complete", so init ran synchronously above.
    // Wait for the initial refresh promise to settle.
    await new Promise((r) => setTimeout(r, 0));
    const initialCalls = getWorkerStatus.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);
    dom.window.dispatchEvent(new dom.window.Event('pi-session-reload'));
    await new Promise((r) => setTimeout(r, 0));
    expect(getWorkerStatus.mock.calls.length).toBe(initialCalls + 1);
  });

  it('toggles composer expanded state and persists per session', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="abc"><div class="pi-chat-shell"><textarea id="pi-chat-message"></textarea><div id="pi-chat-attachments"></div><input id="pi-chat-images"><button id="pi-chat-attach"></button><button id="pi-chat-expand" aria-pressed="false"></button><button id="pi-chat-send"></button><span id="pi-chat-status"></span></div></form></body>');
    const storage = new Map();
    Object.defineProperty(dom.window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k) => (storage.has(k) ? storage.get(k) : null),
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k)
      }
    });
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

    const shell = dom.window.document.querySelector('.pi-chat-shell');
    const btn = dom.window.document.getElementById('pi-chat-expand');
    expect(shell.classList.contains('expanded')).toBe(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    btn.click();
    expect(shell.classList.contains('expanded')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Collapse composer');
    expect(storage.get('pi-chat:composer-expanded:abc')).toBe('1');

    btn.click();
    expect(shell.classList.contains('expanded')).toBe(false);
    expect(storage.get('pi-chat:composer-expanded:abc')).toBe('0');
  });

  it('restores composer expanded state from localStorage', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="abc"><div class="pi-chat-shell"><textarea id="pi-chat-message"></textarea><div id="pi-chat-attachments"></div><input id="pi-chat-images"><button id="pi-chat-attach"></button><button id="pi-chat-expand" aria-pressed="false"></button><button id="pi-chat-send"></button><span id="pi-chat-status"></span></div></form></body>');
    const storage = new Map([['pi-chat:composer-expanded:abc', '1']]);
    Object.defineProperty(dom.window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k) => (storage.has(k) ? storage.get(k) : null),
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k)
      }
    });
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

    const shell = dom.window.document.querySelector('.pi-chat-shell');
    const btn = dom.window.document.getElementById('pi-chat-expand');
    expect(shell.classList.contains('expanded')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
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

    dom.window.URL.createObjectURL = vi.fn(() => 'blob:preview');
    const textarea = dom.window.document.getElementById('pi-chat-message');
    const file = new dom.window.File(['blob'], 'screenshot.png', { type: 'image/png' });
    const pasteEvent = new dom.window.Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { files: [file], items: [] }
    });
    textarea.dispatchEvent(pasteEvent);

    const attachment = dom.window.document.getElementById('pi-chat-attachments').firstElementChild;
    expect(attachment).toBeTruthy();
    expect(attachment.classList.contains('image-only')).toBe(true);
    expect(attachment.querySelector('.pi-chat-attachment-preview')).toBeTruthy();
    expect(attachment.querySelector('.pi-chat-attachment-name')).toBe(null);
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

  it('focuses the message textarea on page load', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span></form></body>');
    const textarea = dom.window.document.getElementById('pi-chat-message');
    const focusSpy = vi.spyOn(textarea, 'focus');

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

    expect(focusSpy).toHaveBeenCalled();
  });

  it('Shift+Tab in the textarea cycles thinking level', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span></form></body>');
    const cycle = vi.fn();

    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: { getWorkerStatus: () => Promise.resolve(new Response('{}', { status: 500 })) },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: { setupModelSelector: vi.fn(() => ({ open: vi.fn() })) },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn(() => ({ cycle })) },
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const event = new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    dom.window.document.getElementById('pi-chat-message').dispatchEvent(event);

    expect(cycle).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Ctrl+L in the textarea opens the model selector', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span></form></body>');
    const open = vi.fn();

    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: { getWorkerStatus: () => Promise.resolve(new Response('{}', { status: 500 })) },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: { setupModelSelector: vi.fn(() => ({ open })) },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn(() => ({ cycle: vi.fn() })) },
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const event = new dom.window.KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true, cancelable: true });
    dom.window.document.getElementById('pi-chat-message').dispatchEvent(event);

    expect(open).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  describe('AskUserQuestion multiSelect', () => {
    it('toggles selection on multi-select option click instead of sending immediately', () => {
      const html = `
        <div class="ask-question-card" data-question-count="1">
          <div class="ask-question-block" data-question-text="Pick many" data-multiple="true">
            <div class="ask-question-options">
              <button class="ask-question-option ask-question-option-action ask-question-multiselect" type="button" data-question="Pick many" data-answer="A">A</button>
              <button class="ask-question-option ask-question-option-action ask-question-multiselect" type="button" data-question="Pick many" data-answer="B">B</button>
            </div>
          </div>
          <div class="ask-question-actions" style="display:none"><button type="button" class="ask-question-submit-btn">Send answers</button></div>
        </div>
        <form id="pi-chat-composer" data-chat-available="true" data-session-id="s1">
          <div class="pi-chat-shell">
            <textarea id="pi-chat-message"></textarea>
            <input id="pi-chat-images"><button id="pi-chat-attach"></button>
            <div id="pi-chat-attachments"></div>
            <button id="pi-chat-cancel" style="display:none"></button>
            <button id="pi-chat-send"></button><span id="pi-chat-status"></span>
          </div>
        </form>`;
      const dom = new JSDOM(html, { url: 'https://example.test' });
      const sendChat = vi.fn(async () => new Response(JSON.stringify({ status: 'queued' }), { status: 200 }));
      runChatComposer({
        documentImpl: dom.window.document,
        windowImpl: dom.window,
        chatApi: { getWorkerStatus: () => Promise.resolve(new Response('{}', { status: 500 })), cancelChat: vi.fn(), sendChat },
        chatSelectors: { THINKING_LEVELS: [] },
        modelSelector: { setupModelSelector: vi.fn() },
        thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
        setIntervalImpl: () => {}
      });
      dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
      const optA = dom.window.document.querySelector('[data-answer="A"]');
      optA.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      expect(sendChat).not.toHaveBeenCalled();
      expect(optA.classList.contains('selected')).toBe(true);
      optA.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      expect(optA.classList.contains('selected')).toBe(false);
    });

    it('collects multi-select answers with comma-separated values', async () => {
      const html = `
        <div class="ask-question-card" data-question-count="1">
          <div class="ask-question-block" data-question-text="Pick many" data-multiple="true">
            <div class="ask-question-options">
              <button class="ask-question-option ask-question-option-action ask-question-multiselect selected" type="button" data-question="Pick many" data-answer="React">React</button>
              <button class="ask-question-option ask-question-option-action ask-question-multiselect selected" type="button" data-question="Pick many" data-answer="Vue">Vue</button>
              <button class="ask-question-option ask-question-option-action ask-question-multiselect" type="button" data-question="Pick many" data-answer="Svelte">Svelte</button>
            </div>
          </div>
          <div class="ask-question-actions"><button type="button" class="ask-question-submit-btn">Send answers</button></div>
        </div>
        <form id="pi-chat-composer" data-chat-available="true" data-session-id="s1">
          <div class="pi-chat-shell">
            <textarea id="pi-chat-message"></textarea>
            <input id="pi-chat-images"><button id="pi-chat-attach"></button>
            <div id="pi-chat-attachments"></div>
            <button id="pi-chat-cancel" style="display:none"></button>
            <button id="pi-chat-send"></button><span id="pi-chat-status"></span>
          </div>
        </form>`;
      const dom = new JSDOM(html, { url: 'https://example.test' });
      const sendChat = vi.fn(async () => new Response(JSON.stringify({ status: 'queued' }), { status: 200 }));
      runChatComposer({
        documentImpl: dom.window.document,
        windowImpl: dom.window,
        chatApi: { getWorkerStatus: () => Promise.resolve(new Response('{}', { status: 500 })), cancelChat: vi.fn(), sendChat },
        chatSelectors: { THINKING_LEVELS: [] },
        modelSelector: { setupModelSelector: vi.fn() },
        thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
        setIntervalImpl: () => {}
      });
      dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
      const submitBtn = dom.window.document.querySelector('.ask-question-submit-btn');
      submitBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      // Allow async sendChatMessage to resolve
      await new Promise(r => setTimeout(r, 0));
      expect(sendChat).toHaveBeenCalledTimes(1);
      const call = sendChat.mock.calls[0];
      expect(call[0]).toBe('s1'); // sessionId
      const body = call[1]; // FormData
      expect(body.get('message')).toBe('"Pick many" = "React, Vue"');
    });
  });
});
