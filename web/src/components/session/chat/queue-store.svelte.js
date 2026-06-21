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

export class QueueStore {
  items = $state([]);
  paused = $state(false);
  focusIndex = $state(-1);

  actions = {
    sendNow: () => {},
    edit: () => {},
    resume: () => {},
  };

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

  enqueue = (item) => {
    this.items.push(item);
    this.#clampFocus();
  };

  pushSteer = (item) => {
    this.items.push(item);
    this.#clampFocus();
  };

  clearSteers = () => {
    if (this.steerCount === 0) return;
    this.items = this.items.filter((item) => item.kind !== 'steer');
    this.#clampFocus();
  };

  removeById = (id) => {
    const next = this.items.filter((item) => item.id !== id);
    if (next.length === this.items.length) return null;
    const removedIndex = this.items.findIndex((item) => item.id === id);
    this.items = next;
    if (this.focusIndex >= this.items.length) this.focusIndex = this.items.length - 1;
    else if (removedIndex >= 0 && removedIndex < this.focusIndex) this.focusIndex -= 1;
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
    return item;
  };

  setPaused = (value) => {
    this.paused = !!value;
  };

  togglePaused = () => {
    this.paused = !this.paused;
  };

  setFocusIndex = (index) => {
    if (!Number.isInteger(index)) return;
    if (this.items.length === 0) {
      this.focusIndex = -1;
      return;
    }
    this.focusIndex = Math.max(0, Math.min(this.items.length - 1, index));
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
}
