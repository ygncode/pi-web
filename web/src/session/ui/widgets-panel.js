/**
 * widgets-panel — surface extension setWidget data in the right-sidebar.
 *
 * Pi extensions call `ctx.ui.setWidget(key, lines, { placement })` to surface
 * status strips (todos, goals, monitors, memory counts, etc.) below or above
 * the editor in the TUI. In pi --mode rpc those events become
 * `extension_ui_request` JSON lines; the server's RPC worker routes them into
 * the per-session widget store and re-broadcasts on the SSE channel as
 * `widget-update` events. This module fetches the snapshot from
 * `/api/widgets?session=X`, renders it, and patches DOM in-place on SSE
 * updates.
 *
 * Two-tab right-sidebar: scratchpad vs widgets. Active pane persists in
 * localStorage so the user's last choice is sticky across navigation.
 */

const PANE_STORAGE_KEY = 'pi-web:v1:right-sidebar-pane';

export function setupRightSidebarTabs({
  documentImpl = document,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
} = {}) {
  const tabs = documentImpl.querySelectorAll('.right-sidebar-tab');
  const panes = documentImpl.querySelectorAll('.right-sidebar-pane');
  if (tabs.length === 0 || panes.length === 0) return null;

  function activate(pane) {
    tabs.forEach((t) => {
      const isActive = t.dataset.pane === pane;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panes.forEach((p) => {
      const isActive = p.id === `right-sidebar-pane-${pane}`;
      p.classList.toggle('is-active', isActive);
      if (isActive) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    });
    // Scratchpad-only footer (Saved indicator) hides on widgets tab.
    const footer = documentImpl.querySelector('.right-sidebar-footer');
    if (footer) footer.style.display = pane === 'scratchpad' ? '' : 'none';
    try { storage?.setItem(PANE_STORAGE_KEY, pane); } catch { /* ignore */ }
  }

  tabs.forEach((t) => {
    t.addEventListener('click', () => activate(t.dataset.pane));
  });

  let initial = 'scratchpad';
  try { initial = storage?.getItem(PANE_STORAGE_KEY) || 'scratchpad'; } catch { /* ignore */ }
  activate(initial);
  return { activate };
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function renderWidgetSection(widget) {
  const lines = Array.isArray(widget.lines) ? widget.lines : [];
  const body = lines.length
    ? `<pre class="widget-lines">${lines.map(escapeHtml).join('\n')}</pre>`
    : '<div class="widget-empty">(empty)</div>';
  return `<section class="widget" data-key="${escapeHtml(widget.key)}" data-placement="${escapeHtml(widget.placement || '')}">
    <header class="widget-header">${escapeHtml(widget.key)}</header>
    ${body}
  </section>`;
}

function renderAll(panel, widgets) {
  if (!widgets || widgets.length === 0) {
    panel.innerHTML = `<div class="widgets-empty">
      <p>No widgets yet.</p>
      <p class="widgets-empty-hint">Widgets populate when this session has had at least one turn. Pi-web spawns a worker on page load to bootstrap them; check back in a few seconds.</p>
    </div>`;
    return;
  }
  panel.innerHTML = widgets.map(renderWidgetSection).join('');
}

function cssEscape(s) {
  // CSS.escape isn't always present in test environments; fall back to a
  // safe minimal escape good enough for selector-attribute matching of
  // ASCII widget keys.
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

function patchSection(panel, widget, removed) {
  const doc = panel.ownerDocument;
  const existing = panel.querySelector(`section.widget[data-key="${cssEscape(widget.key)}"]`);
  if (removed) {
    if (existing) existing.remove();
    if (panel.children.length === 0) renderAll(panel, []);
    return;
  }
  const html = renderWidgetSection(widget);
  if (existing) {
    const wrapper = doc.createElement('div');
    wrapper.innerHTML = html.trim();
    existing.replaceWith(wrapper.firstChild);
  } else {
    // Empty-state placeholder? Replace it.
    if (panel.querySelector('.widgets-empty')) panel.innerHTML = '';
    panel.insertAdjacentHTML('beforeend', html);
  }
}

export function setupWidgetsPanel({
  sessionId,
  documentImpl = document,
  windowImpl = window,
  fetchImpl,
  EventSourceImpl,
} = {}) {
  if (!sessionId) return null;
  const panel = documentImpl.getElementById('widgets-panel');
  if (!panel) return null;
  const fetcher = fetchImpl || (windowImpl?.fetch ? windowImpl.fetch.bind(windowImpl) : null);
  if (!fetcher) return null;
  const ES = EventSourceImpl || windowImpl?.EventSource;

  async function refresh() {
    try {
      const res = await fetcher(`/api/widgets?session=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderAll(panel, Array.isArray(data?.widgets) ? data.widgets : []);
    } catch (err) {
      panel.innerHTML = `<div class="widgets-empty">Failed to load widgets: ${escapeHtml(err.message)}</div>`;
    }
  }

  refresh();

  // SSE subscription — the session SSE topic already carries widget-update
  // events alongside chat-preview etc.
  let es = null;
  if (ES) {
    try {
      es = new ES(`/events?session=${encodeURIComponent(sessionId)}`);
      es.addEventListener('widget-update', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (!payload?.widget?.key) return;
          patchSection(panel, payload.widget, !!payload.removed);
        } catch { /* drop malformed */ }
      });
    } catch { /* SSE unavailable — falls back to manual refresh on tab activation */ }
  }

  // Re-fetch when the user switches into the widgets tab — covers the case
  // where worker spawn was slow on page load and the initial fetch was empty.
  documentImpl.querySelectorAll('.right-sidebar-tab[data-pane="widgets"]').forEach((t) => {
    t.addEventListener('click', () => { refresh(); });
  });

  return {
    refresh,
    close: () => { if (es) try { es.close(); } catch { /* ignore */ } },
  };
}
