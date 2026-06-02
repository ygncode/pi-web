// The "btw" floating window: a draggable, resizable scratch-chat opened from
// the git bar. Each session page has its own btw session, persisted server-side
// in the sqlite btw_sessions table keyed by the parent session id, so the
// conversation survives reloads AND stays in sync across every device viewing
// the same page in realtime. The window itself is built entirely in JS, so the
// export snapshot (no composer/git bar) never includes it.
//
// Backend contract (parent = the session page this window was opened from):
//   GET  /api/btw?parent=<pid> -> { sessionId }          active btw for parent (or "")
//   POST /api/btw/new {path,parent} -> { id }            create + adopt a new btw session
//   POST /api/chat?id=<id>   (FormData message)          send a message
//   POST /api/chat/cancel?id=<id>                        cancel the running turn
//   GET  /api/worker-status?id=<id> -> { state }         idle|running|error
//   GET  /api/session?id=<id>-> { entries, ... }         transcript
//   /events?id=<id>          SSE: "reload" + "chat-preview" {content,done}
//   /events?id=<pid>         SSE: "btw-changed" {sessionId}  per-parent pointer sync

import { marked } from 'marked';
import { safeMarkedParse } from '../render/markdown.js';
import { formatToolCall } from '../render/session-format.js';
import { getSpinnerConfig } from './chat-preview.js';

const POS_KEY = 'pi-btw:window';
// Sentinel matching the server's btwGlobalParent for a btw opened with no parent
// session. Today every page with a btw button has a parent id, so this is just a
// safety fallback (and the migration home for the legacy single global btw).
const GLOBAL_PARENT = '__global__';

