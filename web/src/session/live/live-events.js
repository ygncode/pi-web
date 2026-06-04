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
  clearChatPreview = () => {},
  appendEntry,
  upsertEntry,
  refreshEntriesAffectedByToolResult,
  updateStats = () => {},
  updateTitle = () => {},
  isFollowing = () => false,
  scrollAfterLayout = () => {},
  incrementPending = () => {},
  showFollowButton = () => {},
  onReloaded = () => {}
} = {}) {
  const response = await fetchImpl('/api/session?id=' + encodeURIComponent(sessionId));
  const data = await response.json();
  const entries = data.entries || [];
  onReloaded({ ...data, entries });
  if (typeof data.name === 'string' && data.name.trim()) {
    updateTitle(data.name);
  }
  let newCount = 0;

  entries.forEach((entry) => {
    if (!entry.id) return;
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
  // entries have been appended/upserted. Clearing before append creates a
  // visible blank/flicker when a cold worker finally writes the real message.
  clearChatPreview();

  if (newCount > 0) {
    updateStats(entries);
    if (isFollowing()) {
      scrollAfterLayout(true);
    } else {
      incrementPending(newCount);
      showFollowButton();
    }
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
  CustomEventImpl = typeof CustomEvent !== 'undefined' ? CustomEvent : null
} = {}) {
  eventSource.onmessage = (event) => {
    if (event.data !== 'reload') return;
    onReload(event);
    // Broadcast so other modules (e.g. chat composer status) can react
    // immediately instead of waiting for their next poll tick.
    if (windowImpl && CustomEventImpl) {
      try { windowImpl.dispatchEvent(new CustomEventImpl('pi-session-reload')); } catch (_) {}
    }
  };
  eventSource.addEventListener('chat-preview', (event) => {
    try {
      onChatPreview(JSON.parse(event.data));
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
  eventSource.onerror = onError;
  return eventSource;
}
