// Reactive state behind the docked queue panel above the composer. Holds two
// kinds of items in a single list — `queued` (waiting to send once the run
// completes) and `steer` (already sent to pi as a steer; we hold the chip so
// the user knows it's mid-flight, and let them dismiss it). Pause keeps the
// auto-dequeue from firing on pi-worker-done; Resume kicks the next item out
// immediately if no run is in flight.
//
// `actions` is filled in by the runtime (setupSteerQueue): the store stays
// presentation/state-only, while sending, editing, and resume orchestration
// stay in the runtime where the chat-submit + textarea live.
//
// Persistence: queued items (and the paused flag) are mirrored to
// localStorage per-session so a browser refresh doesn't drop the user's
// pending messages. Steer rows are NOT persisted — they belong to a specific
// in-flight run, and the worker that owns it is gone after a refresh. File
// attachments are dropped on persist (File objects can't be serialized); the
// text portion survives.

const STORAGE_PREFIX = 'pi-web:v1:queue:';

function storageKey(sessionId) {
  return sessionId ? STORAGE_PREFIX + sessionId : '';
}

function loadFromStorage(storage, key) {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const items = Array.isArray(data.items)
      ? data.items
          .filter((entry) => entry && entry.kind === 'queued' && typeof entry.text === 'string')
          .map((entry) => ({
            id: String(entry.id || ''),
            kind: 'queued',
            text: entry.text,
            displayText: typeof entry.displayText === 'string' ? entry.displayText : entry.text,
            files: [],
          }))
          .filter((entry) => entry.id)
      : [];
    return { items, paused: !!data.paused };
  } catch {
    return null;
  }
}

function writeToStorage(storage, key, items, paused) {
  if (!storage || !key) return;
  try {
    const persisted = items
      .filter((item) => item.kind === 'queued')
      .map((item) => ({
        id: item.id,
        kind: 'queued',
        text: item.text,
        displayText: item.displayText,
      }));
    if (persisted.length === 0 && !paused) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify({ items: persisted, paused }));
  } catch {
    /* quota errors, etc. — silently drop the write */
  }
}

export class QueueStore {
  items = $state([]);
  paused = $state(false);
  focusIndex = $state(-1);

  actions = {
    sendNow: () => {},
    edit: () => {},
    resume: () => {},
  };

  #storage = null;
  #storageKey = '';
  // Suppresses writes while #load is rehydrating, so we don't overwrite the
  // restored state with itself before paused/items settle.
  #loading = false;

  constructor({ sessionId = '', storage = null } = {}) {
    this.#storage = storage;
    this.#storageKey = storageKey(sessionId);
    const restored = loadFromStorage(this.#storage, this.#storageKey);
    if (restored) {
      this.#loading = true;
      this.items = restored.items;
      this.paused = restored.paused;
      this.#loading = false;
    }
  }

  get isEmpty() {
    return this.items.length === 0;
  }

  get count() {
    return this.items.length;
  }

  get queuedCount() {
    return this.items.filter((item) => item.kind === 'queued').length;
  }

  get steerCount() {
    return this.items.filter((item) => item.kind === 'steer').length;
  }

  get persistsLocally() {
    return !!this.#storage && !!this.#storageKey;
  }

  enqueue = (item) => {
    this.items.push(item);
    this.#clampFocus();
    this.#persist();
  };

  pushSteer = (item) => {
    this.items.push(item);
    this.#clampFocus();
    // No persist — steers aren't saved.
  };

  clearSteers = () => {
    if (this.steerCount === 0) return;
    this.items = this.items.filter((item) => item.kind !== 'steer');
    this.#clampFocus();
    // No persist — only steers changed.
  };

  removeById = (id) => {
    const next = this.items.filter((item) => item.id !== id);
    if (next.length === this.items.length) return null;
    const removedIndex = this.items.findIndex((item) => item.id === id);
    const removedKind = this.items[removedIndex]?.kind;
    this.items = next;
    if (this.focusIndex >= this.items.length) this.focusIndex = this.items.length - 1;
    else if (removedIndex >= 0 && removedIndex < this.focusIndex) this.focusIndex -= 1;
    if (removedKind === 'queued') this.#persist();
    return true;
  };

  takeById = (id) => {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return null;
    this.removeById(id);
    return item;
  };

  takeQueuedHead = () => {
    const idx = this.items.findIndex((item) => item.kind === 'queued');
    if (idx === -1) return null;
    const [item] = this.items.splice(idx, 1);
    this.#clampFocus();
    this.#persist();
    return item;
  };

  setPaused = (value) => {
    const next = !!value;
    if (this.paused === next) return;
    this.paused = next;
    this.#persist();
  };

  togglePaused = () => {
    this.paused = !this.paused;
    this.#persist();
  };

  setFocusIndex = (index) => {
    if (!Number.isInteger(index)) return;
    // -1 (or any negative) explicitly means "no row focused" — used by Esc to
    // exit the panel without dropping items.
    if (index < 0 || this.items.length === 0) {
      this.focusIndex = -1;
      return;
    }
    this.focusIndex = Math.min(this.items.length - 1, index);
  };

  focusUp = () => {
    if (this.items.length === 0) return;
    if (this.focusIndex <= 0) this.focusIndex = this.items.length - 1;
    else this.focusIndex -= 1;
  };

  focusDown = () => {
    if (this.items.length === 0) return;
    if (this.focusIndex < 0 || this.focusIndex >= this.items.length - 1) this.focusIndex = 0;
    else this.focusIndex += 1;
  };

  focusedItem = () => {
    if (this.focusIndex < 0 || this.focusIndex >= this.items.length) return null;
    return this.items[this.focusIndex];
  };

  #clampFocus() {
    if (this.items.length === 0) {
      this.focusIndex = -1;
      return;
    }
    if (this.focusIndex >= this.items.length) this.focusIndex = this.items.length - 1;
  }

  #persist() {
    if (this.#loading) return;
    writeToStorage(this.#storage, this.#storageKey, this.items, this.paused);
  }
}
