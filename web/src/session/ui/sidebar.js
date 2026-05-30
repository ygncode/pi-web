export const SIDEBAR_WIDTH_STORAGE_KEY = 'pi-share:v1:sidebar-width';
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'pi-share:v1:sidebar-collapsed';
export const MIN_CONTENT_WIDTH = 320;

export function isMobileLayout({ windowImpl = window } = {}) {
  if (!windowImpl || typeof windowImpl.matchMedia !== 'function') {
    return false;
  }
  return windowImpl.matchMedia('(max-width: 900px)').matches;
}

export function getSidebarBounds({ documentImpl = document, windowImpl = window } = {}) {
  const rootStyles = windowImpl.getComputedStyle(documentImpl.documentElement);
  const minWidth = parseFloat(rootStyles.getPropertyValue('--sidebar-min-width')) || 240;
  const maxWidth = parseFloat(rootStyles.getPropertyValue('--sidebar-max-width')) || 720;
  const viewportMaxWidth = windowImpl.innerWidth - MIN_CONTENT_WIDTH;
  return {
    minWidth,
    maxWidth: Math.max(minWidth, Math.min(maxWidth, viewportMaxWidth))
  };
}

export function clampSidebarWidth(width, env = {}) {
  const { minWidth, maxWidth } = getSidebarBounds(env);
  return Math.max(minWidth, Math.min(maxWidth, width));
}

export function applySidebarWidth(width, env = {}) {
  const { documentImpl = document } = env;
  documentImpl.documentElement.style.setProperty('--sidebar-width', `${Math.round(clampSidebarWidth(width, env))}px`);
}

export function loadSidebarWidth({ storage = globalThis.localStorage } = {}) {
  try {
    const raw = storage?.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw === null || raw === undefined) return null;
    const width = Number(raw);
    return Number.isFinite(width) ? width : null;
  } catch {
    return null;
  }
}

export function saveSidebarWidth(width, env = {}) {
  const { storage = globalThis.localStorage } = env;
  try {
    storage?.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(clampSidebarWidth(width, env))));
  } catch {
    // Ignore storage failures.
  }
}

export function setSidebarOpen(open, { documentImpl = document } = {}) {
  const sidebar = documentImpl.getElementById('sidebar');
  const overlay = documentImpl.getElementById('sidebar-overlay');
  const hamburger = documentImpl.getElementById('hamburger');
  sidebar?.classList.toggle('open', open);
  overlay?.classList.toggle('open', open);
  documentImpl.body?.classList.toggle('sidebar-open', open);
  if (hamburger) hamburger.style.display = open ? 'none' : '';
}

export function loadSidebarCollapsed({ storage = globalThis.localStorage } = {}) {
  try {
    const raw = storage?.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed, { storage = globalThis.localStorage } = {}) {
  try {
    storage?.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Ignore storage failures.
  }
}

export function setSidebarCollapsed(collapsed, { documentImpl = document, windowImpl = window } = {}) {
  const hamburger = documentImpl.getElementById('hamburger');
  documentImpl.body?.classList.toggle('sidebar-collapsed', collapsed);
  if (hamburger) {
    if (isMobileLayout({ windowImpl })) {
      hamburger.style.display = '';
    } else {
      hamburger.style.display = collapsed ? '' : 'none';
    }
  }
}

export function setupSidebarCollapse({ documentImpl = document, windowImpl = window, storage = globalThis.localStorage } = {}) {
  const env = { documentImpl, windowImpl, storage };
  const collapsed = loadSidebarCollapsed({ storage });
  if (!isMobileLayout({ windowImpl })) {
    setSidebarCollapsed(collapsed, { documentImpl, windowImpl });
  }

  const hamburger = documentImpl.getElementById('hamburger');
  const hideBtn = documentImpl.getElementById('hide-sidebar');

  hamburger?.addEventListener('click', () => {
    if (isMobileLayout({ windowImpl })) {
      setSidebarOpen(true, { documentImpl });
      return;
    }
    setSidebarCollapsed(false, { documentImpl, windowImpl });
    saveSidebarCollapsed(false, { storage });
  });

  const closeSidebar = () => {
    if (isMobileLayout({ windowImpl })) {
      setSidebarOpen(false, { documentImpl });
      return;
    }
    setSidebarCollapsed(true, { documentImpl, windowImpl });
    saveSidebarCollapsed(true, { storage });
  };

  hideBtn?.addEventListener('click', closeSidebar);


}

export function setupSidebarResize({ documentImpl = document, windowImpl = window, storage = globalThis.localStorage } = {}) {
  const sidebar = documentImpl.getElementById('sidebar');
  const sidebarResizer = documentImpl.getElementById('sidebar-resizer');
  const env = { documentImpl, windowImpl, storage };
  const savedWidth = loadSidebarWidth({ storage });
  if (savedWidth !== null) applySidebarWidth(savedWidth, env);
  if (!sidebar || !sidebarResizer) return;

  let cleanupDrag = null;
  let didDrag = false;
  let dragStartX = 0;

  const stopDrag = (pointerId) => {
    if (cleanupDrag) {
      cleanupDrag(pointerId);
      cleanupDrag = null;
    }
  };

  sidebarResizer.addEventListener('pointerdown', (e) => {
    if (isMobileLayout({ windowImpl })) return;
    if (e.button !== 0) return;

    e.preventDefault();
    didDrag = false;
    dragStartX = e.clientX;
    const startX = e.clientX;
    const startWidth = sidebar.getBoundingClientRect().width;
    documentImpl.body.classList.add('sidebar-resizing');
    sidebarResizer.setPointerCapture?.(e.pointerId);

    const onPointerMove = (event) => {
      if (Math.abs(event.clientX - dragStartX) > 3) {
        didDrag = true;
      }
      applySidebarWidth(startWidth + (event.clientX - startX), env);
    };

    const onPointerUp = (event) => stopDrag(event.pointerId);
    const onPointerCancel = (event) => stopDrag(event.pointerId);

    cleanupDrag = (pointerIdToRelease) => {
      documentImpl.body.classList.remove('sidebar-resizing');
      sidebarResizer.releasePointerCapture?.(pointerIdToRelease);
      windowImpl.removeEventListener('pointermove', onPointerMove);
      windowImpl.removeEventListener('pointerup', onPointerUp);
      windowImpl.removeEventListener('pointercancel', onPointerCancel);
      saveSidebarWidth(sidebar.getBoundingClientRect().width, env);
    };

    windowImpl.addEventListener('pointermove', onPointerMove);
    windowImpl.addEventListener('pointerup', onPointerUp);
    windowImpl.addEventListener('pointercancel', onPointerCancel);
  });

  sidebarResizer.addEventListener('dblclick', () => {
    if (isMobileLayout({ windowImpl })) return;
    applySidebarWidth(400, env);
    saveSidebarWidth(400, env);
  });

  windowImpl.addEventListener('resize', () => {
    if (isMobileLayout({ windowImpl })) return;
    applySidebarWidth(sidebar.getBoundingClientRect().width, env);
  });

  windowImpl.addEventListener('resize', () => {
    if (isMobileLayout({ windowImpl })) {
      documentImpl.body?.classList.remove('sidebar-collapsed');
      const hamburger = documentImpl.getElementById('hamburger');
      if (hamburger) hamburger.style.display = '';
    } else {
      const collapsed = loadSidebarCollapsed({ storage });
      setSidebarCollapsed(collapsed, { documentImpl, windowImpl });
    }
  });
}
