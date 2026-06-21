import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueueStore } from './queue-store.svelte.js';

function makeApi(initial = { items: [], paused: false }) {
  let snapshot = { items: [...initial.items], paused: !!initial.paused };
  let nextPosition = (snapshot.items.reduce((m, i) => Math.max(m, i.position), 0) || 0) + 1;
  const api = {
    list: vi.fn(async () => ({
      items: snapshot.items.map((i) => ({ ...i })),
      paused: snapshot.paused,
    })),
    add: vi.fn(async (message, displayText) => {
      const item = {
        sessionId: 'mock',
        position: nextPosition++,
        message,
        displayText: displayText || message,
      };
      snapshot.items.push(item);
      return item;
    }),
    remove: vi.fn(async (position) => {
      snapshot.items = snapshot.items.filter((i) => i.position !== position);
    }),
    setPaused: vi.fn(async (paused) => {
      snapshot.paused = !!paused;
    }),
    _snapshot: () => ({ items: [...snapshot.items], paused: snapshot.paused }),
  };
  return api;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QueueStore (server-backed)', () => {
  it('persistsLocally reports false without an api', () => {
    expect(new QueueStore().persistsLocally).toBe(false);
    expect(new QueueStore({ api: makeApi() }).persistsLocally).toBe(true);
  });

  it('refresh hydrates queued items from the api and preserves steers', async () => {
    const api = makeApi({
      items: [
        { position: 5, message: 'hello', displayText: 'hello' },
        { position: 6, message: 'world', displayText: 'world' },
      ],
      paused: true,
    });
    const store = new QueueStore({ api });
    // Add a transient steer before refresh.
    store.pushSteer({ text: 'mid-flight' });
    await store.refresh();
    expect(store.queuedCount).toBe(2);
    expect(store.steerCount).toBe(1);
    expect(store.paused).toBe(true);
    expect(store.items[0]).toMatchObject({ kind: 'queued', position: 5, text: 'hello' });
    expect(store.items[1]).toMatchObject({ kind: 'queued', position: 6, text: 'world' });
    expect(store.items[2]).toMatchObject({ kind: 'steer', text: 'mid-flight' });
  });

  it('enqueueQueued POSTs to the api and appends the new row before any steer', async () => {
    const api = makeApi();
    const store = new QueueStore({ api });
    store.pushSteer({ text: 'first-steer' });
    const added = await store.enqueueQueued({ message: 'hi', displayText: 'hi' });
    expect(added).toMatchObject({ kind: 'queued', text: 'hi' });
    expect(api.add).toHaveBeenCalledWith('hi', 'hi');
    // The queued row is inserted before the steer.
    expect(store.items.map((i) => i.kind)).toEqual(['queued', 'steer']);
  });

  it('removeById on a queued row calls api.remove and updates the store', async () => {
    const api = makeApi({
      items: [{ position: 7, message: 'gone', displayText: 'gone' }],
    });
    const store = new QueueStore({ api });
    await store.refresh();
    expect(store.queuedCount).toBe(1);

    await store.removeById(store.items[0].id);
    expect(api.remove).toHaveBeenCalledWith(7);
    expect(store.queuedCount).toBe(0);
  });

  it('removeById on a steer row does not call the api', async () => {
    const api = makeApi();
    const store = new QueueStore({ api });
    store.pushSteer({ text: 's' });
    await store.removeById(store.items[0].id);
    expect(api.remove).not.toHaveBeenCalled();
    expect(store.steerCount).toBe(0);
  });

  it('takeLocalById removes without touching the api (sendNow/edit path)', async () => {
    const api = makeApi({ items: [{ position: 1, message: 'm', displayText: 'm' }] });
    const store = new QueueStore({ api });
    await store.refresh();
    const item = store.takeLocalById(store.items[0].id);
    expect(item).toMatchObject({ kind: 'queued', position: 1, text: 'm' });
    expect(api.remove).not.toHaveBeenCalled();
    expect(store.queuedCount).toBe(0);
  });

  it('setPaused PATCHes the api and updates the flag', async () => {
    const api = makeApi();
    const store = new QueueStore({ api });
    await store.setPaused(true);
    expect(api.setPaused).toHaveBeenCalledWith(true);
    expect(store.paused).toBe(true);
    // Same value is a no-op.
    api.setPaused.mockClear();
    await store.setPaused(true);
    expect(api.setPaused).not.toHaveBeenCalled();
  });

  it('clearSteers leaves queued rows alone', async () => {
    const api = makeApi({ items: [{ position: 1, message: 'q', displayText: 'q' }] });
    const store = new QueueStore({ api });
    await store.refresh();
    store.pushSteer({ text: 'a' });
    store.pushSteer({ text: 'b' });
    store.clearSteers();
    expect(store.steerCount).toBe(0);
    expect(store.queuedCount).toBe(1);
  });

  it('refresh tolerates an api failure', async () => {
    const api = {
      list: vi.fn(async () => {
        throw new Error('network');
      }),
    };
    const store = new QueueStore({ api });
    await expect(store.refresh()).resolves.toBeUndefined();
    expect(store.isEmpty).toBe(true);
  });
});
