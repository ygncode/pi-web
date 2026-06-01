import { escapeHtml } from './escape.js';

// Module-level reference to the page's single controller so menu dispatchers
// (which only know the action name) can open the modal without threading a
// callback through every layer.
let active = null;

export function openVersionModal() {
  active?.openModal();
}

// renderChangelog converts a GitHub release body (markdown) into a small,
// XSS-safe HTML fragment. Everything is escaped first; only a handful of
// line-level constructs are then re-expanded.
export function renderChangelog(markdown) {
  if (!markdown) return '<p class="version-changelog-empty">No release notes.</p>';
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (heading) {
      closeList();
      out.push(`<h4>${inline(heading[1])}</h4>`);
    } else if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else if (line === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('');
}

// inline applies escape + a few safe inline markdown conversions (code, bold,
// links). Operates on already-trusted plain text from the release body.
function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // [label](https/http url) only — reject other schemes.
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  return s;
}

function stripV(v) {
  return String(v || '').replace(/^v/, '');
}

// cleanVersion ensures exactly one leading "v" (build versions from git tags
// already carry one, so naive prefixing produced "vv...").
function cleanVersion(v) {
  const s = stripV(v);
  return s ? 'v' + s : '';
}

// shortVersion drops the `git describe` tail ("-3-gd7e8bf2-dirty") so the menu
// row stays compact. The full string still shows in the popup.
function shortVersion(v) {
  const base = stripV(v)
    .replace(/-\d+-g[0-9a-f]{7,}.*$/, '')
    .replace(/-dirty$/, '');
  return base ? 'v' + base : '';
}

function versionLabel(info) {
  if (!info || !info.current) return '…';
  if (info.hasUpdate && info.latest) {
    return `${shortVersion(info.current)} → ${shortVersion(info.latest)}`;
  }
  return shortVersion(info.current);
}

