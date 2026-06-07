<script module>
  // SSE/scroll/stats primitives absorbed from live-events.js / live-scroll.js /
  // live-stats.js (Svelte migration teardown). Exported so their unit tests drive
  // them directly; the instance onMount below calls them. chat-preview stays a
  // shared module (also used by <BtwPopup>).
  import { icon, ArrowDown } from '../../shared/icons.js';

  // ── live-events ───────────────────────────────────────────────────────────
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
  onReloaded = () => {},
  onNewEntries = null
} = {}) {
  const response = await fetchImpl('/api/session?id=' + encodeURIComponent(sessionId));
  const data = await response.json();
  const entries = data.entries || [];
  onReloaded({ ...data, entries });
  if (typeof data.name === 'string' && data.name.trim()) {
    updateTitle(data.name);
  }
  let newCount = 0;

  // Two modes:
  //  • Imperative (appendEntry provided): patch #messages DOM directly — the
  //    legacy path, still covered by tests.
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
    if (isFollowing()) {
      scrollAfterLayout(true);
    } else {
      incrementPending(newCount);
      showFollowButton();
    }
  }

  // Reactive mode: once Svelte has rendered the new entries, flag them so the
  // caller can apply the new-entry highlight (the imperative path does this
  // inline via appendEntry → highlightNewEntry).
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

  // ── live-scroll ───────────────────────────────────────────────────────────

export function chatComposerHeight() {
  return 0;
}

export function isAtBottom({ documentImpl = document, windowImpl = window, threshold = 80 } = {}) {
  const de = documentImpl.documentElement;
  const body = documentImpl.body;
  const content = documentImpl.getElementById('content');

  // If the window has scrollable height, the main window is the active scroll container (Desktop).
  // Otherwise, #content is the active scroll container (Mobile).
  const isWindowScrollable = de.scrollHeight > windowImpl.innerHeight;

  if (isWindowScrollable) {
    const docHeight = Math.max(de.scrollHeight, body.scrollHeight);
    const scrolled = windowImpl.scrollY || windowImpl.pageYOffset || de.scrollTop || body.scrollTop;
    const viewport = windowImpl.innerHeight;
    const remaining = docHeight - scrolled - viewport;
    return remaining < threshold;
  }

  if (content && content.scrollHeight > content.clientHeight) {
    const contentRemaining = content.scrollHeight - content.scrollTop - content.clientHeight;
    return contentRemaining < threshold;
  }

  // Fallback to window measurements if content is not scrollable/present
  const docHeight = Math.max(de.scrollHeight, body.scrollHeight);
  const scrolled = windowImpl.scrollY || windowImpl.pageYOffset || de.scrollTop || body.scrollTop;
  const viewport = windowImpl.innerHeight;
  return (docHeight - scrolled - viewport) < threshold;
}

