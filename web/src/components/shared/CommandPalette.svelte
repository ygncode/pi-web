<script module>
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function sessionTitle(session) {
    return session.title || session.Name || session.name || session.ID || session.id || 'Session';
  }

  function sessionId(session) {
    return session.id || session.ID || '';
  }

  function sessionHref(session) {
    return session.href || (sessionId(session) ? '/session?id=' + encodeURIComponent(sessionId(session)) : '');
  }

  function sessionMeta(session) {
    if (session.meta) return session.meta;
    const model = [session.ModelProvider || session.modelProvider, session.Model || session.model]
      .filter(Boolean)
      .join('/');
    return model || session.Project || session.project || '';
  }

  export function normalizePaletteSession(session) {
    const title = sessionTitle(session);
    const id = sessionId(session);
    const meta = sessionMeta(session);
    const project = session.Project || session.project || '';
    const model = session.Model || session.model || '';
    const provider = session.ModelProvider || session.modelProvider || '';
    return {
      ...session,
      id,
      title,
      meta,
      href: sessionHref(session),
      searchText: String(session.searchText || [title, id, meta, project, model, provider].filter(Boolean).join(' ')).toLowerCase(),
    };
  }

  export function sessionsFromCards(documentImpl = document) {
    return Array.from(documentImpl.querySelectorAll('.session-card[data-session-id]')).map((card) => {
      const title = card.querySelector('.session-title')?.textContent?.trim() || card.dataset.sessionId || 'Session';
      const meta = card.querySelector('[data-session-model]')?.textContent?.trim()
        || card.querySelector('.session-time')?.textContent?.trim()
        || '';
      return normalizePaletteSession({
        id: card.dataset.sessionId || '',
        title,
        meta,
        href: card.getAttribute('href') || '',
        searchText: card.dataset.search || [title, meta, card.dataset.sessionId || ''].join(' '),
      });
    });
  }

  export function defaultSessionPaletteCwd(windowImpl = window) {
    try {
      const preload = windowImpl.__piSessionDataModel;
      const data = preload && typeof preload.header === 'object' ? preload.header : {};
      return data.cwd || '';
    } catch {
      return '';
    }
  }

  export async function fetchPaletteSessions({ fetchImpl = fetch, getCwd = () => defaultSessionPaletteCwd(window) } = {}) {
    const cwd = getCwd ? getCwd() : '';
    const url = cwd ? '/api/sessions?project=' + encodeURIComponent(cwd) : '/api/sessions';
    const response = await fetchImpl(url);
    const data = await response.json();
    return (data.sessions || []).sort((a, b) => {
      const da = a.LastActivity || a.lastActivity || '';
      const db = b.LastActivity || b.lastActivity || '';
      return db.localeCompare(da);
    });
  }

  export function filterPaletteSessions(sessions, query) {
    if (!query) return sessions;
    const q = query.toLowerCase();
    return sessions.filter((session) => session.searchText.includes(q));
  }
</script>

