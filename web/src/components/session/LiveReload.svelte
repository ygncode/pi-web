<script>
  // Live reload (SSE) — drives the streaming chat preview, follow/scroll, stats,
  // and reconciles the shared reactive model when the session JSONL changes. The
  // Svelte <SessionContent> owns #messages and re-renders from the model, so this
  // never patches the message DOM (reactive-only): on reload it reconciles the
  // model (window.__piReconcileEntries) and only tracks brand-new ids for the
  // follow/scroll/highlight decisions. Live-only: never imported by the static
  // export bundle.
  //
  // Absorbed from live-reload-runner.js during the Svelte migration teardown
  // (docs/dev/svelte-migration-plan.md §11). The pure SSE/scroll/stats/preview
  // primitives stay in live-events / live-scroll / live-stats / chat-preview.
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { escapeHtml } from '../../session/render/session-format.js';
  import { safeMarkedParse } from '../../session/render/markdown.js';
  import * as liveScroll from '../../session/live/live-scroll.js';
  import * as liveStats from '../../session/live/live-stats.js';
  import * as liveEvents from '../../session/live/live-events.js';
  import * as chatPreview from '../../session/live/chat-preview.js';

  onMount(() => {
    const documentImpl = document;
    const windowImpl = window;
    const model = windowImpl.__piSessionDataModel;
    globalThis.__PI_TEST_LIVE_RELOAD_HOOK__?.();

    const fetchImpl = windowImpl.fetch.bind(windowImpl);
    const requestAnimationFrame = windowImpl.requestAnimationFrame.bind(windowImpl);
    const setTimeout = windowImpl.setTimeout.bind(windowImpl);
    const clearTimeout = windowImpl.clearTimeout.bind(windowImpl);

    const cleanups = [];
    const on = (host, type, handler, opts) => {
      host.addEventListener(type, handler, opts);
      cleanups.push(() => host.removeEventListener(type, handler, opts));
    };

    // Markdown for the streaming preview — globally-configured (sanitized) marked
    // with an escapeHtml fallback (matches the former live-renderer.renderMarkdown).
    const renderMarkdown = (text) => {
      try { return safeMarkedParse(text, { marked }); }
      catch { return escapeHtml(text, { documentImpl }); }
    };

    // New-entry highlight (after Svelte renders the reactive path).
    function highlightNewEntry(node) {
      node.classList.add('new-entry-highlight');
      setTimeout(() => { node.classList.remove('new-entry-highlight'); }, 1500);
    }
    function highlightNewEntries(newIds) {
      requestAnimationFrame(() => {
        newIds.forEach((id) => {
          const el = documentImpl.getElementById('entry-' + id);
          if (el) highlightNewEntry(el);
        });
      });
    }

    // "seen" set seeded from the model (the DOM may not be flushed yet at startup).
    const LIVE_ENTRY_STATE = {
      seen: new Set((model?.entries || []).map((e) => e.id).filter(Boolean)),
      liveRendered: new Set(),
    };

    // ── Follow mode (like terminal/chat) ───────────────────────────────────────
    let FOLLOW = true;
    let followBtn = null;
    let pendingCount = 0;
    let forcePreviewFollowUntil = 0;

    const isAtBottom = () => liveScroll.isAtBottom({ documentImpl, windowImpl });
    const scrollToBottom = (smooth) => liveScroll.scrollToBottom(smooth, { documentImpl, windowImpl });
    const scrollElementAboveComposer = (el, smooth) => liveScroll.scrollElementAboveComposer(el, smooth, { documentImpl, windowImpl });

    function showFollowButton() {
      if (followBtn) return;
      followBtn = liveScroll.createFollowButton({
        documentImpl,
        requestAnimationFrameImpl: requestAnimationFrame,
        onClick: () => {
          FOLLOW = true;
          pendingCount = 0;
          scrollToBottom(true);
          hideFollowButton();
        },
      });
      liveScroll.setFollowButtonText(followBtn, pendingCount);
    }
    function hideFollowButton() {
      if (!followBtn) return;
      liveScroll.removeFollowButton(followBtn, { windowImpl });
      followBtn = null;
    }

    let lastScrollTop = 0;
    const contentEl = documentImpl.getElementById('content');

    function getScrollPosition() {
      let scrolled = windowImpl.scrollY || windowImpl.pageYOffset || documentImpl.documentElement.scrollTop || documentImpl.body.scrollTop;
      if (contentEl && contentEl.scrollHeight > contentEl.clientHeight) {
        scrolled = Math.max(scrolled, contentEl.scrollTop);
      }
      return scrolled;
    }
    lastScrollTop = getScrollPosition();

    function disableFollowOnUserInteraction(e) {
      if (e.type === 'keydown') {
        const scrollingKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
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
      const currentScroll = getScrollPosition();
      const scrolledUp = currentScroll < lastScrollTop;
      lastScrollTop = currentScroll;
      FOLLOW = isAtBottom();
      if (scrolledUp) {
        // User manually scrolled up; release the forced follow so they can read
        // previous messages without being yanked back down.
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

    on(windowImpl, 'scroll', onScroll, { passive: true });
    if (contentEl) on(contentEl, 'scroll', onScroll, { passive: true });
    on(windowImpl, 'wheel', disableFollowOnUserInteraction, { passive: true });
    on(windowImpl, 'touchmove', disableFollowOnUserInteraction, { passive: true });
    on(windowImpl, 'keydown', disableFollowOnUserInteraction, { passive: true });

    function scrollAfterLayout(smooth, target) {
      requestAnimationFrame(() => {
        scrollElementAboveComposer(target, !!smooth);
        setTimeout(() => { scrollElementAboveComposer(target, !!smooth); }, 40);
      });
    }
    function forceFollowToBottom(smooth) {
      FOLLOW = true;
      pendingCount = 0;
      hideFollowButton();
      scrollAfterLayout(!!smooth);
    }

    on(windowImpl, 'pi-chat-message-sent', (event) => {
      forcePreviewFollowUntil = Date.now() + 30000;
      if (event && event.detail && event.detail.message) {
        renderPendingChat(event.detail.message);
      } else {
        forceFollowToBottom(true);
      }
    });

    scrollToBottom(false);

    function updateStats(entries) {
      return liveStats.updateStatsDom(entries, { documentImpl });
    }
    function updateTitle(name) {
      const title = String(name || '').trim();
      if (!title) return;
      const titleEl = documentImpl.getElementById('session-header-title');
      if (titleEl) titleEl.textContent = title;
      documentImpl.title = title;
    }

    const sessId = liveEvents.getSessionIdFromLocation({ locationImpl: windowImpl.location });
    let es = null;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    // ── Streaming chat preview ─────────────────────────────────────────────────
    const CHAT_PREVIEW_STATE = { chatPreviewEl: null, pendingUserEl: null };

    function clearChatPreview() {
      const statusEl = documentImpl.getElementById('pi-chat-status');
      const isChatRunning = statusEl && statusEl.classList.contains('running');
      const hasDoneClass = CHAT_PREVIEW_STATE.chatPreviewEl && CHAT_PREVIEW_STATE.chatPreviewEl.classList.contains('done');
      const keepAssistant = !!(isChatRunning && !hasDoneClass);
      return chatPreview.clearChatPreview(CHAT_PREVIEW_STATE, { keepAssistant });
    }
    function finishChatPreview() {
      if (chatPreview.finishChatPreview) chatPreview.finishChatPreview(CHAT_PREVIEW_STATE);
    }
    const shouldFollow = () => FOLLOW || Date.now() < forcePreviewFollowUntil;
    function renderChatPreview(payload) {
      return chatPreview.renderChatPreview(payload, CHAT_PREVIEW_STATE, {
        documentImpl, windowImpl, renderMarkdown, shouldFollow, forceFollowToBottom, scrollAfterLayout,
      });
    }
    function renderPendingChat(message) {
      return chatPreview.renderPendingChat(message, CHAT_PREVIEW_STATE, {
        documentImpl, windowImpl, renderMarkdown, shouldFollow, forceFollowToBottom, scrollAfterLayout,
      });
    }

    // ── Reload (fetch /api/session → reconcile the model) ──────────────────────
    function triggerReload() {
      return liveEvents.handleSessionReload({
        sessionId: sessId,
        fetchImpl,
        entryState: LIVE_ENTRY_STATE,
        clearChatPreview,
        // Reactive mode: the Svelte model owns #messages, so no DOM patchers.
        updateStats,
        updateTitle,
        isFollowing: () => FOLLOW,
        scrollAfterLayout,
        incrementPending: (count) => { pendingCount += count; },
        showFollowButton,
        onReloaded: (data) => { windowImpl.__piReconcileEntries?.(data.entries); },
        onNewEntries: highlightNewEntries,
      }).catch((err) => { console.error('Live update failed:', err); });
    }

    on(windowImpl, 'pi-worker-done', () => {
      // If the final filesystem reload is missed/delayed, don't leave the
      // streaming preview "working"; proactively reconcile from /api/session.
      finishChatPreview();
      triggerReload();
    });

    function connect() {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      try { if (es) es.close(); } catch (_) {}
      es = liveEvents.createSessionEventSource(sessId, { EventSourceImpl: windowImpl.EventSource });
      liveEvents.wireSessionEvents({
        eventSource: es,
        onReload: triggerReload,
        onChatPreview: renderChatPreview,
        onAnnotations: (list) => windowImpl.__piAnnotationLayer?.setAnnotations(list),
        onError: () => {
          // EventSource onerror fires for transient blips (auto-retried) and
          // terminal closures (readyState===CLOSED, e.g. device wake). Handle
          // the latter by closing + scheduling a manual reconnect with backoff.
          if (!es || es.readyState !== 2 /* CLOSED */) return;
          scheduleReconnect();
        },
      });
      reconnectAttempt = 0;
    }

    function scheduleReconnect() {
      if (reconnectTimer) return;
      // 1s, 2s, 4s … capped at 30s, with jitter to avoid a thundering herd.
      const base = Math.min(30000, 1000 * Math.pow(2, reconnectAttempt));
      const delay = base + Math.floor(Math.random() * 500);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
        triggerReload();
      }, delay);
    }

    connect();

    // When the user unlocks the phone / refocuses the tab the SSE connection is
    // often already dead (mobile browsers tear it down). Force reconnect+reload.
    on(documentImpl, 'visibilitychange', () => {
      if (documentImpl.hidden) return;
      if (!es || es.readyState === 2 /* CLOSED */) {
        reconnectAttempt = 0;
        connect();
        triggerReload();
      } else {
        triggerReload();
      }
    });

    on(windowImpl, 'online', () => {
      reconnectAttempt = 0;
      connect();
      triggerReload();
    });

    return () => {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      try { if (es) es.close(); } catch (_) {}
      for (const fn of cleanups) fn();
    };
  });
</script>