export function scrollToBottom(smooth, { documentImpl = document, windowImpl = window } = {}) {
  const content = documentImpl.getElementById('content');
  if (content && content.scrollHeight > content.clientHeight) {
    content.scrollTo({ top: content.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }
  windowImpl.scrollTo({ top: Math.max(documentImpl.documentElement.scrollHeight, documentImpl.body.scrollHeight), behavior: smooth ? 'smooth' : 'auto' });
}

export function scrollElementAboveComposer(el, smooth, { documentImpl = document, windowImpl = window } = {}) {
  if (!el) {
    scrollToBottom(smooth, { documentImpl, windowImpl });
    return;
  }
  const gap = chatComposerHeight({ documentImpl }) + 24;
  const content = documentImpl.getElementById('content');
  if (content && content.contains(el)) {
    const contentRect = content.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.bottom - (contentRect.bottom - gap);
    if (delta > 0) {
      content.scrollTo({ top: content.scrollTop + delta, behavior: smooth ? 'smooth' : 'auto' });
    }
  }
  const rect = el.getBoundingClientRect();
  const viewportDelta = rect.bottom - (windowImpl.innerHeight - gap);
  if (viewportDelta > 0) {
    windowImpl.scrollTo({ top: (windowImpl.scrollY || windowImpl.pageYOffset) + viewportDelta, behavior: smooth ? 'smooth' : 'auto' });
  }
}

export function createFollowButton({ documentImpl = document, requestAnimationFrameImpl = requestAnimationFrame, onClick } = {}) {
  const button = documentImpl.createElement('button');
  button.className = 'follow-button';
  button.setAttribute('aria-label', 'Scroll to bottom');
  button.innerHTML = icon(ArrowDown, { size: 18 });
  documentImpl.body.appendChild(button);
  requestAnimationFrameImpl(() => { button.classList.add('visible'); });
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

export function setFollowButtonText(button, pendingCount) {
  if (button) button.innerHTML = icon(ArrowDown, { size: 18 });
}

export function removeFollowButton(button, { windowImpl = window } = {}) {
  if (!button) return;
  button.classList.remove('visible');
  windowImpl.setTimeout(() => {
    if (button.parentNode) button.parentNode.removeChild(button);
  }, 200);
}

  // ── live-stats ────────────────────────────────────────────────────────────
export function formatTokens(n) {
  if (n < 1000) return n.toString();
  if (n < 10000) return (n / 1000).toFixed(1) + 'k';
  if (n < 1000000) return Math.round(n / 1000) + 'k';
  return (n / 1000000).toFixed(1) + 'M';
}

export function computeLiveStats(entries = []) {
  const stats = {
    user: 0,
    assistant: 0,
    toolCalls: 0,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    models: new Set()
  };
  entries.forEach((entry) => {
    if (entry.type !== 'message' || !entry.message) return;
    const message = entry.message;
    if (message.role === 'user') stats.user++;
    if (message.role === 'assistant') {
      stats.assistant++;
      if (message.model) stats.models.add(message.provider ? message.provider + '/' + message.model : message.model);
      if (message.usage) {
        stats.tokens.input += message.usage.input || 0;
        stats.tokens.output += message.usage.output || 0;
        stats.tokens.cacheRead += message.usage.cacheRead || 0;
        stats.tokens.cacheWrite += message.usage.cacheWrite || 0;
        if (message.usage.cost) {
          stats.cost.input += message.usage.cost.input || 0;
          stats.cost.output += message.usage.cost.output || 0;
          stats.cost.cacheRead += message.usage.cost.cacheRead || 0;
          stats.cost.cacheWrite += message.usage.cost.cacheWrite || 0;
        }
      }
      stats.toolCalls += (message.content || []).filter((block) => block.type === 'toolCall').length;
    }
  });
  return stats;
}

export function updateStatsDom(entries, { documentImpl = document } = {}) {
  const stats = computeLiveStats(entries);
  const totalCost = stats.cost.input + stats.cost.output + stats.cost.cacheRead + stats.cost.cacheWrite;
  const headerInfo = documentImpl.querySelector('.header-info');
  if (!headerInfo) return false;

  const messageParts = [];
  if (stats.user) messageParts.push(stats.user + ' user');
  if (stats.assistant) messageParts.push(stats.assistant + ' assistant');

  headerInfo.querySelectorAll('.info-item').forEach((row) => {
    const label = row.querySelector('.info-label');
    const value = row.querySelector('.info-value');
    if (!label || !value) return;
    const text = label.textContent;
    if (text.includes('Messages:')) value.textContent = messageParts.join(', ') || '0';
    if (text.includes('Tool Calls:')) value.textContent = stats.toolCalls;
    if (text.includes('Models:')) value.textContent = Array.from(stats.models).join(', ') || 'unknown';
    if (text.includes('Tokens:')) {
      const tokenParts = [];
      if (stats.tokens.input) tokenParts.push('↑' + formatTokens(stats.tokens.input));
      if (stats.tokens.output) tokenParts.push('↓' + formatTokens(stats.tokens.output));
      if (stats.tokens.cacheRead) tokenParts.push('R' + formatTokens(stats.tokens.cacheRead));
      if (stats.tokens.cacheWrite) tokenParts.push('W' + formatTokens(stats.tokens.cacheWrite));
      value.textContent = tokenParts.join(' ') || '0';
    }
    if (text.includes('Cost:')) value.textContent = '$' + totalCost.toFixed(3);
  });
  return true;
}
</script>

<script>
  // Live reload (SSE) — drives the streaming chat preview, follow/scroll, stats,
  // and reconciles the shared reactive model when the session JSONL changes. The
  // Svelte <SessionContent> owns #messages and re-renders from the model, so this
  // never patches the message DOM (reactive-only): on reload it reconciles the
  // model (window.__piReconcileEntries) and only tracks brand-new ids for the
  // follow/scroll/highlight decisions. Live-only: never imported by the static
  // export bundle.
  //
  // Absorbed from live-reload-runner.js + live-events/live-scroll/live-stats
  // during the Svelte migration teardown (docs/dev/svelte-migration-plan.md §11).
  // Those SSE/scroll/stats primitives now live in the <script module> above
  // (exported for their unit tests). chat-preview stays a shared module — it's
  // also used by <BtwPopup>.
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { escapeHtml } from '../../session/render/session-format.js';
  import { safeMarkedParse } from '../../session/render/markdown.js';
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

    // The absorbed scroll helpers (module scope) default to the real document /
    // window, so they're called directly — no per-call wrappers.
    function showFollowButton() {
      if (followBtn) return;
      followBtn = createFollowButton({
        documentImpl,
        requestAnimationFrameImpl: requestAnimationFrame,
        onClick: () => {
          FOLLOW = true;
          pendingCount = 0;
          scrollToBottom(true);
          hideFollowButton();
        },
      });
      setFollowButtonText(followBtn, pendingCount);
    }
    function hideFollowButton() {
      if (!followBtn) return;
      removeFollowButton(followBtn, { windowImpl });
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
      return updateStatsDom(entries, { documentImpl });
    }
    function updateTitle(name) {
      const title = String(name || '').trim();
      if (!title) return;
      const titleEl = documentImpl.getElementById('session-header-title');
      if (titleEl) titleEl.textContent = title;
      documentImpl.title = title;
    }

    const sessId = getSessionIdFromLocation({ locationImpl: windowImpl.location });
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
      return handleSessionReload({
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
      es = createSessionEventSource(sessId, { EventSourceImpl: windowImpl.EventSource });
      wireSessionEvents({
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