export function setupBtwPopup({
  documentImpl = document,
  windowImpl = window,
  fetchImpl,
  EventSourceImpl,
  cwd = '',
  parentId = '',
  renderMarkdown,
} = {}) {
  const button = documentImpl.getElementById('pi-btw-button');
  if (!button) return null;

  // The SSE topic / query key identifying this window's parent session.
  const parent = parentId || GLOBAL_PARENT;

  // On phones the floating window and the main chat composer fight for the same
  // cramped screen, so we keep them mutually exclusive there.
  const isMobile = () =>
    !!(windowImpl.matchMedia && windowImpl.matchMedia('(hover: none) and (pointer: coarse)').matches);

  const doFetch = fetchImpl || windowImpl.fetch.bind(windowImpl);
  const ES = EventSourceImpl || windowImpl.EventSource;
  const setInterval = windowImpl.setInterval.bind(windowImpl);
  const clearInterval = windowImpl.clearInterval.bind(windowImpl);
  const toHtml =
    renderMarkdown ||
    ((text) => {
      try {
        return safeMarkedParse(String(text == null ? '' : text), { marked });
      } catch (_) {
        return escape(text);
      }
    });

  let win = null;
  let els = null;
  let sessionId = '';
  let eventSource = null; // per-session: messages
  let globalSource = null; // global: btw pointer changes
  let entries = [];
  let pendingUser = null; // optimistic user message awaiting canonical reload
  let streamingText = ''; // live assistant text from chat-preview
  let running = false; // worker is generating
  let statusTimer = null;
  let spinnerTimer = null;
  let spinnerFrame = 0;
  let spinnerConfig = getSpinnerConfig(windowImpl);
  let lastSentAt = 0; // grace window: a freshly-sent turn shows "running" before
  // the worker has actually transitioned out of idle.

  // ── persisted window geometry / open-state ──
  function loadGeom() {
    try {
      const raw = windowImpl.localStorage?.getItem(POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }
  function saveGeom(patch) {
    try {
      const cur = loadGeom() || {};
      windowImpl.localStorage?.setItem(POS_KEY, JSON.stringify({ ...cur, ...patch }));
    } catch (_) {
      /* localStorage unavailable */
    }
  }

  function escape(text) {
    const div = documentImpl.createElement('div');
    div.textContent = String(text == null ? '' : text);
    return div.innerHTML;
  }

  function buildWindow() {
    const root = documentImpl.createElement('div');
    root.className = 'pi-btw-window';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'btw');
    root.hidden = true;

    root.innerHTML = `
      <div class="pi-btw-header">
        <span class="pi-btw-title">btw</span>
        <div class="pi-btw-actions">
          <button type="button" class="pi-btw-new" title="New btw chat">new</button>
          <button type="button" class="pi-btw-close" aria-label="Close">×</button>
        </div>
      </div>
      <div class="pi-btw-body" id="pi-btw-body"></div>
      <form class="pi-btw-input-row" id="pi-btw-form">
        <input type="text" class="pi-btw-input" id="pi-btw-input" placeholder="Type something..." autocomplete="off" />
        <button type="button" class="pi-btw-send" id="pi-btw-send" aria-label="Send">▷</button>
      </form>
    `;

    documentImpl.body.appendChild(root);

    els = {
      header: root.querySelector('.pi-btw-header'),
      newBtn: root.querySelector('.pi-btw-new'),
      closeBtn: root.querySelector('.pi-btw-close'),
      body: root.querySelector('#pi-btw-body'),
      form: root.querySelector('#pi-btw-form'),
      input: root.querySelector('#pi-btw-input'),
      send: root.querySelector('#pi-btw-send'),
    };

    els.closeBtn.addEventListener('click', () => close());
    els.newBtn.addEventListener('click', () => startNewSession());
    els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitMessage();
    });
    els.send.addEventListener('click', () => {
      if (running) cancel();
      else submitMessage();
    });
    enableDrag(root, els.header);
    persistResize(root);

    const geom = loadGeom();
    if (geom && geom.width) root.style.width = `${geom.width}px`;
    if (geom && geom.height) root.style.height = `${geom.height}px`;

    return root;
  }

  // ── transcript rendering (markdown + tool calls) ──
  function atBottom() {
    if (!els) return true;
    const b = els.body;
    return b.scrollHeight - b.scrollTop - b.clientHeight < 40;
  }
  function scrollToBottom() {
    if (els) els.body.scrollTop = els.body.scrollHeight;
  }

  // Render one transcript entry to HTML, or '' to skip it.
  function renderEntry(entry) {
    if (!entry || entry.type !== 'message' || !entry.message) return '';
    const msg = entry.message;

    if (msg.role === 'user') {
      const text = contentText(msg.content).trim();
      if (!text) return '';
      return `<div class="pi-btw-msg user"><div class="pi-btw-md">${toHtml(text)}</div></div>`;
    }

    if (msg.role === 'assistant') {
      const parts = [];
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      blocks.forEach((block) => {
        if (block.type === 'text' && block.text && block.text.trim()) {
          parts.push(`<div class="pi-btw-md">${toHtml(block.text)}</div>`);
        } else if (block.type === 'toolCall') {
          parts.push(
            `<div class="pi-btw-tool">${escape(formatToolCall(block.name, block.arguments || {}))}</div>`
          );
        }
      });
      // Plain-string assistant content (older entries) has no blocks.
      if (parts.length === 0 && typeof msg.content === 'string' && msg.content.trim()) {
        parts.push(`<div class="pi-btw-md">${toHtml(msg.content)}</div>`);
      }
      if (parts.length === 0) return '';
      return `<div class="pi-btw-msg assistant">${parts.join('')}</div>`;
    }

    if (msg.role === 'bashExecution' && msg.command) {
      return `<div class="pi-btw-msg assistant"><div class="pi-btw-tool">$ ${escape(msg.command)}</div></div>`;
    }

    return '';
  }

  function contentText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((c) => c && c.type === 'text' && c.text)
        .map((c) => c.text)
        .join('');
    }
    return '';
  }

  function spinnerHtml() {
    const frame = spinnerConfig.frames[spinnerFrame % spinnerConfig.frames.length] || '';
    return `<span class="pi-btw-spinner" style="font-family:${spinnerConfig.fontFamily};width:${spinnerConfig.width}">${escape(
      frame
    )}</span>`;
  }

  function render() {
    if (!els) return;
    const stick = atBottom();
    const rows = [];

    entries.forEach((entry) => {
      const html = renderEntry(entry);
      if (html) rows.push(html);
    });

    if (pendingUser) {
      rows.push(`<div class="pi-btw-msg user pending"><div class="pi-btw-md">${toHtml(pendingUser)}</div></div>`);
    }

    // Working / streaming bubble while the worker is generating.
    if (running || streamingText) {
      const inner = streamingText
        ? `<div class="pi-btw-md">${toHtml(streamingText)}</div>`
        : `<span class="pi-btw-working">${spinnerHtml()}<span class="pi-btw-working-label">Working…</span></span>`;
      rows.push(`<div class="pi-btw-msg assistant working">${inner}</div>`);
    }

    if (rows.length === 0) {
      els.body.innerHTML = sessionId
        ? '<div class="pi-btw-empty">No messages yet — say hello.</div>'
        : '<div class="pi-btw-empty">Type a message to start a btw chat, or hit “new”.</div>';
    } else {
      els.body.innerHTML = rows.join('');
    }

    if (stick) scrollToBottom();
  }

  // ── data loading + live updates ──
  function loadTranscript() {
    if (!sessionId) {
      entries = [];
      render();
      return Promise.resolve();
    }
    return doFetch('/api/session?id=' + encodeURIComponent(sessionId))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        entries = data.entries || [];
        if (pendingUser) {
          const arrived = entries.some(
            (e) =>
              e &&
              e.type === 'message' &&
              e.message &&
              e.message.role === 'user' &&
              contentText(e.message.content).trim() === pendingUser
          );
          if (arrived) pendingUser = null;
        }
        render();
      })
      .catch(() => {});
  }

  function subscribe() {
    unsubscribe();
    if (!sessionId || !ES) return;
    eventSource = new ES('/events?id=' + encodeURIComponent(sessionId));
    eventSource.onmessage = (e) => {
      if (e.data === 'reload') {
        streamingText = '';
        loadTranscript();
        refreshStatus();
      }
    };
    eventSource.addEventListener('chat-preview', (e) => {
      try {
        const p = JSON.parse(e.data);
        streamingText = p.content || '';
        if (!p.done) setRunning(true);
        render();
      } catch (_) {
        /* ignore malformed preview */
      }
    });
    eventSource.onerror = () => {};
  }
  function unsubscribe() {
    if (eventSource) {
      try {
        eventSource.close();
      } catch (_) {
        /* already closed */
      }
      eventSource = null;
    }
  }

  // Listen on the parent's topic so a "new" on another device viewing the same
  // page switches us over.
  function subscribeGlobal() {
    if (globalSource || !ES) return;
    globalSource = new ES('/events?id=' + encodeURIComponent(parent));
    globalSource.addEventListener('btw-changed', (e) => {
      try {
        const p = JSON.parse(e.data);
        const id = p.sessionId || '';
        if (id !== sessionId) setSession(id);
      } catch (_) {
        /* ignore */
      }
    });
    globalSource.onerror = () => {};
  }
  function unsubscribeGlobal() {
    if (globalSource) {
      try {
        globalSource.close();
      } catch (_) {
        /* already closed */
      }
      globalSource = null;
    }
  }

  // ── worker running state (spinner + cancel button) ──
  function startSpinner() {
    if (spinnerTimer) return;
    spinnerConfig = getSpinnerConfig(windowImpl);
    spinnerTimer = setInterval(() => {
      spinnerFrame += 1;
      if (!win || win.hidden) return;
      const el = win.querySelector('.pi-btw-spinner');
      if (el) {
        el.textContent = spinnerConfig.frames[spinnerFrame % spinnerConfig.frames.length] || '';
      }
    }, spinnerConfig.interval || 100);
  }
  function stopSpinner() {
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
    }
  }

  function setRunning(on) {
    const was = running;
    running = !!on;
    if (els && els.send) {
      els.send.textContent = running ? '◼' : '▷';
      els.send.classList.toggle('cancel', running);
      els.send.setAttribute('aria-label', running ? 'Cancel' : 'Send');
      els.send.title = running ? 'Stop' : 'Send';
    }
    if (running) startSpinner();
    else stopSpinner();
    if (running && !streamingText && !was) render();
    if (!running) {
      streamingText = '';
      if (was) render();
    }
  }

  function refreshStatus() {
    if (!sessionId) return Promise.resolve();
    return doFetch('/api/worker-status?id=' + encodeURIComponent(sessionId))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.state === 'running') setRunning(true);
        else if (data.state === 'idle') {
          // Ignore a transient idle right after sending: the worker may not have
          // spun up yet. SSE/the next poll will confirm the real state.
          if (Date.now() - lastSentAt > 3000) setRunning(false);
        } else if (data.state === 'error') setRunning(false);
      })
      .catch(() => {});
  }

  function startStatusPolling() {
    if (statusTimer) return;
    statusTimer = setInterval(() => refreshStatus(), 1500);
  }
  function stopStatusPolling() {
    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = null;
    }
  }

  function cancel() {
    if (!sessionId) return;
    doFetch('/api/chat/cancel?id=' + encodeURIComponent(sessionId), { method: 'POST' })
      .then(() => setRunning(false))
      .catch(() => {});
  }

  // ── actions ──
  function setSession(id) {
    sessionId = id || '';
    entries = [];
    pendingUser = null;
    streamingText = '';
    setRunning(false);
    if (sessionId) {
      subscribe();
      loadTranscript();
      refreshStatus();
    } else {
      unsubscribe();
      render();
    }
  }

  function createSession() {
    return doFetch('/api/btw/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: cwd, parent: parentId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) {
          setSession(data.id);
          return data.id;
        }
        throw new Error(data && data.error ? data.error : 'failed to create btw session');
      });
  }

  // Lazy "new": clear the window to its empty state without creating a session
  // file. The fresh btw session is created on the first message send (see
  // submitMessage), so pressing "new" and never typing leaves no empty
  // throwaway behind — and the server's active pointer only moves once a real
  // message exists.
  function startNewSession() {
    setSession('');
    if (els) els.input.focus();
  }

  async function submitMessage() {
    const message = els.input.value.trim();
    if (!message) return;

    els.input.value = '';
    pendingUser = message;
    lastSentAt = Date.now();
    render();

    try {
      if (!sessionId) await createSession();
      // createSession() runs setSession() which clears optimistic state; re-show
      // the pending bubble so it stays visible until the canonical reload.
      pendingUser = message;
      setRunning(true);
      render();
      const body = new windowImpl.FormData();
      body.set('message', message);
      const resp = await doFetch('/api/chat?id=' + encodeURIComponent(sessionId), {
        method: 'POST',
        body,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'chat request failed');
    } catch (err) {
      pendingUser = null;
      setRunning(false);
      els.input.value = message;
      render();
    }
  }

  // ── drag (move) + resize persistence ──
  function enableDrag(root, handle) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    function onMove(e) {
      if (!dragging) return;
      const vw = windowImpl.innerWidth || 0;
      const vh = windowImpl.innerHeight || 0;
      const rect = root.getBoundingClientRect();
      const left = Math.max(0, Math.min(originLeft + (e.clientX - startX), vw - rect.width));
      const top = Math.max(0, Math.min(originTop + (e.clientY - startY), vh - rect.height));
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
      saveGeom({ left, top });
    }
    function onUp() {
      dragging = false;
      documentImpl.removeEventListener('pointermove', onMove);
      documentImpl.removeEventListener('pointerup', onUp);
    }
    handle.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.closest && e.target.closest('.pi-btw-actions')) return;
      dragging = true;
      const rect = root.getBoundingClientRect();
      originLeft = rect.left;
      originTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      documentImpl.addEventListener('pointermove', onMove);
      documentImpl.addEventListener('pointerup', onUp);
    });
  }

  function persistResize(root) {
    if (!windowImpl.ResizeObserver) return;
    let raf = 0;
    const ro = new windowImpl.ResizeObserver(() => {
      if (raf) windowImpl.cancelAnimationFrame?.(raf);
      raf = windowImpl.requestAnimationFrame
        ? windowImpl.requestAnimationFrame(() => {
            saveGeom({ width: root.offsetWidth, height: root.offsetHeight });
          })
        : 0;
    });
    ro.observe(root);
  }

  function placeInitial(root) {
    const geom = loadGeom();
    if (geom && typeof geom.left === 'number' && typeof geom.top === 'number') {
      root.style.left = `${geom.left}px`;
      root.style.top = `${geom.top}px`;
      return;
    }
    const vw = windowImpl.innerWidth || 0;
    const vh = windowImpl.innerHeight || 0;
    const rect = root.getBoundingClientRect();
    const left = Math.max(0, (vw - rect.width) / 2);
    const top = Math.max(0, vh - rect.height - 90);
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    saveGeom({ left, top });
  }

  function open() {
    if (!win) win = buildWindow();
    win.hidden = false;
    placeInitial(win);
    button.setAttribute('aria-expanded', 'true');
    saveGeom({ open: true });
    subscribeGlobal();
    startStatusPolling();
    // Sync to this parent's persisted server-side btw session each time we open.
    doFetch('/api/btw?parent=' + encodeURIComponent(parent))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const id = data && data.sessionId ? data.sessionId : '';
        if (id !== sessionId) setSession(id);
        else if (id) {
          loadTranscript();
          refreshStatus();
        } else render();
      })
      .catch(() => render());
    if (els) els.input.focus();
  }

  function close() {
    if (win) win.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    saveGeom({ open: false });
    unsubscribe();
    unsubscribeGlobal();
    stopStatusPolling();
    stopSpinner();
  }

  function toggle() {
    if (win && !win.hidden) close();
    else open();
  }

  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });

  // On mobile, focusing the main chat composer should never leave the btw
  // window covering it — get out of the way.
  const composerTextarea = documentImpl.getElementById('pi-chat-message');
  if (composerTextarea) {
    composerTextarea.addEventListener('focus', () => {
      if (isMobile() && win && !win.hidden) close();
    });
  }

  // Auto-reopen if it was open before a reload, so the chat "comes back" — but
  // not on mobile, where it would cover the composer unexpectedly.
  const initialGeom = loadGeom();
  if (initialGeom && initialGeom.open && !isMobile()) open();

  return { open, close, toggle };
}
