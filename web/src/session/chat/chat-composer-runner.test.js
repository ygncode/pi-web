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

  it('adds a text attachment from pi-chat-attach-text and folds it into the sent message', async () => {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><div class="pi-chat-shell"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span></div><div id="pi-chat-attachment-modal" hidden><pre class="pi-chat-attachment-card-quote"></pre><div class="pi-chat-attachment-card-note" hidden></div><button type="button" data-action="close-attachment"></button></div></form></body>');
    const sendChat = vi.fn(() => Promise.resolve(new Response('{"status":"queued"}', { status: 200 })));
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: { getWorkerStatus: () => Promise.resolve(new Response('{}', { status: 500 })), sendChat },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: { setupModelSelector: vi.fn() },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      FormDataImpl: dom.window.FormData,
      CustomEventImpl: dom.window.CustomEvent,
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    dom.window.dispatchEvent(new dom.window.CustomEvent('pi-chat-attach-text', {
      detail: { original: 'hello world', note: 'rename this' }
    }));

    // A clickable text chip appears and enables Send even with an empty textarea.
    const chip = dom.window.document.querySelector('.pi-chat-attachment-text');
    expect(chip).toBeTruthy();
    expect(dom.window.document.getElementById('pi-chat-send').disabled).toBe(false);

    // Clicking the chip opens the viewer showing the original selection.
    chip.click();
    expect(dom.window.document.getElementById('pi-chat-attachment-modal').hidden).toBe(false);
    expect(dom.window.document.querySelector('.pi-chat-attachment-card-quote').textContent).toBe('hello world');
    dom.window.document.querySelector('[data-action="close-attachment"]').click();
    expect(dom.window.document.getElementById('pi-chat-attachment-modal').hidden).toBe(true);

    // Submitting folds the selection (as a blockquote + note) before the typed text.
    dom.window.document.getElementById('pi-chat-message').value = 'please fix';
    dom.window.document.getElementById('pi-chat-composer')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();

    expect(sendChat).toHaveBeenCalled();
    expect(sendChat.mock.calls[0][1].get('message')).toBe('> hello world\n\nrename this\n\nplease fix');
    // Attachments clear after a successful send.
    expect(dom.window.document.querySelector('.pi-chat-attachment-text')).toBeNull();
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

  it('updates circular context usage based on entries and active model', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span><button id="pi-chat-model-label"></button><div id="pi-chat-context-usage" style="display:none"><svg class="pi-context-circle"><path class="pi-context-fill" stroke-dasharray="0, 100"></path></svg><span class="pi-context-text">0%</span></div></form></body>');
    const mockEntries = [
      {
        type: 'message',
        message: {
          role: 'assistant',
          usage: {
            input: 8000,
            output: 2000,
            cacheRead: 0,
            cacheWrite: 0
          }
        }
      }
    ];
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      localEntries: mockEntries,
      chatApi: {
        getWorkerStatus: () => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            state: 'idle',
            model: 'gpt-4o',
            modelProvider: 'openai'
          })
        })
      },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: {
        setupModelSelector: vi.fn((opts) => {
          opts.setKnownModelLabel('gpt-4o @ openai');
          return { open: vi.fn() };
        })
      },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    // Check if the container is visible and displays correct percentage
    const el = dom.window.document.getElementById('pi-chat-context-usage');
    expect(el.style.display).not.toBe('none');
    const text = el.querySelector('.pi-context-text');
    expect(text.textContent).toBe('8%'); // 10000 / 128000 = 7.8% => 8%

    const fill = el.querySelector('.pi-context-fill');
    expect(fill.getAttribute('stroke-dasharray')).toBe('8, 100');
  });

  it('toggles detailed context usage popover and formats values correctly', () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><div class="pi-chat-shell"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span><button id="pi-chat-model-label"></button><div id="pi-chat-context-usage" style="display:none"><svg class="pi-context-circle"><path class="pi-context-fill" stroke-dasharray="0, 100"></path></svg><span class="pi-context-text">0%</span></div><div id="pi-chat-context-popover" style="display:none"><div class="pi-popover-arrow"></div><span class="pi-popover-used"></span><span class="pi-popover-limit"></span><div class="pi-popover-progress-bar"></div><span id="pi-popover-val-input"></span><span id="pi-popover-val-cache-read"></span><span id="pi-popover-val-cache-write"></span><span id="pi-popover-val-output"></span><span id="pi-popover-val-total"></span></div></div></form></body>');
    const mockEntries = [
      {
        type: 'message',
        message: {
          role: 'assistant',
          usage: {
            input: 11200,
            output: 1000,
            cacheRead: 5400,
            cacheWrite: 0
          }
        }
      }
    ];
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      localEntries: mockEntries,
      chatApi: {
        getWorkerStatus: () => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            state: 'idle',
            model: 'gemini-1.5-flash',
            modelProvider: 'google'
          })
        })
      },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: {
        setupModelSelector: vi.fn((opts) => {
          opts.setKnownModelLabel('gemini-1.5-flash @ google');
          return { open: vi.fn() };
        })
      },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const el = dom.window.document.getElementById('pi-chat-context-usage');
    const popover = dom.window.document.getElementById('pi-chat-context-popover');
    expect(popover.style.display).toBe('none');

    // Click capsule to open
    el.click();
    expect(popover.style.display).toBe('block');

    // Verify detailed values formatting
    expect(dom.window.document.getElementById('pi-popover-val-input').textContent).toBe('11.2k');
    expect(dom.window.document.getElementById('pi-popover-val-cache-read').textContent).toBe('5.4k');
    expect(dom.window.document.getElementById('pi-popover-val-cache-write').textContent).toBe('0');
    expect(dom.window.document.getElementById('pi-popover-val-output').textContent).toBe('1.0k');
    expect(dom.window.document.getElementById('pi-popover-val-total').textContent).toBe('17.6k');

    expect(popover.querySelector('.pi-popover-used').textContent).toBe('17.6k');
    expect(popover.querySelector('.pi-popover-limit').textContent).toBe('1.0M'); // gemini-1.5-flash is 1M limit
  });

  it('uses last assistant totalTokens for context window %, not cumulative I/O', () => {
    // Multi-turn: context % should use the LAST assistant's usage, not sum
    // across all turns (which double-counts overlapping cacheRead values).
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span><button id="pi-chat-model-label"></button><div id="pi-chat-context-usage" style="display:none"><svg class="pi-context-circle"><path class="pi-context-fill" stroke-dasharray="0, 100"></path></svg><span class="pi-context-text">0%</span></div><div id="pi-chat-context-popover" style="display:none"><div class="pi-popover-arrow"></div><span class="pi-popover-used"></span><span class="pi-popover-limit"></span><div class="pi-popover-progress-bar"></div><span id="pi-popover-val-input"></span><span id="pi-popover-val-cache-read"></span><span id="pi-popover-val-cache-write"></span><span id="pi-popover-val-output"></span><span id="pi-popover-val-total"></span></div></form></body>');
    const mockEntries = [
      // Turn 1: assistant processes initial prompt (1000 new tokens, cached)
      {
        type: 'message',
        message: {
          role: 'assistant',
          usage: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 1000 }
        }
      },
      // Turn 2: user message (no usage)
      {
        type: 'message',
        message: { role: 'user', content: 'follow-up' }
      },
      // Turn 3: assistant reuses 1000 cached tokens + 500 new input
      // Old bug: cumulative = (1000+500)+(500+300)+(0+1000) = 3300 → 3% (wrong!)
      // New: contextTokens = last assistant = 500+300+1000 = 1800 → 1%
      {
        type: 'message',
        message: {
          role: 'assistant',
          usage: { input: 500, output: 300, cacheRead: 1000, cacheWrite: 0 }
        }
      }
    ];
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      localEntries: mockEntries,
      chatApi: {
        getWorkerStatus: () => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            state: 'idle',
            model: 'gpt-4o',
            modelProvider: 'openai'
          })
        })
      },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: {
        setupModelSelector: vi.fn((opts) => {
          opts.setKnownModelLabel('gpt-4o @ openai');
          return { open: vi.fn() };
        })
      },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      setIntervalImpl: () => {}
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const el = dom.window.document.getElementById('pi-chat-context-usage');
    const popover = dom.window.document.getElementById('pi-chat-context-popover');

    // Context window % should use last assistant's usage, not cumulative
    const text = el.querySelector('.pi-context-text');
    // contextTokens = 500+300+1000 = 1800; 1800/128000*100 = 1.4% → 1%
    expect(text.textContent).toBe('1%');

    const fill = el.querySelector('.pi-context-fill');
    expect(fill.getAttribute('stroke-dasharray')).toBe('1, 100');

    // Cumulative I/O rows should still sum across all turns
    el.click();
    expect(popover.style.display).toBe('block');
    expect(dom.window.document.getElementById('pi-popover-val-input').textContent).toBe('1.5k'); // 1000+500
    expect(dom.window.document.getElementById('pi-popover-val-output').textContent).toBe('800'); // 500+300
    expect(dom.window.document.getElementById('pi-popover-val-cache-read').textContent).toBe('1.0k'); // 0+1000
    expect(dom.window.document.getElementById('pi-popover-val-cache-write').textContent).toBe('1.0k'); // 1000+0
    expect(dom.window.document.getElementById('pi-popover-val-total').textContent).toBe('4.3k'); // 1500+800+1000+1000

    // Popover hero shows contextTokens (last assistant, not cumulative)
    expect(popover.querySelector('.pi-popover-used').textContent).toBe('1.8k');
    expect(popover.querySelector('.pi-popover-limit').textContent).toBe('128k');
  });

  it('loads dynamic context limits from chatApi.listModels()', async () => {
    const dom = new JSDOM('<body><form id="pi-chat-composer" data-chat-available="true" data-session-id="s1"><textarea id="pi-chat-message"></textarea><input id="pi-chat-images"><button id="pi-chat-attach"></button><div id="pi-chat-attachments"></div><button id="pi-chat-send"></button><span id="pi-chat-status"></span><button id="pi-chat-model-label"></button><div id="pi-chat-context-usage" style="display:none"><svg class="pi-context-circle"><path class="pi-context-fill" stroke-dasharray="0, 100"></path></svg><span class="pi-context-text">0%</span></div><div id="pi-chat-context-popover" style="display:none"><span class="pi-popover-used"></span><span class="pi-popover-limit"></span><div class="pi-popover-progress-bar"></div></div></form></body>');
    const mockEntries = [
      {
        type: 'message',
        message: {
          role: 'assistant',
          usage: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0 }
        }
      }
    ];

    const listModelsMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        models: [
          { id: 'DEEPSEEK-V4-PRO', provider: 'DEEPSEEK', contextWindow: 1234567 }
        ]
      })
    }));

    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      localEntries: mockEntries,
      chatApi: {
        getWorkerStatus: () => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            state: 'idle',
            model: 'DEEPSEEK-V4-PRO',
            modelProvider: 'DEEPSEEK'
          })
        }),
        listModels: listModelsMock
      },
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: {
        setupModelSelector: vi.fn((opts) => {
          opts.setKnownModelLabel('DEEPSEEK-V4-PRO @ DEEPSEEK');
          return { open: vi.fn() };
        })
      },
      thinkingSelector: { setupThinkingLevelSelector: vi.fn() },
      setIntervalImpl: () => {}
    });

    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    // Wait for the async listModels promise and status checks to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    const popover = dom.window.document.getElementById('pi-chat-context-popover');
    expect(popover.querySelector('.pi-popover-limit').textContent).toBe('1.2M'); // 1,234,567 formats to 1.2M
  });
});
