import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { runLiveReload } from './live-reload-runner.js';

describe('live reload runner', () => {
  it('wires delegated live helpers', () => {
    const dom = new JSDOM('<body><div id="content"></div></body>', { url: 'https://x.test/session?id=s' });
    const eventSource = { addEventListener: vi.fn() };
    const EventSourceImpl = vi.fn(() => eventSource);
    const liveEvents = {
      getSessionIdFromLocation: vi.fn(() => 's'),
      createSessionEventSource: vi.fn(() => eventSource),
      wireSessionEvents: vi.fn()
    };
    const newSessionButton = { setupNewSessionButton: vi.fn() };
    runLiveReload({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      locationImpl: dom.window.location,
      navigatorImpl: {},
      markedImpl: { parse: (text) => text },
      fetchImpl: vi.fn(),
      EventSourceImpl,
      requestAnimationFrameImpl: (cb) => cb(),
      setTimeoutImpl: () => {},
      clearTimeoutImpl: () => {},
      liveEntries: { createSeenEntrySet: () => new Set(), appendEntry: vi.fn(), upsertEntry: vi.fn(), refreshEntriesAffectedByToolResult: vi.fn() },
      liveRenderer: { createLiveRenderer: () => ({ renderEntry: () => '', renderMarkdown: (text) => text }) },
      liveScroll: { isAtBottom: () => true, scrollToBottom: vi.fn(), scrollElementAboveComposer: vi.fn(), createFollowButton: vi.fn(), setFollowButtonText: vi.fn(), removeFollowButton: vi.fn() },
      liveStats: { updateStatsDom: vi.fn() },
      liveEvents,
      chatPreview: { clearChatPreview: vi.fn(), renderChatPreview: vi.fn() },
      shareOverlay: { setupShareButton: vi.fn() },
      resumeButton: { setupResumeButton: vi.fn() },
      newSessionButton,
      cwd: '/projects/foo'
    });
    expect(liveEvents.createSessionEventSource).toHaveBeenCalledWith('s', { EventSourceImpl });
    expect(liveEvents.wireSessionEvents).toHaveBeenCalled();
    expect(newSessionButton.setupNewSessionButton).toHaveBeenCalled();
  });
});
