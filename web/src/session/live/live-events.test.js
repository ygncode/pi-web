import { describe, expect, it, vi } from 'vitest';
import { createSessionEventSource, getSessionIdFromLocation, handleSessionReload, wireSessionEvents } from './live-events.js';

describe('live events', () => {
  it('gets session id and creates event source', () => {
    expect(getSessionIdFromLocation({ locationImpl: { search: '?id=a%20b&x=1' } })).toBe('a%20b');
    const EventSourceImpl = vi.fn();
    createSessionEventSource('a b', { EventSourceImpl });
    expect(EventSourceImpl).toHaveBeenCalledWith('/events?id=a%20b');
  });

  it('handles reload entries and follow behavior', async () => {
    const entries = [{ id: 'a' }, { id: 'r', message: { role: 'toolResult' } }];
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ entries }), { status: 200 })));
    const entryState = { seen: new Set(), liveRendered: new Set() };
    const appendEntry = vi.fn((entry) => { entryState.seen.add(entry.id); return true; });
    const refresh = vi.fn();
    const showIndicator = vi.fn();
    const updateStats = vi.fn();
    const scrollAfterLayout = vi.fn();

    const result = await handleSessionReload({
      sessionId: 's',
      fetchImpl,
      entryState,
      clearChatPreview: vi.fn(),
      appendEntry,
      upsertEntry: vi.fn(),
      refreshEntriesAffectedByToolResult: refresh,
      showIndicator,
      updateStats,
      isFollowing: () => true,
      scrollAfterLayout
    });

    expect(fetchImpl).toHaveBeenCalledWith('/api/session?id=s');
    expect(result.newCount).toBe(2);
    expect(refresh).toHaveBeenCalledWith(entries[1], entries);
    expect(showIndicator).toHaveBeenCalled();
    expect(updateStats).toHaveBeenCalledWith(entries);
    expect(scrollAfterLayout).toHaveBeenCalledWith(true);
  });

  it('wires event source messages', () => {
    const eventSource = { addEventListener: vi.fn() };
    const onReload = vi.fn();
    const onChatPreview = vi.fn();
    const onError = vi.fn();
    wireSessionEvents({ eventSource, onReload, onChatPreview, onError });
    eventSource.onmessage({ data: 'noop' });
    eventSource.onmessage({ data: 'reload' });
    expect(onReload).toHaveBeenCalledTimes(1);
    const previewHandler = eventSource.addEventListener.mock.calls[0][1];
    previewHandler({ data: JSON.stringify({ content: 'x' }) });
    expect(onChatPreview).toHaveBeenCalledWith({ content: 'x' });
    previewHandler({ data: '{bad' });
    expect(onError).toHaveBeenCalled();
  });
});
