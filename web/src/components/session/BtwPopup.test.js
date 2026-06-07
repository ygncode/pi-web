import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup } from '@testing-library/svelte';
import BtwPopup from './BtwPopup.svelte';

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    FakeEventSource.instances.push(this);
  }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  emit(type, data) {
    if (type === 'message' && this.onmessage) this.onmessage({ data });
    else if (this.listeners[type]) this.listeners[type]({ data });
  }
  close() { this.closed = true; }
}
FakeEventSource.instances = [];

const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => {
  for (let i = 0; i < 5; i++) { await flush(); await tick(); }
};

// A fetch router that covers every endpoint the popup touches.
function router(overrides = {}) {
  return vi.fn((url, opts) => {
    const json = (body, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });
    if (url.startsWith('/api/btw/new')) return json(overrides.new || { id: 'new-sess.jsonl' });
    if (url.startsWith('/api/btw')) return json(overrides.btw || { sessionId: '' });
    if (url.startsWith('/api/worker-status')) return json(overrides.status || { state: 'idle' });
    if (url.startsWith('/api/session')) return json(overrides.session || { entries: [] });
    if (url.startsWith('/api/chat/cancel')) return json({ ok: true });
    if (url.startsWith('/api/chat')) { (overrides.sent || []).push(url); return json({ status: 'queued' }); }
    return json({});
  });
}

function setupEnv({ fetchImpl, mobile = false, button = true, composer = false } = {}) {
  if (button) {
    const b = document.createElement('button');
    b.id = 'pi-btw-button';
    b.textContent = 'btw';
    document.body.appendChild(b);
  }
  if (composer) {
    const ta = document.createElement('textarea');
    ta.id = 'pi-chat-message';
    document.body.appendChild(ta);
  }
  window.fetch = fetchImpl || router();
  window.EventSource = FakeEventSource;
  window.ResizeObserver = class { observe() {} disconnect() {} };
  if (mobile) window.matchMedia = () => ({ matches: true });
  else delete window.matchMedia;
}

beforeEach(() => {
  FakeEventSource.instances = [];
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  delete window.matchMedia;
});

