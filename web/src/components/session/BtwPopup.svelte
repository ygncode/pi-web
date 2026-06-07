<script>
  // The "btw" floating, draggable, resizable scratch-chat opened from the git
  // bar (#pi-btw-button, in <ChatComposer>). Its own per-parent btw session is
  // persisted server-side and synced over SSE. The transcript renders reactively;
  // drag/resize/SSE/status-polling/submit stay imperative. Live-only — never in
  // the export bundle. See docs/sequence-flows/btw.md.
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { safeMarkedParse } from '../../session/render/markdown.js';
  import { formatToolCall } from '../../session/render/session-format.js';
  import { getSpinnerConfig } from '../../session/live/chat-preview.js';
  import { t } from '../../shared/i18n.js';

  let { cwd = '', parentId = '' } = $props();

  const POS_KEY = 'pi-btw:window';
  const GLOBAL_PARENT = '__global__';

  let open = $state(false);
  let entries = $state([]);
  let pendingUser = $state(null);
  let streamingText = $state('');
  let running = $state(false);
  let sessionId = $state('');
  let spinnerChar = $state('');
  let spinnerStyle = $state('');

  let winEl, headerEl, bodyEl, inputEl;
  // Non-reactive runtime handles.
  let btnEl = null;
  let eventSource = null;
  let globalSource = null;
  let statusTimer = null;
  let spinnerTimer = null;
  let spinnerFrame = 0;
  let spinnerConfig = null;
  let lastSentAt = 0;
  let nearBottom = true;

  const parentTopic = () => parentId || GLOBAL_PARENT;
  const isMobile = () => !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  const doFetch = (...args) => window.fetch(...args);

  function escapeText(text) {
    const d = document.createElement('div');
    d.textContent = String(text == null ? '' : text);
    return d.innerHTML;
  }
  function toHtml(text) {
    try {
      return safeMarkedParse(String(text == null ? '' : text), { marked });
    } catch {
      return escapeText(text);
    }
  }
  function contentText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.filter((c) => c && c.type === 'text' && c.text).map((c) => c.text).join('');
    }
    return '';
  }

  // Structured render of one transcript entry, or null to skip it.
  function renderEntryParts(entry) {
    if (!entry || entry.type !== 'message' || !entry.message) return null;
    const msg = entry.message;
    if (msg.role === 'user') {
      const text = contentText(msg.content).trim();
      if (!text) return null;
      return { role: 'user', parts: [{ kind: 'md', html: toHtml(text) }] };
    }
    if (msg.role === 'assistant') {
      const parts = [];
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      blocks.forEach((block) => {
        if (block.type === 'text' && block.text && block.text.trim()) parts.push({ kind: 'md', html: toHtml(block.text) });
        else if (block.type === 'toolCall') parts.push({ kind: 'tool', text: formatToolCall(block.name, block.arguments || {}) });
      });
      if (parts.length === 0 && typeof msg.content === 'string' && msg.content.trim()) parts.push({ kind: 'md', html: toHtml(msg.content) });
      if (parts.length === 0) return null;
      return { role: 'assistant', parts };
    }
    if (msg.role === 'bashExecution' && msg.command) {
      return { role: 'assistant', parts: [{ kind: 'tool', text: `$ ${msg.command}` }] };
    }
    return null;
  }

  const renderedEntries = $derived(entries.map(renderEntryParts).filter(Boolean));
  const isEmpty = $derived(renderedEntries.length === 0 && !pendingUser && !(running || streamingText));

  // ── geometry persistence ──
  function loadGeom() {
    try {
      const raw = window.localStorage?.getItem(POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function saveGeom(patch) {
    try {
      const cur = loadGeom() || {};
      window.localStorage?.setItem(POS_KEY, JSON.stringify({ ...cur, ...patch }));
    } catch { /* unavailable */ }
  }

  function atBottom() {
    if (!bodyEl) return true;
    return bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 40;
  }
  function scrollToBottom() {
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  // ── data loading + live updates ──
  function loadTranscript() {
    if (!sessionId) { entries = []; return Promise.resolve(); }
    return doFetch('/api/session?id=' + encodeURIComponent(sessionId))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        entries = data.entries || [];
        if (pendingUser) {
          const arrived = entries.some((e) =>
            e && e.type === 'message' && e.message && e.message.role === 'user'
            && contentText(e.message.content).trim() === pendingUser);
          if (arrived) pendingUser = null;
        }
      })
      .catch(() => {});
  }

  function subscribe() {
    unsubscribe();
    const ES = window.EventSource;
    if (!sessionId || !ES) return;
    eventSource = new ES('/events?id=' + encodeURIComponent(sessionId));
    eventSource.onmessage = (e) => {
      if (e.data === 'reload') { streamingText = ''; loadTranscript(); refreshStatus(); }
    };
    eventSource.addEventListener('chat-preview', (e) => {
      try {
        const p = JSON.parse(e.data);
        streamingText = p.content || '';
        if (!p.done) setRunning(true);
      } catch { /* ignore malformed preview */ }
    });
    eventSource.onerror = () => {};
  }
  function unsubscribe() {
    if (eventSource) { try { eventSource.close(); } catch { /* closed */ } eventSource = null; }
  }
  function subscribeGlobal() {
    const ES = window.EventSource;
    if (globalSource || !ES) return;
    globalSource = new ES('/events?id=' + encodeURIComponent(parentTopic()));
    globalSource.addEventListener('btw-changed', (e) => {
      try {
        const p = JSON.parse(e.data);
        const id = p.sessionId || '';
        if (id !== sessionId) setSession(id);
      } catch { /* ignore */ }
    });
    globalSource.onerror = () => {};
  }
  function unsubscribeGlobal() {
    if (globalSource) { try { globalSource.close(); } catch { /* closed */ } globalSource = null; }
  }

  // ── worker running state (spinner + cancel button) ──
  function startSpinner() {
    if (spinnerTimer) return;
    spinnerConfig = getSpinnerConfig(window);
    spinnerStyle = `font-family:${spinnerConfig.fontFamily};width:${spinnerConfig.width}`;
    spinnerChar = spinnerConfig.frames[spinnerFrame % spinnerConfig.frames.length] || '';
    spinnerTimer = window.setInterval(() => {
      spinnerFrame += 1;
      spinnerChar = spinnerConfig.frames[spinnerFrame % spinnerConfig.frames.length] || '';
    }, spinnerConfig.interval || 100);
  }
  function stopSpinner() {
    if (spinnerTimer) { window.clearInterval(spinnerTimer); spinnerTimer = null; }
  }
  function setRunning(on) {
    running = !!on;
    if (running) startSpinner();
    else { stopSpinner(); streamingText = ''; }
  }

  function refreshStatus() {
    if (!sessionId) return Promise.resolve();
    return doFetch('/api/worker-status?id=' + encodeURIComponent(sessionId))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.state === 'running') setRunning(true);
        else if (data.state === 'idle') { if (Date.now() - lastSentAt > 3000) setRunning(false); }
        else if (data.state === 'error') setRunning(false);
      })
      .catch(() => {});
  }
  function startStatusPolling() {
    if (statusTimer) return;
    statusTimer = window.setInterval(() => refreshStatus(), 1500);
  }
  function stopStatusPolling() {
    if (statusTimer) { window.clearInterval(statusTimer); statusTimer = null; }
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
    if (sessionId) { subscribe(); loadTranscript(); refreshStatus(); }
    else { unsubscribe(); }
  }
  function createSession() {
    return doFetch('/api/btw/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: cwd, parent: parentId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) { setSession(data.id); return data.id; }
        throw new Error(data && data.error ? data.error : 'failed to create btw session');
      });
  }
  // Lazy "new": clear to the empty state without creating a session file.
  function startNewSession() {
    setSession('');
    inputEl?.focus();
  }
  async function submitMessage() {
    const message = inputEl ? inputEl.value.trim() : '';
    if (!message) return;
    inputEl.value = '';
    pendingUser = message;
    lastSentAt = Date.now();
    try {
      if (!sessionId) await createSession();
      // createSession() runs setSession() which clears optimistic state; re-show.
      pendingUser = message;
      setRunning(true);
      const body = new window.FormData();
      body.set('message', message);
      const resp = await doFetch('/api/chat?id=' + encodeURIComponent(sessionId), { method: 'POST', body });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'chat request failed');
    } catch {
      pendingUser = null;
      setRunning(false);
      if (inputEl) inputEl.value = message;
    }
  }

  // ── open / close ──
  function openWindow() {
    open = true;
    // Clear `hidden` synchronously (Svelte's flush from `open` is async) so the
    // window has real dimensions when placeInitial measures it — otherwise it's
    // still display:none and lands off-screen.
    if (winEl) winEl.hidden = false;
    const geom = loadGeom();
    if (winEl && geom && geom.width) winEl.style.width = `${geom.width}px`;
    if (winEl && geom && geom.height) winEl.style.height = `${geom.height}px`;
    if (winEl) placeInitial(winEl);
    btnEl?.setAttribute('aria-expanded', 'true');
    saveGeom({ open: true });
    subscribeGlobal();
    startStatusPolling();
    doFetch('/api/btw?parent=' + encodeURIComponent(parentTopic()))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const id = data && data.sessionId ? data.sessionId : '';
        if (id !== sessionId) setSession(id);
        else if (id) { loadTranscript(); refreshStatus(); }
      })
      .catch(() => {});
    inputEl?.focus();
  }
  function closeWindow() {
    open = false;
    btnEl?.setAttribute('aria-expanded', 'false');
    saveGeom({ open: false });
    unsubscribe();
    unsubscribeGlobal();
    stopStatusPolling();
    stopSpinner();
  }
  function toggle() {
    if (open) closeWindow();
    else openWindow();
  }

  // ── drag (move) + resize persistence ──
  function enableDrag(root, handle) {
    let dragging = false, startX = 0, startY = 0, originLeft = 0, originTop = 0;
    function onMove(e) {
      if (!dragging) return;
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      const rect = root.getBoundingClientRect();
      const left = Math.max(0, Math.min(originLeft + (e.clientX - startX), vw - rect.width));
      const top = Math.max(0, Math.min(originTop + (e.clientY - startY), vh - rect.height));
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
      saveGeom({ left, top });
    }
    function onUp() {
      dragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    handle.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.closest && e.target.closest('.pi-btw-actions')) return;
      dragging = true;
      const rect = root.getBoundingClientRect();
      originLeft = rect.left; originTop = rect.top;
      startX = e.clientX; startY = e.clientY;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }
  function persistResize(root) {
    if (!window.ResizeObserver) return;
    let raf = 0;
    const ro = new window.ResizeObserver(() => {
      if (raf) window.cancelAnimationFrame?.(raf);
      raf = window.requestAnimationFrame
        ? window.requestAnimationFrame(() => saveGeom({ width: root.offsetWidth, height: root.offsetHeight }))
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
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const rect = root.getBoundingClientRect();
    const left = Math.max(0, (vw - rect.width) / 2);
    const top = Math.max(0, vh - rect.height - 90);
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    saveGeom({ left, top });
  }

  function onSubmit(e) { e.preventDefault(); submitMessage(); }
  function onSend() { if (running) cancel(); else submitMessage(); }

  // Auto-scroll to bottom when the transcript changes if the user was near it.
  $effect(() => {
    void renderedEntries; void pendingUser; void streamingText; void running; void open;
    if (open && nearBottom) scrollToBottom();
  });

  onMount(() => {
    if (winEl) document.body.appendChild(winEl);
    if (winEl && headerEl) { enableDrag(winEl, headerEl); persistResize(winEl); }
    bodyEl?.addEventListener('scroll', () => { nearBottom = atBottom(); });

    btnEl = document.getElementById('pi-btw-button');
    const onBtnClick = (e) => { e.preventDefault(); toggle(); };
    if (btnEl) {
      btnEl.setAttribute('aria-haspopup', 'dialog');
      btnEl.setAttribute('aria-expanded', 'false');
      btnEl.addEventListener('click', onBtnClick);
    }

    const composerTextarea = document.getElementById('pi-chat-message');
    const onComposerFocus = () => { if (isMobile() && open) closeWindow(); };
    composerTextarea?.addEventListener('focus', onComposerFocus);

    // Auto-reopen if it was open before a reload — but not on mobile.
    const initialGeom = loadGeom();
    if (initialGeom && initialGeom.open && !isMobile()) openWindow();

    return () => {
      unsubscribe();
      unsubscribeGlobal();
      stopStatusPolling();
      stopSpinner();
      btnEl?.removeEventListener('click', onBtnClick);
      composerTextarea?.removeEventListener('focus', onComposerFocus);
      winEl?.remove();
    };
  });
</script>

<div class="pi-btw-window" role="dialog" aria-label="btw" bind:this={winEl} hidden={!open}>
  <div class="pi-btw-header" bind:this={headerEl}>
    <span class="pi-btw-title">btw</span>
    <div class="pi-btw-actions">
      <button type="button" class="pi-btw-new" title={t('btw.newChat')} onclick={startNewSession}>{t('btw.new')}</button>
      <button type="button" class="pi-btw-close" aria-label={t('common.close')} onclick={closeWindow}>×</button>
    </div>
  </div>
  <div class="pi-btw-body" id="pi-btw-body" bind:this={bodyEl}>
    {#if isEmpty}
      <div class="pi-btw-empty">{sessionId ? t('btw.emptyHasSession') : t('btw.emptyNoSession')}</div>
    {:else}
      {#each renderedEntries as r}
        <div class="pi-btw-msg {r.role}">
          {#each r.parts as p}
            {#if p.kind === 'md'}<div class="pi-btw-md">{@html p.html}</div>{:else}<div class="pi-btw-tool">{p.text}</div>{/if}
          {/each}
        </div>
      {/each}
      {#if pendingUser}<div class="pi-btw-msg user pending"><div class="pi-btw-md">{@html toHtml(pendingUser)}</div></div>{/if}
      {#if running || streamingText}
        <div class="pi-btw-msg assistant working">
          {#if streamingText}<div class="pi-btw-md">{@html toHtml(streamingText)}</div>{:else}<span class="pi-btw-working"><span class="pi-btw-spinner" style={spinnerStyle}>{spinnerChar}</span><span class="pi-btw-working-label">{t('btw.working')}</span></span>{/if}
        </div>
      {/if}
    {/if}
  </div>
  <form class="pi-btw-input-row" id="pi-btw-form" onsubmit={onSubmit}>
    <input type="text" class="pi-btw-input" id="pi-btw-input" placeholder={t('btw.inputPlaceholder')} autocomplete="off" bind:this={inputEl} />
    <button type="button" class="pi-btw-send" id="pi-btw-send" class:cancel={running} aria-label={running ? t('composer.cancel') : t('composer.send')} title={running ? t('btw.stop') : t('composer.send')} onclick={onSend}>{running ? '◼' : '▷'}</button>
  </form>
</div>
