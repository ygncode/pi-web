import { describe, expect, it } from 'vitest';
import { QueueStore } from './queue-store.svelte.js';

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    _dump: () => Object.fromEntries(map.entries()),
  };
}

const KEY = 'pi-web:v1:queue:session-abc';

describe('QueueStore persistence', () => {
  it('returns persistsLocally=false without sessionId or storage', () => {
    expect(new QueueStore().persistsLocally).toBe(false);
    expect(new QueueStore({ sessionId: 'x' }).persistsLocally).toBe(false);
    expect(new QueueStore({ storage: makeStorage() }).persistsLocally).toBe(false);
  });

  it('writes queued items + paused flag to localStorage on enqueue', () => {
    const storage = makeStorage();
    const store = new QueueStore({ sessionId: 'session-abc', storage });
    store.enqueue({ id: 'q1', kind: 'queued', text: 'hello', files: [], displayText: 'hello' });
    store.enqueue({ id: 'q2', kind: 'queued', text: 'world', files: [], displayText: 'world' });
    store.setPaused(true);

    const raw = storage.getItem(KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.paused).toBe(true);
    expect(parsed.items).toEqual([
      { id: 'q1', kind: 'queued', text: 'hello', displayText: 'hello' },
      { id: 'q2', kind: 'queued', text: 'world', displayText: 'world' },
    ]);
  });

  it('rehydrates queued items + paused on construction', () => {
    const storage = makeStorage({
      [KEY]: JSON.stringify({
        paused: true,
        items: [
          { id: 'q1', kind: 'queued', text: 'restored', displayText: 'restored' },
          { id: 'q2', kind: 'queued', text: 'second', displayText: 'second' },
        ],
      }),
    });

    const store = new QueueStore({ sessionId: 'session-abc', storage });
    expect(store.items).toHaveLength(2);
    expect(store.items[0]).toMatchObject({ id: 'q1', text: 'restored', files: [] });
    expect(store.items[1]).toMatchObject({ id: 'q2', text: 'second', files: [] });
    expect(store.paused).toBe(true);
  });

  it('does not persist steer rows (they belong to the active run)', () => {
    const storage = makeStorage();
    const store = new QueueStore({ sessionId: 'session-abc', storage });
    store.pushSteer({ id: 's1', kind: 'steer', text: 'steering' });
    expect(storage.getItem(KEY)).toBeNull();

    store.enqueue({ id: 'q1', kind: 'queued', text: 'kept', files: [], displayText: 'kept' });
    const parsed = JSON.parse(storage.getItem(KEY));
    // Only the queued item, not the steer.
    expect(parsed.items.map((i) => i.id)).toEqual(['q1']);
  });

  it('drops file attachments on persist (Files are not serializable)', () => {
    const storage = makeStorage();
    const store = new QueueStore({ sessionId: 'session-abc', storage });
    const fakeFile = { name: 'cat.png', size: 9 };
    store.enqueue({
      id: 'q1',
      kind: 'queued',
      text: 'image attached',
      displayText: 'image attached',
      files: [fakeFile],
    });

    const parsed = JSON.parse(storage.getItem(KEY));
    expect(parsed.items[0]).not.toHaveProperty('files');
  });

  it('clears the storage entry when the queue empties and pause is off', () => {
    const storage = makeStorage();
    const store = new QueueStore({ sessionId: 'session-abc', storage });
    store.enqueue({ id: 'q1', kind: 'queued', text: 'x', files: [], displayText: 'x' });
    expect(storage.getItem(KEY)).toBeTruthy();

    store.removeById('q1');
    expect(storage.getItem(KEY)).toBeNull();
  });

  it('keeps the storage entry around when paused is still true after items drain', () => {
    const storage = makeStorage();
    const store = new QueueStore({ sessionId: 'session-abc', storage });
    store.setPaused(true);
    store.enqueue({ id: 'q1', kind: 'queued', text: 'x', files: [], displayText: 'x' });
    store.removeById('q1');
    // Paused stays true so the entry stays around to preserve that setting.
    const raw = storage.getItem(KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw)).toEqual({ items: [], paused: true });
  });

  it('takeQueuedHead writes the new shorter list', () => {
    const storage = makeStorage();
    const store = new QueueStore({ sessionId: 'session-abc', storage });
    store.enqueue({ id: 'q1', kind: 'queued', text: 'one', files: [], displayText: 'one' });
    store.enqueue({ id: 'q2', kind: 'queued', text: 'two', files: [], displayText: 'two' });

    const head = store.takeQueuedHead();
    expect(head.id).toBe('q1');
    expect(JSON.parse(storage.getItem(KEY)).items.map((i) => i.id)).toEqual(['q2']);
  });

  it('shrugs off corrupt JSON in localStorage', () => {
    const storage = makeStorage({ [KEY]: '{not json' });
    const store = new QueueStore({ sessionId: 'session-abc', storage });
    expect(store.items).toEqual([]);
    expect(store.paused).toBe(false);
  });

  it('different sessions keep their own queues', () => {
    const storage = makeStorage();
    const a = new QueueStore({ sessionId: 'A', storage });
    const b = new QueueStore({ sessionId: 'B', storage });
    a.enqueue({ id: 'qa', kind: 'queued', text: 'A', files: [], displayText: 'A' });
    b.enqueue({ id: 'qb', kind: 'queued', text: 'B', files: [], displayText: 'B' });

    const reloadA = new QueueStore({ sessionId: 'A', storage });
    const reloadB = new QueueStore({ sessionId: 'B', storage });
    expect(reloadA.items.map((i) => i.id)).toEqual(['qa']);
    expect(reloadB.items.map((i) => i.id)).toEqual(['qb']);
  });
});