<script>
  import { onMount, tick } from 'svelte';
  import { icon, X } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';

  let {
    limit = 8,
    debounceMs = 100,
    loadSessions = null,
    getCwd = () => defaultSessionPaletteCwd(window),
    onOpen = null,
    onClose = null,
    onQueryChange = null,
    onNewSession = null,
    onImportSession = null,
    clearOnClose = false,
    fetchImpl = null,
    navigate = null,
  } = $props();

  let overlayEl;
  let inputEl;
  let resultButtons = [];
  let open = $state(false);
  let query = $state('');
  let allSessions = $state([]);
  let selectedIndex = $state(-1);
  let error = $state('');
  let loadGeneration = 0;

  const effectiveFetch = $derived(fetchImpl || window.fetch.bind(window));
  const visibleSessions = $derived(filterPaletteSessions(allSessions, query).slice(0, limit));

  function go(url) {
    if (!url) return;
    if (navigate) navigate(url);
    else window.location.href = url;
  }

  function close() {
    if (!open) return;
    open = false;
    selectedIndex = -1;
    if (clearOnClose) query = '';
    document.body?.classList.remove('pi-palette-open');
    onClose?.();
  }

  function startNewSession() {
    close();
    if (onNewSession) {
      onNewSession();
      return;
    }
    document.getElementById('new-btn')?.click?.();
    document.getElementById('newSessionBtn')?.click?.();
  }

  async function reloadSessions() {
    const generation = ++loadGeneration;
    error = '';
    try {
      const loader = loadSessions || (() => fetchPaletteSessions({ fetchImpl: effectiveFetch, getCwd }));
      const sessions = await loader({ query, documentImpl: document, windowImpl: window });
      if (generation !== loadGeneration) return;
      allSessions = (sessions || []).map(normalizePaletteSession);
      selectedIndex = -1;
    } catch {
      if (generation !== loadGeneration) return;
      allSessions = [];
      error = t('palette.failedLoadSessions');
    }
  }

  async function openPalette() {
    if (open) return;
    onOpen?.();
    open = true;
    document.body?.classList.add('pi-palette-open');
    await tick();
    inputEl?.focus();
    await reloadSessions();
  }

  function refresh() {
    return reloadSessions();
  }

  function handleInput() {
    onQueryChange?.(query);
    selectedIndex = -1;
  }

  function selectVisible(index) {
    const session = visibleSessions[index];
    if (!session) return;
    close();
    go(session.href);
  }

  function handleKeydown(e) {
    if (!open) return;
    const active = document.activeElement;
    const shouldHandle = !active || active === inputEl || active === document.body || active === document.documentElement || !overlayEl?.contains(active);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (!shouldHandle) return;
    const last = Math.min(visibleSessions.length, limit) - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = selectedIndex < last ? selectedIndex + 1 : (selectedIndex === -1 && last >= 0 ? 0 : selectedIndex);
      resultButtons[selectedIndex]?.scrollIntoView?.({ block: 'nearest' });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectedIndex > 0) selectedIndex -= 1;
      else if (selectedIndex === 0) { selectedIndex = -1; inputEl?.focus(); }
      else if (selectedIndex === -1 && last >= 0) selectedIndex = last;
      resultButtons[selectedIndex]?.scrollIntoView?.({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      const index = selectedIndex >= 0 ? selectedIndex : 0;
      if (visibleSessions[index]) {
        e.preventDefault();
        selectVisible(index);
      }
    }
  }

  onMount(() => {
    const api = { open: openPalette, close, refresh };
    const previousOpenBridge = window.__piOpenSessionPalette;
    const openBridge = () => api.open();
    window.__piSessionPalette = api;
    if (typeof previousOpenBridge !== 'function') window.__piOpenSessionPalette = openBridge;
    const keydown = (e) => handleKeydown(e);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('keydown', keydown);
      if (window.__piSessionPalette === api) delete window.__piSessionPalette;
      if (window.__piOpenSessionPalette === openBridge) delete window.__piOpenSessionPalette;
      else if (previousOpenBridge && window.__piOpenSessionPalette == null) window.__piOpenSessionPalette = previousOpenBridge;
      document.body?.classList.remove('pi-palette-open');
    };
  });
</script>

<div class="command-palette-overlay" id="sessionPalette" class:open aria-hidden={open ? 'false' : 'true'} bind:this={overlayEl} role="presentation" onclick={(e) => { if (e.target === overlayEl) close(); }}>
  <div class="command-palette" role="dialog" aria-modal="true" aria-label={t('palette.listSessions')}>
    <div class="palette-search-wrap">
      <input type="text" id="session-palette-search" placeholder={t('index.searchSessions')} autocomplete="off" bind:this={inputEl} bind:value={query} oninput={handleInput}>
      <button class="palette-search-close" type="button" data-palette-close aria-label={t('palette.closeSearch')} onclick={close}>{@html icon(X, { size: 15 })}</button>
    </div>
    <div class="palette-results" data-palette-results>
      {#if error}
        <div class="palette-empty">{error}</div>
      {:else if visibleSessions.length === 0}
        <div class="palette-empty">{t('palette.noSessionsFound')}</div>
      {:else}
        {#each visibleSessions as session, i (session.id || session.href || i)}
          <button
            type="button"
            class="palette-result"
            class:palette-result--selected={i === selectedIndex}
            bind:this={resultButtons[i]}
            onclick={() => selectVisible(i)}
          >
            <span class="palette-result-title">{session.title}</span>
            <span class="palette-result-meta">{session.meta}</span>
          </button>
        {/each}
      {/if}
    </div>
    <div class="palette-section-title">{t('palette.actions')}</div>
    <button class="palette-action" type="button" data-new-session-btn onclick={startNewSession}>{t('palette.newSession')}</button>
    <button class="palette-action muted" type="button" data-import-session-btn disabled={!onImportSession} aria-disabled={!onImportSession} onclick={() => { close(); onImportSession?.(); }}>{t('index.importSession')}</button>
  </div>
</div>
