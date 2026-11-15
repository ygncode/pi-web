import { describe, expect, it, vi } from 'vitest';
import {
  createSessionEventSource,
  getSessionIdFromLocation,
  handleSessionReload,
  wireSessionEvents,
} from './live-events.js';

describe('live events', () => {
  it('gets session id and creates event source', () => {
    expect(getSessionIdFromLocation({ locationImpl: { search: '?id=a%20b&x=1' } })).toBe('a%20b');
    const EventSourceImpl = vi.fn();
    createSessionEventSource('a b', { EventSourceImpl });
    expect(EventSourceImpl).toHaveBeenCalledWith('/events?id=a%20b');
  });

  it('handles reload entries, title, and follow behavior', async () => {
    const entries = [{ id: 'a' }, { id: 'r', message: { role: 'toolResult' } }];
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ name: 'New Title', entries }), { status: 200 }),
      ),
    );
    const entryState = { seen: new Set(), liveRendered: new Set() };
    const appendEntry = vi.fn((entry) => {
      entryState.seen.add(entry.id);
      return true;
    });
    const refresh = vi.fn();
    const updateStats = vi.fn();
    const updateTitle = vi.fn();
    const scrollAfterLayout = vi.fn();
    const onReloaded = vi.fn();

    const result = await handleSessionReload({
      sessionId: 's',
      fetchImpl,
      entryState,
      clearChatPreview: vi.fn(),
      appendEntry,
      upsertEntry: vi.fn(),
      refreshEntriesAffectedByToolResult: refresh,
      updateStats,
      updateTitle,
      isFollowing: () => true,
      scrollAfterLayout,
      onReloaded,
    });

    expect(fetchImpl).toHaveBeenCalledWith('/api/session?id=s');
    expect(result.newCount).toBe(2);
    expect(onReloaded).toHaveBeenCalledWith({ name: 'New Title', entries });
    expect(refresh).toHaveBeenCalledWith(entries[1], entries);
    expect(updateStats).toHaveBeenCalledWith(entries);
    expect(updateTitle).toHaveBeenCalledWith('New Title');
    expect(scrollAfterLayout).toHaveBeenCalledWith(true);
  });

  it('reconciles via the model in reactive mode (no DOM patching)', async () => {
    // No appendEntry/upsertEntry → the Svelte <SessionContent> owns #messages.
    // handleSessionReload only tracks new ids and flags them via onNewEntries.
    const entries = [{ id: 'a' }, { id: 'b' }];
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ entries }), { status: 200 })),
    );
    const entryState = { seen: new Set(['a']), liveRendered: new Set() };
    const onReloaded = vi.fn();
    const onNewEntries = vi.fn();
    const scrollAfterLayout = vi.fn();
    const clearChatPreview = vi.fn();

    const result = await handleSessionReload({
      sessionId: 's',
      fetchImpl,
      entryState,
      clearChatPreview,
      isFollowing: () => true,
      scrollAfterLayout,
      onReloaded,
      onNewEntries,
    });

    expect(onReloaded).toHaveBeenCalledWith({ entries });
    expect(result.newCount).toBe(1);
    expect(entryState.seen.has('b')).toBe(true);
    expect(onNewEntries).toHaveBeenCalledWith(['b']);
    expect(clearChatPreview).toHaveBeenCalled();
    expect(scrollAfterLayout).toHaveBeenCalledWith(true);
  });

  it('scrolls instead of showing the button when at the bottom but follow flag is stale', async () => {
    // Regression: agent finishes while the viewport is pinned to the bottom, but
    // `following` was knocked false by a relayout clamp. The reload must use the
    // live scroll position and not pop the "scroll to bottom" button.
    const entries = [{ id: 'a' }, { id: 'b' }];
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ entries }), { status: 200 })),
    );
    const entryState = { seen: new Set(['a']), liveRendered: new Set() };
    const scrollAfterLayout = vi.fn();
    const incrementPending = vi.fn();
    const showFollowButton = vi.fn();

    await handleSessionReload({
      sessionId: 's',
      fetchImpl,
      entryState,
      clearChatPreview: vi.fn(),
      isFollowing: () => false,
      isAtBottom: () => true,
      scrollAfterLayout,
      incrementPending,
      showFollowButton,
      onReloaded: vi.fn(),
    });

    expect(scrollAfterLayout).toHaveBeenCalledWith(true);
    expect(showFollowButton).not.toHaveBeenCalled();
    expect(incrementPending).not.toHaveBeenCalled();
  });

  it('shows the button when not following and not at the bottom', async () => {
    const entries = [{ id: 'a' }, { id: 'b' }];
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ entries }), { status: 200 })),
    );
    const entryState = { seen: new Set(['a']), liveRendered: new Set() };
    const scrollAfterLayout = vi.fn();
    const incrementPending = vi.fn();
    const showFollowButton = vi.fn();

    await handleSessionReload({
      sessionId: 's',
      fetchImpl,
      entryState,
      clearChatPreview: vi.fn(),
      isFollowing: () => false,
      isAtBottom: () => false,
      scrollAfterLayout,
      incrementPending,
      showFollowButton,
      onReloaded: vi.fn(),
    });

    expect(showFollowButton).toHaveBeenCalledTimes(1);
    expect(incrementPending).toHaveBeenCalledWith(1);
    expect(scrollAfterLayout).not.toHaveBeenCalled();
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

  it('reconciles on a chat-preview done (covers a dropped first-write reload)', () => {
    const eventSource = { addEventListener: vi.fn() };
    const onReload = vi.fn();
    const onChatPreview = vi.fn();
    wireSessionEvents({ eventSource, onReload, onChatPreview });
    const previewHandler = eventSource.addEventListener.mock.calls[0][1];

    previewHandler({ data: JSON.stringify({ content: 'streaming', done: false }) });
    expect(onReload).not.toHaveBeenCalled();

    previewHandler({ data: JSON.stringify({ content: 'final', done: true }) });
    expect(onChatPreview).toHaveBeenLastCalledWith({ content: 'final', done: true });
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('dispatches pi-session-reload window event on reload', () => {
    const eventSource = { addEventListener: vi.fn() };
    const dispatched = [];
    const windowImpl = {
      dispatchEvent: (e) => {
        dispatched.push(e);
        return true;
      },
    };
    class FakeCustomEvent {
      constructor(type) {
        this.type = type;
      }
    }
    wireSessionEvents({
      eventSource,
      onReload: vi.fn(),
      onChatPreview: vi.fn(),
      windowImpl,
      CustomEventImpl: FakeCustomEvent,
    });
    eventSource.onmessage({ data: 'reload' });
    expect(dispatched.length).toBe(1);
    expect(dispatched[0].type).toBe('pi-session-reload');
    eventSource.onmessage({ data: 'noop' });
    expect(dispatched.length).toBe(1);
  });
});