describe('BtwPopup', () => {
  it('stays hidden when the trigger button is absent', async () => {
    setupEnv({ button: false });
    render(BtwPopup);
    await settle();
    expect(document.querySelector('.pi-btw-window').hidden).toBe(true);
  });

  it('builds the window with new + close + input on open', async () => {
    const fetchImpl = router();
    setupEnv({ fetchImpl });
    render(BtwPopup);

    document.getElementById('pi-btw-button').click();
    await settle();

    const w = document.querySelector('.pi-btw-window');
    expect(w.hidden).toBe(false);
    expect(w.querySelector('.pi-btw-new')).not.toBeNull();
    expect(w.querySelector('.pi-btw-close')).not.toBeNull();
    expect(w.querySelector('#pi-btw-input')).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith('/api/btw?parent=__global__');
  });

  it('renders the transcript as markdown', async () => {
    const fetchImpl = router({
      btw: { sessionId: 'sess-1.jsonl' },
      session: {
        entries: [
          { id: 'a', type: 'message', message: { role: 'user', content: 'hi' } },
          { id: 'b', type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: '**bold** answer' }] } },
        ],
      },
    });
    setupEnv({ fetchImpl });
    render(BtwPopup);

    document.getElementById('pi-btw-button').click();
    await settle();

    const msgs = document.querySelectorAll('.pi-btw-msg');
    expect(msgs.length).toBe(2);
    expect(msgs[0].textContent.trim()).toBe('hi');
    expect(msgs[1].querySelector('strong')).not.toBeNull();
    expect(msgs[1].textContent).toContain('bold');
  });

  it('renders tool calls as chips', async () => {
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
    setupEnv({ fetchImpl });
    render(BtwPopup);

    document.getElementById('pi-btw-button').click();
    await settle();

    const tool = document.querySelector('.pi-btw-tool');
    expect(tool).not.toBeNull();
    expect(tool.textContent).toContain('read');
  });

  it('creates a session then sends when none exists yet, passing cwd + parent', async () => {
    const sent = [];
    const fetchImpl = router({ new: { id: 'new-sess.jsonl' }, sent });
    setupEnv({ fetchImpl });
    render(BtwPopup, { props: { cwd: '/repo/foo', parentId: 'parent-1.jsonl' } });

    document.getElementById('pi-btw-button').click();
    await settle();

    document.getElementById('pi-btw-input').value = 'do a thing';
    document.getElementById('pi-btw-form').dispatchEvent(new Event('submit'));
    await settle();

    const call = fetchImpl.mock.calls.find((c) => String(c[0]).startsWith('/api/btw/new'));
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body)).toEqual({ path: '/repo/foo', parent: 'parent-1.jsonl' });
    expect(sent[0]).toContain('new-sess.jsonl');
    expect(document.querySelector('.pi-btw-msg.user')).not.toBeNull();
  });

  it('new button is lazy: clears the window without creating a session', async () => {
    const fetchImpl = router({ btw: { sessionId: 'sess-1.jsonl' } });
    setupEnv({ fetchImpl });
    render(BtwPopup);

    document.getElementById('pi-btw-button').click();
    await settle();
    document.querySelector('.pi-btw-new').click();
    await settle();

    expect(fetchImpl.mock.calls.some((c) => String(c[0]).startsWith('/api/btw/new'))).toBe(false);
    expect(document.querySelector('.pi-btw-empty')).not.toBeNull();
  });

  it('shows a working indicator and toggles the send button to cancel while running', async () => {
    const fetchImpl = router({ btw: { sessionId: 'sess-1.jsonl' } });
    setupEnv({ fetchImpl });
    render(BtwPopup);

    document.getElementById('pi-btw-button').click();
    await settle();

    document.getElementById('pi-btw-input').value = 'go';
    document.getElementById('pi-btw-form').dispatchEvent(new Event('submit'));
    await settle();

    const send = document.getElementById('pi-btw-send');
    expect(send.classList.contains('cancel')).toBe(true);
    expect(document.querySelector('.pi-btw-msg.working')).not.toBeNull();

    send.click();
    await settle();
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).startsWith('/api/chat/cancel'))).toBe(true);
  });

  it('renders streaming assistant text from chat-preview events', async () => {
    const fetchImpl = router({ btw: { sessionId: 'sess-1.jsonl' } });
    setupEnv({ fetchImpl });
    render(BtwPopup);

    document.getElementById('pi-btw-button').click();
    await settle();

    const es = FakeEventSource.instances.find((e) => e.url.includes('sess-1.jsonl'));
    es.emit('chat-preview', JSON.stringify({ content: 'partial answer', done: false }));
    await settle();

    const streaming = document.querySelector('.pi-btw-msg.assistant.working .pi-btw-md');
    expect(streaming).not.toBeNull();
    expect(streaming.textContent).toContain('partial answer');
  });

  it('switches session in realtime on a per-parent btw-changed event', async () => {
    const fetchImpl = router({ btw: { sessionId: 'sess-1.jsonl' } });
    setupEnv({ fetchImpl });
    render(BtwPopup, { props: { parentId: 'parent-1.jsonl' } });

    document.getElementById('pi-btw-button').click();
    await settle();

    const globalES = FakeEventSource.instances.find((e) => e.url.includes('parent-1.jsonl'));
    expect(globalES).toBeTruthy();
    globalES.emit('btw-changed', JSON.stringify({ sessionId: 'sess-2.jsonl' }));
    await settle();

    expect(FakeEventSource.instances.some((e) => e.url.includes('sess-2.jsonl'))).toBe(true);
  });

  it('closes when the main composer is focused on mobile', async () => {
    setupEnv({ mobile: true, composer: true });
    render(BtwPopup);

    document.getElementById('pi-btw-button').click();
    await settle();
    expect(document.querySelector('.pi-btw-window').hidden).toBe(false);

    document.getElementById('pi-chat-message').dispatchEvent(new FocusEvent('focus'));
    await tick();
    expect(document.querySelector('.pi-btw-window').hidden).toBe(true);
  });

  it('does not auto-reopen on mobile even if it was open before', async () => {
    localStorage.setItem('pi-btw:window', JSON.stringify({ open: true }));
    setupEnv({ mobile: true });
    render(BtwPopup);
    await settle();
    expect(document.querySelector('.pi-btw-window').hidden).toBe(true);
  });

  it('toggles closed on a second button click', async () => {
    setupEnv();
    render(BtwPopup);
    const btn = document.getElementById('pi-btw-button');

    btn.click();
    await settle();
    btn.click();
    await tick();

    expect(document.querySelector('.pi-btw-window').hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });
});
