export function runLiveReload({
  documentImpl = document,
  windowImpl = window,
  locationImpl = windowImpl.location,
  navigatorImpl = navigator,
  markedImpl = marked,
  fetchImpl = fetch,
  EventSourceImpl = EventSource,
  requestAnimationFrameImpl = requestAnimationFrame,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  liveEntries,
  liveRenderer,
  liveScroll,
  liveStats,
  liveEvents,
  chatPreview,
  shareOverlay,
  resumeButton,
  newSessionButton,
  cwd = '',
  onSessionDataReload = () => {}
} = {}) {
  const document = documentImpl;
  const window = windowImpl;
  const location = locationImpl;
  const navigator = navigatorImpl;
  const marked = markedImpl;
  const fetch = fetchImpl;
  const EventSource = EventSourceImpl;
  const requestAnimationFrame = requestAnimationFrameImpl;
  const setTimeout = setTimeoutImpl;
  const clearTimeout = clearTimeoutImpl;
  const __piLiveEntries = liveEntries;
  const __piLiveRenderer = liveRenderer;
  const __piLiveScroll = liveScroll;
  const __piLiveStats = liveStats;
  const __piLiveEvents = liveEvents;
  const __piChatPreview = chatPreview;
  const __piShareOverlay = shareOverlay;
  const __piResumeButton = resumeButton;
  const __piNewSessionButton = newSessionButton;
    var LIVE_ENTRY_STATE = {
      seen: __piLiveEntries.createSeenEntrySet({ documentImpl: document }),
      liveRendered: new Set()
    };

    var liveRenderer = __piLiveRenderer.createLiveRenderer({ documentImpl: document, markedImpl: marked });
    var escapeHtml = function(t) {
      var d = document.createElement('div');
      d.textContent = t;
      return d.innerHTML;
    };
    var renderEntry = liveRenderer.renderEntry;
    var renderMarkdown = liveRenderer.renderMarkdown;

    // Follow mode (like terminal/chat)
    var FOLLOW = true;
    var followBtn = null;
    var pendingCount = 0;
    var forcePreviewFollowUntil = 0;

    function isAtBottom() {
      return __piLiveScroll.isAtBottom({ documentImpl: document, windowImpl: window });
    }

    function scrollToBottom(smooth) {
      return __piLiveScroll.scrollToBottom(smooth, { documentImpl: document, windowImpl: window });
    }

    function scrollElementAboveComposer(el, smooth) {
      return __piLiveScroll.scrollElementAboveComposer(el, smooth, { documentImpl: document, windowImpl: window });
    }

    function showFollowButton() {
      if (followBtn) {
        return;
      }
      followBtn = __piLiveScroll.createFollowButton({ documentImpl: document, requestAnimationFrameImpl: requestAnimationFrame, onClick: function() {
        FOLLOW = true;
        pendingCount = 0;
        scrollToBottom(true);
        hideFollowButton();
      }});
      __piLiveScroll.setFollowButtonText(followBtn, pendingCount);
    }

    function hideFollowButton() {
      if (!followBtn) return;
      __piLiveScroll.removeFollowButton(followBtn, { windowImpl: window });
      followBtn = null;
    }

    var lastScrollTop = 0;
    var contentEl = document.getElementById('content');

    function getScrollPosition() {
      var scrolled = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
      if (contentEl && contentEl.scrollHeight > contentEl.clientHeight) {
        scrolled = Math.max(scrolled, contentEl.scrollTop);
      }
      return scrolled;
    }

    if (typeof document !== 'undefined') {
      lastScrollTop = getScrollPosition();
    }

    function disableFollowOnUserInteraction(e) {
      if (e.type === 'keydown') {
        var scrollingKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
        if (scrollingKeys.indexOf(e.key) === -1) return;
      }
      forcePreviewFollowUntil = 0;
      if (isAtBottom()) {
        FOLLOW = true;
        hideFollowButton();
      } else {
        FOLLOW = false;
        showFollowButton();
      }
    }

    function onScroll() {
      var currentScroll = getScrollPosition();
      var scrolledUp = currentScroll < lastScrollTop;
      lastScrollTop = currentScroll;

      FOLLOW = isAtBottom();

      if (scrolledUp) {
        // User manually scrolled up; immediately release the forced follow behavior
        // so they can read previous messages without being yanked back down.
        forcePreviewFollowUntil = 0;
        FOLLOW = false;
      }

      if (FOLLOW) {
        hideFollowButton();
        pendingCount = 0;
      } else {
        showFollowButton();
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    if (contentEl) contentEl.addEventListener('scroll', onScroll, { passive: true });

    window.addEventListener('wheel', disableFollowOnUserInteraction, { passive: true });
    window.addEventListener('touchmove', disableFollowOnUserInteraction, { passive: true });
    window.addEventListener('keydown', disableFollowOnUserInteraction, { passive: true });

    function scrollAfterLayout(smooth, target) {
      requestAnimationFrame(function() {
        scrollElementAboveComposer(target, !!smooth);
        setTimeout(function() { scrollElementAboveComposer(target, !!smooth); }, 40);
      });
    }

    function forceFollowToBottom(smooth) {
      FOLLOW = true;
      pendingCount = 0;
      hideFollowButton();
      scrollAfterLayout(!!smooth);
    }

    window.addEventListener('pi-chat-message-sent', function(event) {
      forcePreviewFollowUntil = Date.now() + 30000;
      if (event && event.detail && event.detail.message) {
        renderPendingChat(event.detail.message);
      } else {
        forceFollowToBottom(true);
      }
    });

    scrollToBottom(false);

    function appendEntry(entry, allEntries) {
      return __piLiveEntries.appendEntry(entry, allEntries, LIVE_ENTRY_STATE, {
        documentImpl: document,
        windowImpl: window,
        renderEntry: renderEntry,
        applyToggleStateToNode: window.applyToggleStateToNode
      });
    }

    function upsertEntry(entry, allEntries) {
      return __piLiveEntries.upsertEntry(entry, allEntries, LIVE_ENTRY_STATE, {
        documentImpl: document,
        windowImpl: window,
        renderEntry: renderEntry,
        applyToggleStateToNode: window.applyToggleStateToNode
      });
    }

    function refreshEntriesAffectedByToolResult(toolResultEntry, allEntries) {
      return __piLiveEntries.refreshEntriesAffectedByToolResult(toolResultEntry, allEntries, LIVE_ENTRY_STATE, {
        documentImpl: document,
        windowImpl: window,
        renderEntry: renderEntry,
        applyToggleStateToNode: window.applyToggleStateToNode
      });
    }

    function updateStats(entries) {
      return __piLiveStats.updateStatsDom(entries, { documentImpl: document });
    }

    function updateTitle(name) {
      var title = String(name || '').trim();
      if (!title) return;
      var titleEl = document.getElementById('session-header-title');
      if (titleEl) titleEl.textContent = title;
      document.title = title;
    }

    var sessId = __piLiveEvents.getSessionIdFromLocation({ locationImpl: location });
    var es = null;
    var reconnectTimer = null;
    var reconnectAttempt = 0;

    var CHAT_PREVIEW_STATE = { chatPreviewEl: null, pendingUserEl: null };

    function clearChatPreview() {
      var statusEl = document.getElementById('pi-chat-status');
      var isChatRunning = statusEl && statusEl.classList.contains('running');
      var hasDoneClass = CHAT_PREVIEW_STATE.chatPreviewEl && CHAT_PREVIEW_STATE.chatPreviewEl.classList.contains('done');
      var keepAssistant = !!(isChatRunning && !hasDoneClass);

      return __piChatPreview.clearChatPreview(CHAT_PREVIEW_STATE, {
        keepAssistant: keepAssistant
      });
    }

    function finishChatPreview() {
      if (__piChatPreview.finishChatPreview) {
        __piChatPreview.finishChatPreview(CHAT_PREVIEW_STATE);
      }
    }

    function renderChatPreview(payload) {
      return __piChatPreview.renderChatPreview(payload, CHAT_PREVIEW_STATE, {
        documentImpl: document,
        windowImpl: window,
        renderMarkdown: renderMarkdown,
        shouldFollow: function() { return FOLLOW || Date.now() < forcePreviewFollowUntil; },
        forceFollowToBottom: forceFollowToBottom,
        scrollAfterLayout: scrollAfterLayout
      });
    }

    function renderPendingChat(message) {
      return __piChatPreview.renderPendingChat(message, CHAT_PREVIEW_STATE, {
        documentImpl: document,
        windowImpl: window,
        renderMarkdown: renderMarkdown,
        shouldFollow: function() { return FOLLOW || Date.now() < forcePreviewFollowUntil; },
        forceFollowToBottom: forceFollowToBottom,
        scrollAfterLayout: scrollAfterLayout
      });
    }

    function triggerReload() {
      return __piLiveEvents.handleSessionReload({
        sessionId: sessId,
        fetchImpl: fetch,
        entryState: LIVE_ENTRY_STATE,
        clearChatPreview: clearChatPreview,
        appendEntry: appendEntry,
        upsertEntry: upsertEntry,
        refreshEntriesAffectedByToolResult: refreshEntriesAffectedByToolResult,
        updateStats: updateStats,
        updateTitle: updateTitle,
        isFollowing: function() { return FOLLOW; },
        scrollAfterLayout: scrollAfterLayout,
        incrementPending: function(count) { pendingCount += count; },
        showFollowButton: showFollowButton,
        onReloaded: function(data) { onSessionDataReload(data); }
      }).catch(function(err){ console.error('Live update failed:', err); });
    }

    window.addEventListener('pi-worker-done', function() {
      // If the final filesystem reload is missed or delayed, don't leave the
      // streaming preview in its "working" state. Also proactively reconcile
      // from /api/session so canonical entries replace the preview.
      finishChatPreview();
      triggerReload();
    });

    function connect() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try { if (es) es.close(); } catch (_) {}
      es = __piLiveEvents.createSessionEventSource(sessId, { EventSourceImpl: EventSource });
      __piLiveEvents.wireSessionEvents({
        eventSource: es,
        onReload: triggerReload,
        onChatPreview: renderChatPreview,
        onError: function() {
          // EventSource fires onerror both for transient blips (browser
          // will auto-retry) and terminal closures (readyState===CLOSED,
          // e.g. when the device wakes from sleep). We handle the latter
          // by closing and scheduling a manual reconnect with backoff.
          if (!es || es.readyState !== 2 /* CLOSED */) return;
          scheduleReconnect();
        }
      });
      reconnectAttempt = 0;
    }

    function scheduleReconnect() {
      if (reconnectTimer) return;
      // 1s, 2s, 4s, … capped at 30s. Jitter avoids thundering herd if
      // many sessions reconnect simultaneously after a network blip.
      var base = Math.min(30000, 1000 * Math.pow(2, reconnectAttempt));
      var delay = base + Math.floor(Math.random() * 500);
      reconnectAttempt++;
      reconnectTimer = setTimeout(function() {
        reconnectTimer = null;
        connect();
        // Pull any entries we missed while disconnected.
        triggerReload();
      }, delay);
    }

    connect();

    // When the user unlocks the phone / refocuses the tab, the SSE
    // connection is often already dead (mobile browsers tear it down to
    // save power). Force a reconnect+reload so the view catches up
    // immediately instead of waiting for the next backoff tick.
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) return;
      if (!es || es.readyState === 2 /* CLOSED */) {
        reconnectAttempt = 0;
        connect();
        triggerReload();
      } else {
        // Connection still open — but we may have missed writes anyway
        // (the browser sometimes pauses delivery without closing).
        triggerReload();
      }
    });

    window.addEventListener('online', function() {
      reconnectAttempt = 0;
      connect();
      triggerReload();
    });

    // Share button
    var SHARE_OVERLAY_STATE = { shareOverlay: null, shareCopyHideTimer: null };
    __piShareOverlay.setupShareButton({
      documentImpl: document,
      fetchImpl: fetch,
      sessionId: sessId,
      state: SHARE_OVERLAY_STATE,
      escapeHtml: escapeHtml,
      navigatorImpl: navigator
    });

    // Terminal button
    __piResumeButton.setupResumeButton({
      documentImpl: document,
      navigatorImpl: navigator,
      state: {},
      setTimeoutImpl: setTimeout,
      clearTimeoutImpl: clearTimeout
    });

    // New session button
    __piNewSessionButton.setupNewSessionButton({
      documentImpl: document,
      fetchImpl: fetch,
      locationImpl: location,
      cwd: cwd,
      sessionId: sessId,
      state: {},
      setTimeoutImpl: setTimeout,
      clearTimeoutImpl: clearTimeout
    });
}