describe('tool progress events', () => {
  it('forwards tool-progress payloads to the subagent live store', async () => {
    const { wireSessionEvents } = await import('./live-events.js');
    const { liveProgress } = await import('../ui/subagent-view.js');
    const handlers = {};
    const eventSource = { addEventListener: (n, h) => (handlers[n] = h) };
    wireSessionEvents({ eventSource, onReload: () => {}, onChatPreview: () => {}, onError: () => {} });
    handlers['tool-progress']({ data: JSON.stringify({ toolCallId: 'tp1', details: { mode: 'single', results: [] } }) });
    expect(liveProgress('tp1')).toEqual({ mode: 'single', results: [] });
  });
});

// Incremental reload: with knownEntries the client fetches only the missing
// tail (index = known.length) and merges it — the full session is not
// re-downloaded on every stream event.
it('handleSessionReload fetches only the missing tail when knownEntries is given', async () => {
  const seenEntries = Array.from({ length: 3 }, (_, i) => ({ id: `old-${i}` }));
  const tail = [{ id: 'new-0' }, { id: 'new-1' }];
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      json: async () => ({ entries: tail, total: 5, from: 3 }),
    };
  };
  const onReloaded = vi.fn();
  await handleSessionReload({
    sessionId: 's.jsonl',
    fetchImpl,
    entryState: { seen: new Set(seenEntries.map((e) => e.id)) },
    knownEntries: seenEntries,
    onReloaded,
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('from=3');
  expect(calls[0]).toContain('count=999999');
  const merged = onReloaded.mock.calls[0][0].entries;
  expect(merged).toHaveLength(5);
  expect(merged[0].id).toBe('old-0');
  expect(merged[4].id).toBe('new-1');
});

// When the server trims (from !== known.length) the payload is used as-is.
it('handleSessionReload falls back to the full payload when the server trims', async () => {
  const full = [{ id: 'a' }, { id: 'b' }];
  const fetchImpl = async () => ({ json: async () => ({ entries: full, total: 2, from: 0 }) });
  const onReloaded = vi.fn();
  await handleSessionReload({
    sessionId: 's.jsonl',
    fetchImpl,
    entryState: { seen: new Set(['a', 'b']) },
    knownEntries: [{ id: 'stale-0' }, { id: 'stale-1' }, { id: 'stale-2' }],
    onReloaded,
  });
  expect(onReloaded.mock.calls[0][0].entries).toEqual(full);
});
