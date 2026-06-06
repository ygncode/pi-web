/**
 * right-sidebar.js — Scratchpad right sidebar logic.
 *
 * Handles:
 *   - Toggle visibility (hidden by default; Cmd+Shift+L or header button)
 *   - Expand to popup mode (expand icon → large overlay)
 *   - Resize by dragging the left-edge resizer
 *   - Load/save scratchpad content via /api/scratchpad (project-keyed)
 *   - Autosave with 1s debounce
 */

const RIGHT_SIDEBAR_COLLAPSED_KEY = 'pi-web:v1:right-sidebar-collapsed';
const RIGHT_SIDEBAR_WIDTH_KEY = 'pi-web:v1:right-sidebar-width';
const RIGHT_SIDEBAR_TAB_KEY = 'pi-web:v1:right-sidebar-tab';
const MIN_CONTENT_WIDTH = 320;

/**
 * Wire the Scratchpad / Artifacts tab switcher in the right-sidebar header.
 * Pure DOM toggling; the artifact panel's data is owned by session.js.
 * Returns { activate } so callers can switch tabs programmatically.
 */
export function setupRightSidebarTabs({ documentImpl = document, storage = globalThis.localStorage } = {}) {
  const tabs = Array.from(documentImpl.querySelectorAll('.right-sidebar-tab'));
  const panes = Array.from(documentImpl.querySelectorAll('.right-sidebar-pane'));
  const sidebar = documentImpl.getElementById('right-sidebar');
  if (tabs.length === 0 || panes.length === 0) return { activate: () => {} };

  function activate(pane) {
    if (!tabs.some(tab => tab.dataset.pane === pane)) return;
    for (const tab of tabs) {
      const isActive = tab.dataset.pane === pane;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    }
    for (const p of panes) {
      const isActive = p.id === `right-pane-${pane}`;
      p.classList.toggle('active', isActive);
      if (isActive) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    }
    // Exposes the active tab for any tab-scoped chrome/styling hooks.
    if (sidebar) sidebar.dataset.activeTab = pane;
    try { storage?.setItem(RIGHT_SIDEBAR_TAB_KEY, pane); } catch {}
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => activate(tab.dataset.pane));
  }

  let initial = '';
  try { initial = storage?.getItem(RIGHT_SIDEBAR_TAB_KEY) || ''; } catch {}
  if (initial && initial !== 'scratchpad') activate(initial);
  if (sidebar && !sidebar.dataset.activeTab) sidebar.dataset.activeTab = 'scratchpad';

  return { activate };
}