export function createVersionController({
  documentImpl = document,
  windowImpl = window,
  fetchImpl = fetch,
} = {}) {
  let info = null;
  let busy = false;

  function statusEls() {
    return Array.from(documentImpl.querySelectorAll('[data-version-status]'));
  }

  function rowEls() {
    return Array.from(documentImpl.querySelectorAll('[data-version-row]'));
  }

  function applyStatus() {
    const label = versionLabel(info);
    statusEls().forEach((el) => {
      el.textContent = label;
      el.classList.toggle('has-update', !!(info && info.hasUpdate));
    });
    rowEls().forEach((el) => {
      el.classList.toggle('has-update', !!(info && info.hasUpdate));
    });
  }

  async function refresh(force = false) {
    try {
      const url = force ? '/api/check-update' : '/api/version';
      const res = await fetchImpl(url, {
        method: force ? 'POST' : 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      info = await res.json();
    } catch (_) {
      // Leave whatever we have; the modal surfaces check errors explicitly.
    }
    applyStatus();
    return info;
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  let overlay = null;

  function buildOverlay() {
    overlay = documentImpl.createElement('div');
    overlay.className = 'version-modal-overlay';
    overlay.innerHTML = `
      <div class="version-modal" role="dialog" aria-modal="true" aria-label="pi-web version">
        <div class="version-modal-header">
          <span class="version-modal-title">pi-web</span>
          <span class="version-modal-current"></span>
          <button type="button" class="version-modal-close" aria-label="Close">×</button>
        </div>
        <div class="version-modal-body"></div>
        <div class="version-modal-status" hidden></div>
        <div class="version-modal-actions"></div>
      </div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('.version-modal-close').addEventListener('click', closeModal);
    documentImpl.body.appendChild(overlay);
  }

  function setStatus(message, kind) {
    const el = overlay.querySelector('.version-modal-status');
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'version-modal-status';
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.className = 'version-modal-status' + (kind ? ' ' + kind : '');
  }

  function renderModal() {
    const body = overlay.querySelector('.version-modal-body');
    const actions = overlay.querySelector('.version-modal-actions');
    const current = overlay.querySelector('.version-modal-current');
    current.textContent = info && info.current ? cleanVersion(info.current) : '';
    actions.innerHTML = '';
    setStatus('');

    if (!info) {
      body.innerHTML = '<p>Version information is unavailable.</p>';
      const retryBtn = makeButton('Check for updates', 'ghost', () => doManualCheck(retryBtn));
      actions.append(retryBtn);
      return;
    }

    if (info.isDev) {
      const latestNote = info.latest
        ? `<p class="version-modal-notes">Latest published: ${escapeHtml(cleanVersion(info.latest))}</p>`
        : '';
      body.innerHTML =
        `<p>You're running a local development build.</p>` +
        latestNote +
        `<p class="version-modal-notes">In-app update is disabled here so it can't overwrite local changes.</p>`;
      const checkBtn = makeButton('Check for updates', 'ghost', () => doManualCheck(checkBtn));
      actions.append(checkBtn);
      return;
    }

    if (info.hasUpdate) {
      const link = info.changelogUrl
        ? ` <a href="${escapeHtml(info.changelogUrl)}" target="_blank" rel="noreferrer">release notes ↗</a>`
        : '';
      body.innerHTML =
        `<p class="version-modal-lead">Update available: <strong>${escapeHtml(cleanVersion(info.current))} → ${escapeHtml(cleanVersion(info.latest))}</strong></p>` +
        `<div class="version-changelog">${renderChangelog(info.changelog)}</div>` +
        (link ? `<p class="version-modal-notes">${link}</p>` : '');
      const updateBtn = makeButton('Update & Restart', 'primary', () => runUpdate());
      const laterBtn = makeButton('Later', 'ghost', closeModal);
      actions.append(updateBtn, laterBtn);
    } else {
      const checkedNote = info.checkedAt
        ? `<p class="version-modal-notes">Last checked ${new Date(info.checkedAt).toLocaleString()}.</p>`
        : '';
      body.innerHTML = `<p>You're on the latest version.</p>${checkedNote}`;
      const checkBtn = makeButton('Check for updates', 'ghost', () => doManualCheck(checkBtn));
      actions.append(checkBtn);
    }
  }

  function makeButton(label, variant, onClick) {
    const btn = documentImpl.createElement('button');
    btn.type = 'button';
    btn.className = 'version-modal-btn ' + variant;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  async function doManualCheck(btn) {
    btn.disabled = true;
    setStatus('Checking…', 'info');
    try {
      await refresh(true);
      renderModal();
    } catch (_) {
      setStatus('Could not check for updates.', 'error');
      btn.disabled = false;
    }
  }

  function setActionsDisabled(disabled) {
    overlay.querySelectorAll('.version-modal-btn').forEach((b) => { b.disabled = disabled; });
  }

  async function runUpdate() {
    if (busy) return;
    busy = true;
    setActionsDisabled(true);
    setStatus('Installing update…', 'info');
    try {
      const res = await fetchImpl('/api/update', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus('Restarting server…', 'info');
      // Fire the restart; the connection will drop mid-flight, so don't depend
      // on this resolving.
      fetchImpl('/api/restart', { method: 'POST', headers: { Accept: 'application/json' } }).catch(() => {});
      awaitReconnect();
    } catch (err) {
      setStatus('Update failed: ' + (err && err.message ? err.message : String(err)), 'error');
      setActionsDisabled(false);
      busy = false;
    }
  }

  function awaitReconnect() {
    setStatus('Reconnecting…', 'info');
    const startedAt = Date.now();
    const maxWaitMs = 90_000;
    // Grace period so the old process has a moment to be torn down before we
    // start polling — otherwise a fast restart could be missed entirely.
    const graceMs = 2500;
    const tick = async () => {
      if (Date.now() - startedAt > maxWaitMs) {
        setStatus('Server did not come back. Reload the page manually.', 'error');
        setActionsDisabled(false);
        busy = false;
        return;
      }
      try {
        const res = await fetchImpl('/api/version', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (res.ok) {
          windowImpl.location.reload();
          return;
        }
      } catch (_) {
        // Connection refused — the new process isn't listening yet. Keep trying.
      }
      windowImpl.setTimeout(tick, 1500);
    };
    windowImpl.setTimeout(tick, graceMs);
  }

  function openModal() {
    if (!overlay) buildOverlay();
    renderModal();
    overlay.classList.add('open');
    documentImpl.body.classList.add('version-modal-open');
  }

  function closeModal() {
    if (busy) return; // don't let the user dismiss mid-update
    if (!overlay) return;
    overlay.classList.remove('open');
    documentImpl.body.classList.remove('version-modal-open');
  }

  const controller = { refresh, openModal, closeModal, applyStatus };
  active = controller;
  // Wire any plain version rows (e.g. the index menu) that don't route through
  // a data-action dispatcher.
  rowEls().forEach((el) => {
    if (el.dataset.action === 'version') return; // handled by menu dispatcher
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });
  refresh(false);
  return controller;
}
