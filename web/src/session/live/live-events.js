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
  showIndicator = () => {},
  updateStats = () => {},
  isFollowing = () => false,
  scrollAfterLayout = () => {},
  incrementPending = () => {},
  showFollowButton = () => {}
} = {}) {
  const response = await fetchImpl('/api/session?id=' + encodeURIComponent(sessionId));
  const data = await response.json();
  clearChatPreview();
  const entries = data.entries || [];
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

  if (newCount > 0) {
    showIndicator();
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
  onError = () => {}
} = {}) {
  eventSource.onmessage = (event) => {
    if (event.data !== 'reload') return;
    onReload(event);
  };
  eventSource.addEventListener('chat-preview', (event) => {
    try {
      onChatPreview(JSON.parse(event.data));
    } catch (error) {
      onError(error);
    }
  });
  eventSource.onerror = onError;
  return eventSource;
}
