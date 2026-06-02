import { describe, expect, it, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupBtwPopup } from './btw-popup.js';

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    FakeEventSource.instances.push(this);
  }
  addEventListener(type, fn) {
    this.listeners[type] = fn;
  }
  emit(type, data) {
    if (type === 'message' && this.onmessage) this.onmessage({ data });
    else if (this.listeners[type]) this.listeners[type]({ data });
  }
  close() {
    this.closed = true;
  }
}
FakeEventSource.instances = [];

function makeEnv() {
  const dom = new JSDOM('<body><button id="pi-btw-button">btw</button></body>', { url: 'http://localhost/' });
  const win = dom.window;
  win.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  FakeEventSource.instances = [];
  return { dom, win, doc: win.document };
}

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

// A fetch router that covers every endpoint the popup touches.
function router(overrides = {}) {
  return vi.fn((url, opts) => {
    if (url.startsWith('/api/btw/new')) return jsonResponse(overrides.new || { id: 'new-sess.jsonl' });
    if (url.startsWith('/api/btw')) return jsonResponse(overrides.btw || { sessionId: '' });
    if (url.startsWith('/api/worker-status')) return jsonResponse(overrides.status || { state: 'idle' });
    if (url.startsWith('/api/session')) return jsonResponse(overrides.session || { entries: [] });
    if (url.startsWith('/api/chat/cancel')) return jsonResponse({ ok: true });
    if (url.startsWith('/api/chat')) {
      (overrides.sent || []).push(url);
      return jsonResponse({ status: 'queued' });
    }
    return jsonResponse({});
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('btw popup', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
  });

  it('returns null when the button is missing', () => {
    const dom = new JSDOM('<body></body>');
    const result = setupBtwPopup({ documentImpl: dom.window.document, windowImpl: dom.window });
    expect(result).toBeNull();
  });

  it('builds the window with new + close + input on first open', async () => {
    const { win, doc } = makeEnv();
    const fetchImpl = router();
    const api = setupBtwPopup({ documentImpl: doc, windowImpl: win, fetchImpl, EventSourceImpl: FakeEventSource });

    doc.getElementById('pi-btw-button').click();
    await flush();

    const w = doc.querySelector('.pi-btw-window');
    expect(w).not.toBeNull();
    expect(w.hidden).toBe(false);
    expect(w.querySelector('.pi-btw-new')).not.toBeNull();
    expect(w.querySelector('.pi-btw-close')).not.toBeNull();
    expect(w.querySelector('#pi-btw-input')).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith('/api/btw?parent=__global__');
    api.close();
  });

  it('renders the transcript as markdown', async () => {
    const { win, doc } = makeEnv();
    const fetchImpl = router({
      btw: { sessionId: 'sess-1.jsonl' },
      session: {
        entries: [
          { id: 'a', type: 'message', message: { role: 'user', content: 'hi' } },
          { id: 'b', type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: '**bold** answer' }] } },
        ],
      },
    });
    const api = setupBtwPopup({ documentImpl: doc, windowImpl: win, fetchImpl, EventSourceImpl: FakeEventSource });

    doc.getElementById('pi-btw-button').click();
    await flush();

    const msgs = doc.querySelectorAll('.pi-btw-msg');
    expect(msgs.length).toBe(2);
    expect(msgs[0].textContent.trim()).toBe('hi');
    // Markdown emphasis becomes a <strong>.
    expect(msgs[1].querySelector('strong')).not.toBeNull();
    expect(msgs[1].textContent).toContain('bold');
    api.close();
  });

  it('renders tool calls as chips', async () => {
    const { win, doc } = makeEnv();
    const fetchImpl = router({
      btw: { sessionId: 'sess-1.jsonl' },
      session: {
        entries: [
          {
            id: 'a',
            type: 'message',
            message: {
              role: 'assistant',
              content: [
                { type: 'text', text: 'reading' },
                { type: 'toolCall', id: 't1', name: 'read', arguments: { path: '/repo/foo.go' } },
              ],
            },
          },
        ],
      },
    });
    const api = setupBtwPopup({ documentImpl: doc, windowImpl: win, fetchImpl, EventSourceImpl: FakeEventSource });

    doc.getElementById('pi-btw-button').click();
    await flush();

    const tool = doc.querySelector('.pi-btw-tool');
    expect(tool).not.toBeNull();
    expect(tool.textContent).toContain('read');
    api.close();
  });

  it('creates a session then sends when none exists yet, passing cwd + parent', async () => {
    const { win, doc } = makeEnv();
    const sent = [];
    const fetchImpl = router({ new: { id: 'new-sess.jsonl' }, sent });
    const api = setupBtwPopup({
      documentImpl: doc,
      windowImpl: win,
      fetchImpl,
      EventSourceImpl: FakeEventSource,
      cwd: '/repo/foo',
      parentId: 'parent-1.jsonl',
    });

    doc.getElementById('pi-btw-button').click();
    await flush();

    doc.getElementById('pi-btw-input').value = 'do a thing';
    doc.getElementById('pi-btw-form').dispatchEvent(new win.Event('submit'));
    await flush();

    const call = fetchImpl.mock.calls.find((c) => String(c[0]).startsWith('/api/btw/new'));
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body)).toEqual({ path: '/repo/foo', parent: 'parent-1.jsonl' });
    expect(sent[0]).toContain('new-sess.jsonl');
    expect(doc.querySelector('.pi-btw-msg.user')).not.toBeNull();
    api.close();
  });

  it('new button is lazy: clears the window without creating a session', async () => {
    const { win, doc } = makeEnv();
    const fetchImpl = router({ btw: { sessionId: 'sess-1.jsonl' } });
    const api = setupBtwPopup({ documentImpl: doc, windowImpl: win, fetchImpl, EventSourceImpl: FakeEventSource });

    doc.getElementById('pi-btw-button').click();
    await flush();
    doc.querySelector('.pi-btw-new').click();
    await flush();

    // No session file is created until the first message is sent.
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).startsWith('/api/btw/new'))).toBe(false);
    // The window resets to its empty prompt state.
    expect(doc.querySelector('.pi-btw-empty')).not.toBeNull();
    api.close();
  });

  it('shows a working indicator and toggles the send button to cancel while running', async () => {
    const { win, doc } = makeEnv();
    const fetchImpl = router({ btw: { sessionId: 'sess-1.jsonl' } });
    const api = setupBtwPopup({ documentImpl: doc, windowImpl: win, fetchImpl, EventSourceImpl: FakeEventSource });

    doc.getElementById('pi-btw-button').click();
    await flush();

    doc.getElementById('pi-btw-input').value = 'go';
    doc.getElementById('pi-btw-form').dispatchEvent(new win.Event('submit'));
    await flush();

    const send = doc.getElementById('pi-btw-send');
    expect(send.classList.contains('cancel')).toBe(true);
    expect(doc.querySelector('.pi-btw-msg.working')).not.toBeNull();

    // Clicking the cancel button cancels the running turn.
    send.click();
    await flush();
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).startsWith('/api/chat/cancel'))).toBe(true);
    api.close();
  });

  it('renders streaming assistant text from chat-preview events', async () => {
    const { win, doc } = makeEnv();
    const fetchImpl = router({ btw: { sessionId: 'sess-1.jsonl' } });
    const api = setupBtwPopup({ documentImpl: doc, windowImpl: win, fetchImpl, EventSourceImpl: FakeEventSource });

    doc.getElementById('pi-btw-button').click();
    await flush();

    const es = FakeEventSource.instances.find((e) => e.url.includes('sess-1.jsonl'));
    es.emit('chat-preview', JSON.stringify({ content: 'partial answer', done: false }));

    const streaming = doc.querySelector('.pi-btw-msg.assistant.working .pi-btw-md');
    expect(streaming).not.toBeNull();
    expect(streaming.textContent).toContain('partial answer');
    api.close();
  });

  it('switches session in realtime on a per-parent btw-changed event', async () => {
    const { win, doc } = makeEnv();
    const fetchImpl = router({ btw: { sessionId: 'sess-1.jsonl' } });
    const api = setupBtwPopup({
      documentImpl: doc,
      windowImpl: win,
      fetchImpl,
      EventSourceImpl: FakeEventSource,
      parentId: 'parent-1.jsonl',
    });

    doc.getElementById('pi-btw-button').click();
    await flush();

    const globalES = FakeEventSource.instances.find((e) => e.url.includes('parent-1.jsonl'));
    expect(globalES).toBeTruthy();
    globalES.emit('btw-changed', JSON.stringify({ sessionId: 'sess-2.jsonl' }));
    await flush();

    // It should now be subscribed to the new session's events.
    expect(FakeEventSource.instances.some((e) => e.url.includes('sess-2.jsonl'))).toBe(true);
    api.close();
  });

  it('closes when the main composer is focused on mobile', async () => {
    const dom = new JSDOM(
      '<body><button id="pi-btw-button">btw</button><textarea id="pi-chat-message"></textarea></body>',
      { url: 'http://localhost/' }
    );
    const win = dom.window;
    const doc = win.document;
    win.ResizeObserver = class { observe() {} disconnect() {} };
    win.matchMedia = () => ({ matches: true }); // simulate a touch device
    FakeEventSource.instances = [];
    const fetchImpl = router();
    setupBtwPopup({ documentImpl: doc, windowImpl: win, fetchImpl, EventSourceImpl: FakeEventSource });

    doc.getElementById('pi-btw-button').click();
    await flush();
    expect(doc.querySelector('.pi-btw-window').hidden).toBe(false);

    doc.getElementById('pi-chat-message').dispatchEvent(new win.FocusEvent('focus'));
    expect(doc.querySelector('.pi-btw-window').hidden).toBe(true);
  });

  it('does not auto-reopen on mobile even if it was open before', async () => {
    const dom = new JSDOM('<body><button id="pi-btw-button">btw</button></body>', { url: 'http://localhost/' });
    const win = dom.window;
    const doc = win.document;
    win.ResizeObserver = class { observe() {} disconnect() {} };
    win.matchMedia = () => ({ matches: true });
    win.localStorage.setItem('pi-btw:window', JSON.stringify({ open: true }));
    FakeEventSource.instances = [];
    setupBtwPopup({ documentImpl: doc, windowImpl: win, fetchImpl: router(), EventSourceImpl: FakeEventSource });

    // No window should have been built/opened on a touch device.
    expect(doc.querySelector('.pi-btw-window')).toBeNull();
  });

  it('toggles closed on a second button click', async () => {
    const { win, doc } = makeEnv();
    const fetchImpl = router();
    setupBtwPopup({ documentImpl: doc, windowImpl: win, fetchImpl, EventSourceImpl: FakeEventSource });
    const btn = doc.getElementById('pi-btw-button');

    btn.click();
    await flush();
    btn.click();

    expect(doc.querySelector('.pi-btw-window').hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });
});
