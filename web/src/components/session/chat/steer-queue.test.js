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

describe('setupSteerQueue', () => {
  it('queue button is disabled until the textarea has content', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    setupSteerQueue({ store, queueButton, textarea });

    expect(queueButton.disabled).toBe(true);
    type(textarea, 'hello');
    expect(queueButton.disabled).toBe(false);
  });

  it('clicking queue enqueues the textarea content into the store and clears the textarea', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    setupSteerQueue({ store, queueButton, textarea });

    type(textarea, 'hello');
    queueButton.click();

    expect(store.items).toHaveLength(1);
    expect(store.items[0].kind).toBe('queued');
    expect(store.items[0].displayText).toBe('hello');
    expect(textarea.value).toBe('');
  });

  it('removing a queued item via the store works', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    setupSteerQueue({ store, queueButton, textarea });

    type(textarea, 'one');
    queueButton.click();
    type(textarea, 'two');
    queueButton.click();
    expect(store.items.map((i) => i.displayText)).toEqual(['one', 'two']);

    store.removeById(store.items[0].id);
    expect(store.items.map((i) => i.displayText)).toEqual(['two']);
  });

  it('auto-dequeues the next item on pi-worker-done when not paused', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    const sendChatMessage = vi.fn(async () => true);
    setupSteerQueue({ store, queueButton, textarea, sendChatMessage });

    // Simulate a run starting via the optimistic send event.
    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'task' } }));

    type(textarea, 'queued');
    queueButton.click();

    window.dispatchEvent(new Event('pi-worker-done'));

    expect(sendChatMessage).toHaveBeenCalledWith('queued', []);
    expect(store.items).toHaveLength(0);
  });

  it('does NOT auto-dequeue when paused; resume sends immediately when idle', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    const sendChatMessage = vi.fn(async () => true);
    const handle = setupSteerQueue({ store, queueButton, textarea, sendChatMessage });

    // Pre-load queue while idle.
    type(textarea, 'queued');
    queueButton.click();
    store.setPaused(true);

    // A run completes — paused means no auto-send.
    window.dispatchEvent(new Event('pi-worker-done'));
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(store.items).toHaveLength(1);

    // Resume from idle should kick off the next item.
    handle.resume();
    expect(sendChatMessage).toHaveBeenCalledWith('queued', []);
    expect(store.items).toHaveLength(0);
  });

  it('treats subsequent sends during an active run as steers, tracked by the store', () => {
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

    // Steer is removable while pending.
    store.removeById(store.items[0].id);
    expect(store.steerCount).toBe(0);
  });

  it('clears steer rows on pi-worker-done; dequeues do not add new steer rows', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    const sendChatMessage = vi.fn(async () => true);
    setupSteerQueue({ store, queueButton, textarea, sendChatMessage });

    // Start a run, add a steer, queue a follow-up.
    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'first' } }));
    window.dispatchEvent(new CustomEvent('pi-chat-message-sent', { detail: { message: 'steer' } }));
    type(textarea, 'queued');
    queueButton.click();

    expect(store.steerCount).toBe(1);
    expect(store.queuedCount).toBe(1);

    // Complete the run.
    window.dispatchEvent(new Event('pi-worker-done'));

    // Steer cleared; queued item was auto-sent (and removed from the store);
    // the send event from sendChatMessage is suppressed, so no new steer row.
    expect(store.steerCount).toBe(0);
    expect(store.queuedCount).toBe(0);
    expect(sendChatMessage).toHaveBeenCalledWith('queued', []);
  });

  it('sendNow removes the focused queued item and dispatches it immediately', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    const sendChatMessage = vi.fn(async () => true);
    const handle = setupSteerQueue({ store, queueButton, textarea, sendChatMessage });

    type(textarea, 'one');
    queueButton.click();
    type(textarea, 'two');
    queueButton.click();

    const secondId = store.items[1].id;
    handle.sendNow(secondId);

    expect(sendChatMessage).toHaveBeenCalledWith('two', []);
    expect(store.items.map((i) => i.displayText)).toEqual(['one']);
  });

  it('edit pulls the queued item back into the textarea and removes it', () => {
    const { queueButton, textarea } = makeDom();
    const store = new QueueStore();
    const handle = setupSteerQueue({ store, queueButton, textarea });

    type(textarea, 'draft');
    queueButton.click();
    expect(store.items).toHaveLength(1);

    handle.edit(store.items[0].id);
    expect(textarea.value).toBe('draft');
    expect(store.items).toHaveLength(0);
  });
});