export function setupRightSidebar({
  documentImpl = document,
  windowImpl = window,
  storage = globalThis.localStorage,
  projectPath = '',
} = {}) {
  const sidebar = documentImpl.getElementById('right-sidebar');
  const resizer = documentImpl.getElementById('right-sidebar-resizer');
  const backdrop = documentImpl.getElementById('right-sidebar-backdrop');
  const textarea = documentImpl.getElementById('scratchpad-textarea');
  const statusEl = documentImpl.getElementById('scratchpad-status');
  const closeBtn = documentImpl.getElementById('close-right-sidebar');
  const expandBtn = documentImpl.getElementById('expand-right-sidebar');
  const toggleBtn = documentImpl.getElementById('toggle-right-sidebar-btn');

  if (!sidebar) return;

  // ── State helpers ────────────────────────────────────────────────────────
  function isCollapsed() {
    return documentImpl.body.classList.contains('right-sidebar-collapsed');
  }

  function isExpanded() {
    return documentImpl.body.classList.contains('right-sidebar-expanded');
  }

  function setCollapsed(collapsed) {
    documentImpl.body.classList.toggle('right-sidebar-collapsed', collapsed);
    try { storage?.setItem(RIGHT_SIDEBAR_COLLAPSED_KEY, String(collapsed)); } catch {}
  }

  function setExpanded(expanded) {
    documentImpl.body.classList.toggle('right-sidebar-expanded', expanded);
  }

  function getRightSidebarBounds() {
    const rootStyles = windowImpl.getComputedStyle(documentImpl.documentElement);
    const minWidth = parseFloat(rootStyles.getPropertyValue('--right-sidebar-min-width')) || 240;
    const maxWidth = parseFloat(rootStyles.getPropertyValue('--right-sidebar-max-width')) || 640;
    const viewportMaxWidth = windowImpl.innerWidth - MIN_CONTENT_WIDTH;
    return { minWidth, maxWidth: Math.max(minWidth, Math.min(maxWidth, viewportMaxWidth)) };
  }

  function clampWidth(width) {
    const { minWidth, maxWidth } = getRightSidebarBounds();
    return Math.max(minWidth, Math.min(maxWidth, width));
  }

  function applyWidth(width) {
    const clamped = Math.round(clampWidth(width));
    documentImpl.documentElement.style.setProperty('--right-sidebar-width', `${clamped}px`);
  }

  function loadWidth() {
    try {
      const raw = storage?.getItem(RIGHT_SIDEBAR_WIDTH_KEY);
      if (raw == null) return null;
      const w = Number(raw);
      return Number.isFinite(w) ? w : null;
    } catch { return null; }
  }

  function saveWidth(width) {
    try { storage?.setItem(RIGHT_SIDEBAR_WIDTH_KEY, String(Math.round(clampWidth(width)))); } catch {}
  }

  // ── Toggle visibility ────────────────────────────────────────────────────
  function toggleSidebar() {
    if (isCollapsed()) {
      setCollapsed(false);
      loadScratchpad();
    } else {
      setCollapsed(true);
      setExpanded(false);
    }
  }

  // Reveal the sidebar without toggling it shut when already open.
  function openSidebar() {
    if (isCollapsed()) {
      setCollapsed(false);
      loadScratchpad();
    }
  }

  // Hide the sidebar (and exit expand mode) regardless of current state.
  function collapseSidebar() {
    setExpanded(false);
    setCollapsed(true);
  }

  toggleBtn?.addEventListener('click', toggleSidebar);

  closeBtn?.addEventListener('click', () => {
    setExpanded(false);
    setCollapsed(true);
  });

  // ── Expand mode ──────────────────────────────────────────────────────────
  expandBtn?.addEventListener('click', () => {
    if (isExpanded()) {
      setExpanded(false);
    } else {
      if (isCollapsed()) setCollapsed(false);
      setExpanded(true);
      loadScratchpad();
    }
  });

  backdrop?.addEventListener('click', () => {
    setExpanded(false);
    setCollapsed(true);
  });

  // ── Keyboard shortcut registered externally in session.js ───────────────
  // (Cmd+Shift+N / Ctrl+Shift+N — attached to window in session.js alongside
  //  all other global shortcuts so ordering and capture phase are consistent.)
  // ── Resize (drag left edge) ──────────────────────────────────────────────
  if (resizer) {
    const savedWidth = loadWidth();
    if (savedWidth !== null) applyWidth(savedWidth);

    let cleanupDrag = null;
    let dragStartX = 0;
    let didDrag = false;

    const stopDrag = (pointerId) => {
      if (cleanupDrag) { cleanupDrag(pointerId); cleanupDrag = null; }
    };

    resizer.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      didDrag = false;
      dragStartX = e.clientX;
      const startX = e.clientX;
      // Width grows leftward so invert delta
      const startWidth = sidebar.getBoundingClientRect().width;
      documentImpl.body.classList.add('right-sidebar-resizing');
      resizer.setPointerCapture?.(e.pointerId);

      const onPointerMove = (ev) => {
        if (Math.abs(ev.clientX - dragStartX) > 3) didDrag = true;
        // Moving left (negative delta) increases the width
        applyWidth(startWidth + (startX - ev.clientX));
      };

      const onPointerUp = (ev) => stopDrag(ev.pointerId);
      const onPointerCancel = (ev) => stopDrag(ev.pointerId);

      cleanupDrag = (ptrId) => {
        documentImpl.body.classList.remove('right-sidebar-resizing');
        resizer.releasePointerCapture?.(ptrId);
        windowImpl.removeEventListener('pointermove', onPointerMove);
        windowImpl.removeEventListener('pointerup', onPointerUp);
        windowImpl.removeEventListener('pointercancel', onPointerCancel);
        saveWidth(sidebar.getBoundingClientRect().width);
      };

      windowImpl.addEventListener('pointermove', onPointerMove);
      windowImpl.addEventListener('pointerup', onPointerUp);
      windowImpl.addEventListener('pointercancel', onPointerCancel);
    });

    resizer.addEventListener('dblclick', () => {
      applyWidth(320);
      saveWidth(320);
    });

    windowImpl.addEventListener('resize', () => {
      applyWidth(sidebar.getBoundingClientRect().width);
    });
  }

  // ── Scratchpad load/save ─────────────────────────────────────────────────
  let saveTimer = null;
  let lastSaved = '';

  function setStatus(text, cls) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = `scratchpad-status ${cls || ''}`.trim();
  }

  async function loadScratchpad() {
    if (!projectPath || !textarea) return;
    try {
      const res = await fetch(`/api/scratchpad?project=${encodeURIComponent(projectPath)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const content = data.content ?? '';
      textarea.value = content;
      lastSaved = content;
      setStatus('Saved', 'saved');
    } catch {
      setStatus('Load failed', '');
    }
  }

  async function saveScratchpad() {
    if (!projectPath || !textarea) return;
    const content = textarea.value;
    if (content === lastSaved) return;
    setStatus('Saving…', 'saving');
    try {
      const res = await fetch('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: projectPath, content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      lastSaved = content;
      setStatus('Saved', 'saved');
    } catch {
      setStatus('Save failed', '');
    }
  }

  textarea?.addEventListener('input', () => {
    setStatus('Saving…', 'saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveScratchpad, 1000);
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  // Load stored width. Scratchpad content is server-rendered into the textarea
  // so it's present on first paint (no placeholder→value flash); adopt it as the
  // baseline instead of re-fetching, which would blank then refill the field.
  const savedWidth = loadWidth();
  if (savedWidth !== null) applyWidth(savedWidth);

  if (textarea) lastSaved = textarea.value;

  return { toggleSidebar, openSidebar, collapseSidebar };
}
