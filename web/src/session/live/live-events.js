import { recordToolProgress } from '../ui/subagent-view.js';
export function getSessionIdFromLocation({ locationImpl = location } = {}) {
  return locationImpl.search.split('id=')[1]?.split('&')[0] || '';
}

export function createSessionEventSource(sessionId, { EventSourceImpl = EventSource } = {}) {
  return new EventSourceImpl('/events?id=' + encodeURIComponent(sessionId));
}

export async function handleSessionReload({
  sessionId,
  fetchImpl = fetch,
  entryState,
  knownEntries = null,
  clearChatPreview = () => {},
  appendEntry,
  upsertEntry,
  refreshEntriesAffectedByToolResult,
  updateStats = () => {},
  updateTitle = () => {},
  isFollowing = () => false,
  isAtBottom = () => false,
  scrollAfterLayout = () => {},
  incrementPending = () => {},
  showFollowButton = () => {},
  onReloaded = () => {},
  onNewEntries = null,
} = {}) {
  // Incremental reload: sessions are append-only, so the client asks only for
  // the entries it does not have yet (index = knownEntries.length) instead of
  // re-downloading the whole session on every stream event — on weak devices
  // (iPhone) the full refetch re-rendered the whole list each time and made
  // typing stutter while the model was generating.
  let data;
  const known = Array.isArray(knownEntries) ? knownEntries : null;
  if (known && known.length > 0) {
    const tail = await fetchImpl(
      '/api/session?id=' + encodeURIComponent(sessionId) + '&from=' + known.length + '&count=999999',
    );
    data = await tail.json();
    if (Number.isInteger(data.from) && data.from === known.length && Array.isArray(data.entries)) {
      data = { ...data, entries: known.concat(data.entries) };
    }
    // else: server trimmed/clamped — the payload already covers everything.
  } else {
    const response = await fetchImpl('/api/session?id=' + encodeURIComponent(sessionId));
    data = await response.json();
  }
  const entries = data.entries || [];
  onReloaded({ ...data, entries });
  if (typeof data.name === 'string' && data.name.trim()) {
    updateTitle(data.name);
  }
  let newCount = 0;

  // Two modes:
  //  • Imperative (appendEntry provided): patch #messages DOM directly. Kept
  //    for isolated helper tests and non-Svelte callers.
  //  • Reactive (no appendEntry): the Svelte <SessionContent> owns #messages and
  //    re-renders from the model that onReloaded just updated, so here we only
  //    track which ids are brand-new (for follow/scroll/highlight decisions).
  const reactive = typeof appendEntry !== 'function';
  const newIds = [];

  entries.forEach((entry) => {
    if (!entry.id) return;
    if (reactive) {
      if (!entryState.seen.has(entry.id)) {
        entryState.seen.add(entry.id);
        newCount++;
        newIds.push(entry.id);
      }
      return;
    }
    if (!entryState.seen.has(entry.id)) {
      if (appendEntry(entry, entries)) newCount++;
      if (entry.message && entry.message.role === 'toolResult') {
        refreshEntriesAffectedByToolResult(entry, entries);
      }
    } else if (entryState.liveRendered.has(entry.id)) {
      upsertEntry(entry, entries);
      if (entry.message && entry.message.role === 'toolResult') {
        refreshEntriesAffectedByToolResult(entry, entries);
      }
    } else if (entry.message && entry.message.role === 'toolResult') {
      refreshEntriesAffectedByToolResult(entry, entries);
    }
  });

  // Clear optimistic pending user/assistant preview only after canonical
  // entries have been appended/upserted (imperative) or merged into the model
  // (reactive). Clearing earlier creates a visible blank/flicker when a cold
  // worker finally writes the real message.
  clearChatPreview();

  if (newCount > 0) {
    updateStats(entries);
    // Decide on the live scroll position, not just the cached follow flag: the
    // viewport can be pinned to the bottom while `following` is momentarily
    // stale, in which case showing the button would be wrong.
    if (isFollowing() || isAtBottom()) {
      scrollAfterLayout(true);
    } else {
      incrementPending(newCount);
      showFollowButton();
    }
  }

  // Reactive mode: once Svelte has rendered the new entries, flag them so the
  // caller can apply the new-entry highlight.
  if (newIds.length && typeof onNewEntries === 'function') {
    onNewEntries(newIds);
  }

  return { entries, newCount };
}

export function wireSessionEvents({
  eventSource,
  onReload,
  onChatPreview,
  onAnnotations = null,
  onError = () => {},
  windowImpl = typeof window !== 'undefined' ? window : null,
  CustomEventImpl = typeof CustomEvent !== 'undefined' ? CustomEvent : null,
} = {}) {
  const dispatchReloadedEvent = () => {
    if (!windowImpl || !CustomEventImpl) return;
    try {
      windowImpl.dispatchEvent(new CustomEventImpl('pi-session-reload'));
    } catch (_) {}
  };

  eventSource.onmessage = (event) => {
    if (event.data !== 'reload') return;
    // `onReload` returns a Promise once handleSessionReload starts; await it so
    // the broadcast fires *after* the model has the new entries. Otherwise
    // listeners that read the model on this event (e.g. steer-queue reconciling
    // its chips against newly-arrived user messages) race the fetch and see a
    // stale snapshot.
    const result = onReload(event);
    if (result && typeof result.then === 'function') {
      result.then(dispatchReloadedEvent, dispatchReloadedEvent);
    } else {
      dispatchReloadedEvent();
    }
  };
  eventSource.addEventListener('chat-preview', (event) => {
    try {
      const payload = JSON.parse(event.data);
      onChatPreview(payload);
      // The file-watch 'reload' event is dropped for a brand-new session's first
      // write (the watcher treats it as an initial observation, not a change), so
      // the canonical entries would never reconcile until a manual refresh. The
      // chat-preview stream is worker-driven and independent of the watcher, so
      // its 'done' signal is a reliable trigger to pull the written entries.
      if (payload && payload.done) {
        const result = onReload(event);
        if (result && typeof result.then === 'function') {
          result.then(dispatchReloadedEvent, dispatchReloadedEvent);
        } else {
          dispatchReloadedEvent();
        }
      }
    } catch (error) {
      onError(error);
    }
  });
  if (onAnnotations) {
    eventSource.addEventListener('annotations', (event) => {
      try {
        const data = JSON.parse(event.data);
        onAnnotations(Array.isArray(data.annotations) ? data.annotations : []);
      } catch (error) {
        onError(error);
      }
    });
  }
  // 'queue' is fired by the backend whenever the per-session chat_queue
  // changes — autonomous drainer, another tab, etc. ChatComposer listens for
  // pi-queue-event on the window and refetches /api/chat/queue.
  eventSource.addEventListener('queue', () => {
    if (windowImpl && CustomEventImpl) {
      try {
        windowImpl.dispatchEvent(new CustomEventImpl('pi-queue-event'));
      } catch (_) {}
    }
  });
  eventSource.addEventListener('tool-progress', (event) => {
    try {
      recordToolProgress(JSON.parse(event.data));
    } catch (error) {
      onError(error);
    }
  });
  eventSource.onerror = onError;
  return eventSource;
}
