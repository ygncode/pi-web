function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function defaultNavigate(url, windowImpl) {
  windowImpl.location.href = url;
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

function normalizeSession(session) {
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

function renderResults(resultsEl, sessions, documentImpl, navigate, limit) {
  const visible = sessions.slice(0, limit);
  if (visible.length === 0) {
    resultsEl.innerHTML = '<div class="palette-empty">No sessions found</div>';
    return;
  }
  resultsEl.innerHTML = '';
  for (const session of visible) {
    const btn = documentImpl.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-result';
    btn.innerHTML = '<span class="palette-result-title"></span><span class="palette-result-meta"></span>';
    btn.querySelector('.palette-result-title').textContent = session.title;
    btn.querySelector('.palette-result-meta').textContent = session.meta;
    btn.addEventListener('click', () => {
      if (session.href) navigate(session.href);
    });
    resultsEl.appendChild(btn);
  }
}

function filterSessions(sessions, query) {
  if (!query) return sessions;
  const q = query.toLowerCase();
  return sessions.filter((session) => session.searchText.includes(q));
}

async function fetchSessions({ fetchImpl, getCwd }) {
  const cwd = getCwd ? getCwd() : '';
  const url = cwd
    ? '/api/sessions?project=' + encodeURIComponent(cwd)
    : '/api/sessions';
  const response = await fetchImpl(url);
  const data = await response.json();
  return (data.sessions || []).sort((a, b) => {
    const da = a.LastActivity || a.lastActivity || '';
    const db = b.LastActivity || b.lastActivity || '';
    return db.localeCompare(da);
  });
}

export function sessionsFromCards(documentImpl = document) {
  return Array.from(documentImpl.querySelectorAll('.session-card[data-session-id]')).map((card) => {
    const title = card.querySelector('.session-title')?.textContent?.trim() || card.dataset.sessionId || 'Session';
    const meta = card.querySelector('[data-session-model]')?.textContent?.trim()
      || card.querySelector('.session-time')?.textContent?.trim()
      || '';
    return normalizeSession({
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

export function setupSessionListPalette({
  documentImpl = document,
  windowImpl = window,
  fetchImpl = fetch,
  navigate = (url) => defaultNavigate(url, windowImpl),
  overlayId = 'sessionPalette',
  searchInputId = 'session-palette-search',
  limit = 8,
  debounceMs = 100,
  loadSessions = null,
  getCwd = () => defaultSessionPaletteCwd(windowImpl),
  onOpen = null,
  onClose = null,
  onQueryChange = null,
  onNewSession = null,
  onImportSession = null,
  clearOnClose = false,
} = {}) {
  const overlay = documentImpl.getElementById(overlayId);
  const searchInput = searchInputId
    ? documentImpl.getElementById(searchInputId)
    : overlay?.querySelector('input');
  const resultsEl = overlay?.querySelector('[data-palette-results]')
    || documentImpl.querySelector('[data-palette-results]');
  const closeBtns = overlay
    ? Array.from(overlay.querySelectorAll('[data-palette-close]'))
    : [];

  if (!overlay || !searchInput || !resultsEl) {
    return { open: async () => {}, close: () => {}, refresh: async () => {} };
  }

  let allSessions = [];
  let visibleSessions = [];
  let selectedIndex = -1;
  let open = false;
  let keydownHandler = null;
  let overlayClickHandler = null;
  let loadGeneration = 0;

  function query() {
    return searchInput ? searchInput.value : '';
  }

  function applySelection() {
    const buttons = resultsEl.querySelectorAll('.palette-result');
    buttons.forEach((btn, i) => {
      if (i === selectedIndex) {
        btn.classList.add('palette-result--selected');
        btn?.scrollIntoView?.({ block: 'nearest' });
      } else {
        btn.classList.remove('palette-result--selected');
      }
    });
  }

  function renderFiltered() {
    visibleSessions = filterSessions(allSessions, query());
    selectedIndex = -1;
    renderResults(resultsEl, visibleSessions, documentImpl, navigate, limit);
  }

  function shouldHandlePaletteNavigation() {
    const active = documentImpl.activeElement;
    if (!active || active === searchInput || active === documentImpl.body || active === documentImpl.documentElement) {
      return true;
    }
    return !overlay.contains(active);
  }

  async function reloadSessions() {
    const generation = ++loadGeneration;
    try {
      const loader = loadSessions || (() => fetchSessions({ fetchImpl, getCwd }));
      const sessions = await loader({ query: query(), documentImpl, windowImpl });
      if (generation !== loadGeneration) return;
      allSessions = (sessions || []).map(normalizeSession);
      renderFiltered();
    } catch {
      if (generation !== loadGeneration) return;
      allSessions = [];
      visibleSessions = [];
      resultsEl.innerHTML = '<div class="palette-empty">Failed to load sessions</div>';
    }
  }

  function close() {
    if (!open) return;
    open = false;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    documentImpl.body?.classList.remove('pi-palette-open');

    if (clearOnClose && searchInput) searchInput.value = '';

    selectedIndex = -1;
    if (keydownHandler) {
      windowImpl.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    if (overlayClickHandler) {
      overlay.removeEventListener('click', overlayClickHandler);
      overlayClickHandler = null;
    }
    if (onClose) onClose();
  }

  async function openPalette() {
    if (open) return;
    if (onOpen) onOpen();
    open = true;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    documentImpl.body?.classList.add('pi-palette-open');

    keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        if (!shouldHandlePaletteNavigation()) return;
        e.preventDefault();
        // Recompute and re-render synchronously so the DOM matches before we highlight
        const fresh = filterSessions(allSessions, query());
        const lastRendered = Math.min(fresh.length, limit) - 1;
        if (selectedIndex < lastRendered) {
          selectedIndex++;
        } else if (selectedIndex === -1 && fresh.length > 0) {
          selectedIndex = 0;
        }
        // Clamp if results shrank (e.g. debounced filter flushed fewer rows)
        if (selectedIndex > lastRendered) selectedIndex = lastRendered;
        visibleSessions = fresh;
        renderResults(resultsEl, visibleSessions, documentImpl, navigate, limit);
        applySelection();
        return;
      }
      if (e.key === 'ArrowUp') {
        if (!shouldHandlePaletteNavigation()) return;
        e.preventDefault();
        const fresh = filterSessions(allSessions, query());
        const lastRendered = Math.min(fresh.length, limit) - 1;
        if (selectedIndex > 0) {
          selectedIndex--;
        } else if (selectedIndex === 0) {
          selectedIndex = -1;
          searchInput.focus();
        } else if (selectedIndex === -1 && fresh.length > 0) {
          selectedIndex = lastRendered;
        }
        // Clamp if results shrank
        if (selectedIndex > lastRendered && selectedIndex !== -1) selectedIndex = lastRendered;
        visibleSessions = fresh;
        renderResults(resultsEl, visibleSessions, documentImpl, navigate, limit);
        applySelection();
        return;
      }
      if (e.key === 'Enter') {
        if (!shouldHandlePaletteNavigation()) return;
        // Recompute from current query synchronously so we never navigate to a stale result
        const fresh = filterSessions(allSessions, query());
        // Clamp selection — debounced render may have changed result count
        if (selectedIndex >= fresh.length) selectedIndex = fresh.length > 0 ? 0 : -1;
        if (selectedIndex >= 0 && selectedIndex < fresh.length) {
          e.preventDefault();
          const session = fresh[selectedIndex];
          if (session.href) {
            close();
            navigate(session.href);
          }
        } else if (selectedIndex === -1 && fresh.length > 0) {
          e.preventDefault();
          const session = fresh[0];
          if (session.href) {
            close();
            navigate(session.href);
          }
        }
        return;
      }
    };
    windowImpl.addEventListener('keydown', keydownHandler);

    overlayClickHandler = (e) => {
      if (e.target === overlay) close();
    };
    overlay.addEventListener('click', overlayClickHandler);

    searchInput.focus();
    await reloadSessions();
  }

  const debouncedFilter = debounce(() => {
    if (onQueryChange) onQueryChange(query());
    renderFiltered();
  }, debounceMs);
  searchInput.addEventListener('input', () => {
    selectedIndex = -1;
    applySelection();
    debouncedFilter();
  });

  closeBtns.forEach((btn) => {
    btn.addEventListener('click', close);
  });

  if (onNewSession) {
    overlay.querySelectorAll('[data-new-session-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        close();
        onNewSession();
      });
    });
  }

  // Import session: disable if no handler is wired (avoids a dead button).
  const importBtn = overlay.querySelector('[data-import-session-btn]');
  if (importBtn) {
    if (onImportSession) {
      importBtn.addEventListener('click', () => {
        close();
        onImportSession();
      });
    } else {
      importBtn.disabled = true;
      importBtn.setAttribute('aria-disabled', 'true');
    }
  }

  return {
    open: openPalette,
    close,
    refresh: reloadSessions,
  };
}
