import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSteerQueue } from './steer-queue.js';
import { QueueStore } from './queue-store.svelte.js';

function makeDom() {
  document.body.innerHTML = `
    <button id="queue" type="button" disabled></button>
    <textarea id="textarea"></textarea>
  `;
  return {
    queueButton: document.getElementById('queue'),
    textarea: document.getElementById('textarea'),
  };
}

function makeApi(initial = { items: [], paused: false }) {
  let next = 1;
  const items = [...initial.items];
  let paused = !!initial.paused;
  return {
    list: vi.fn(async () => ({ items: [...items], paused })),
    add: vi.fn(async (message, displayText) => {
      const item = { sessionId: 'mock', position: next++, message, displayText };
      items.push(item);
      return item;
    }),
    remove: vi.fn(async (position) => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].position === position) {
          items.splice(i, 1);
          return;
        }
      }
    }),
    setPaused: vi.fn(async (value) => {
      paused = !!value;
    }),
  };
}

function type(textarea, value) {
  textarea.value = value;
  textarea.dispatchEvent(new Event('input'));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('setupSteerQueue (server-backed)', () => {
  it('queue button is disabled until the textarea has content', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    setupSteerQueue({ store, queueButton, textarea });

    expect(queueButton.disabled).toBe(true);
    type(textarea, 'hello');
    expect(queueButton.disabled).toBe(false);
  });

  it('clicking queue POSTs to the api and adds the new row to the store', async () => {
    const { queueButton, textarea } = makeDom();
    const api = makeApi();
    const store = new QueueStore({ api });
    setupSteerQueue({ store, queueButton, textarea, queueApi: api });

    type(textarea, 'hello');
    queueButton.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(api.add).toHaveBeenCalledWith('hello', 'hello');
    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toMatchObject({ kind: 'queued', text: 'hello' });
    expect(textarea.value).toBe('');
  });

  it('subsequent sends during an active run produce steer rows in the store', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    setupSteerQueue({ store, queueButton, textarea });

    // First send: run starts. No steer.
    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'first' } }));
    expect(store.steerCount).toBe(0);

    // Subsequent send: steer.
    window.dispatchEvent(
      new CustomEvent('pi-chat-message-sent', { detail: { message: 'steer-msg' } }),
    );
    expect(store.steerCount).toBe(1);
    expect(store.items[0].text).toBe('steer-msg');

    // Steer is removable without touching the api.
    store.removeById(store.items[0].id);
    expect(store.steerCount).toBe(0);
  });

  it('worker-done clears steer rows but does not auto-dispatch (server drainer handles that)', () => {
    const { queueButton, textarea } = makeDom();
    const api = makeApi();
    const store = new QueueStore({ api });
    const sendChatMessage = vi.fn(async () => true);
    setupSteerQueue({ store, queueButton, textarea, sendChatMessage, queueApi: api });

    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'first' } }));
    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'steer' } }));
    expect(store.steerCount).toBe(1);

    window.dispatchEvent(new Event('pi-worker-done'));
    expect(store.steerCount).toBe(0);
    // Frontend does NOT dispatch on its own — the server drainer is responsible.
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it('sendNow DELETEs the row server-side, then dispatches via sendChatMessage', async () => {
    const { queueButton, textarea } = makeDom();
    const api = makeApi();
    const store = new QueueStore({ api });
    const sendChatMessage = vi.fn(async () => true);
    const handle = setupSteerQueue({
      store,
      queueButton,
      textarea,
      sendChatMessage,
      queueApi: api,
    });

    type(textarea, 'queue-me');
    queueButton.click();
    // Wait for enqueue Promise + store update.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(store.queuedCount).toBe(1);

    const id = store.items[0].id;
    await handle.sendNow(id);

    expect(api.remove).toHaveBeenCalledWith(store.items[0]?.position ?? 1);
    expect(sendChatMessage).toHaveBeenCalledWith('queue-me', []);
    expect(store.queuedCount).toBe(0);
  });

  it('edit DELETEs the row server-side and pops the text back into the textarea', async () => {
    const { queueButton, textarea } = makeDom();
    const api = makeApi();
    const store = new QueueStore({ api });
    const handle = setupSteerQueue({ store, queueButton, textarea, queueApi: api });

    type(textarea, 'draft');
    queueButton.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(store.queuedCount).toBe(1);

    await handle.edit(store.items[0].id);
    expect(api.remove).toHaveBeenCalled();
    expect(textarea.value).toBe('draft');
    expect(store.queuedCount).toBe(0);
  });

  it('clears a steer chip when a matching user entry appears on session reload', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    const entries = [];
    setupSteerQueue({
      store,
      queueButton,
      textarea,
      getLiveEntries: () => entries,
    });

    // Start an active run, then a steer.
    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'first' } }));
    window.dispatchEvent(
      new CustomEvent('pi-chat-message-sent', { detail: { message: 'sorry, continue' } }),
    );
    expect(store.steerCount).toBe(1);

    // pi has now folded the steer in and the session JSONL has a user entry.
    entries.push({
      id: 'u1',
      type: 'message',
      message: { role: 'user', content: 'sorry, continue' },
    });
    window.dispatchEvent(new Event('pi-session-reload'));

    expect(store.steerCount).toBe(0);
  });

  it('FIFO-clears a steer chip when a new user entry lands but its text does not match', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    const entries = [];
    setupSteerQueue({
      store,
      queueButton,
      textarea,
      getLiveEntries: () => entries,
    });

    // Seed initial user-count baseline (so the listener doesn't fire on the
    // first reload thinking historical messages are fresh).
    window.dispatchEvent(new Event('pi-session-reload'));

    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'first' } }));
    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'steer' } }));
    expect(store.steerCount).toBe(1);

    // pi has folded the steer in but its stored content is decorated, so the
    // exact-text matcher misses. The FIFO fallback still pops the head steer.
    entries.push({
      id: 'u1',
      type: 'message',
      message: { role: 'user', content: '[steer] steer (with cwd context)' },
    });
    window.dispatchEvent(new Event('pi-session-reload'));

    expect(store.steerCount).toBe(0);
  });

  it('leaves the steer chip alone while no matching user entry has landed', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    const entries = [];
    setupSteerQueue({
      store,
      queueButton,
      textarea,
      getLiveEntries: () => entries,
    });

    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'task' } }));
    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'steer' } }));
    expect(store.steerCount).toBe(1);

    // Reload fires but the steer hasn't been picked up yet (no matching user entry).
    window.dispatchEvent(new Event('pi-session-reload'));
    expect(store.steerCount).toBe(1);
  });

  it('resume PATCHes paused=false through the api', async () => {
    const { queueButton, textarea } = makeDom();
    const api = makeApi();
    const store = new QueueStore({ api });
    const handle = setupSteerQueue({ store, queueButton, textarea, queueApi: api });
    await store.setPaused(true);
    api.setPaused.mockClear();
    await handle.resume();
    expect(api.setPaused).toHaveBeenCalledWith(false);
    expect(store.paused).toBe(false);
  });
});
