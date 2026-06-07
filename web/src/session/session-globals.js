// Page-global wiring for the live session view — the "tail" of the old
// runSessionApp glue, relocated out of session.js (Svelte migration teardown,
// docs/dev/svelte-migration-plan.md §11). Called once by <SessionPage> after the
// model + navigateTo are ready. Everything here is live-only (SSE/clipboard/
// keyboard) and never runs in the static export.
//
// Covers: done-notifier, keyboard navigation, global keyboard shortcuts, and
// the mobile visual-viewport / scroll-lock handlers.

import * as doneNotifier from './chat/done-notifier.js';
import * as sidebarApi from './ui/sidebar.js';
import { setupKeyboardNav } from '../shared/keyboard-nav.js';
import { toggleTheme, syncThemeIcons } from '../shared/theme.js';

export function setupSessionGlobals({
  windowImpl,
  documentImpl,
  model,
  sessionId = '',
  navigateTo,
}) {
  const target = windowImpl;

  // Track the listeners we add directly so the SPA can tear them down on
  // unmount (and tests stay isolated). Helpers like the version checker /
  // palette manage their own lifecycles.
  const cleanups = [];
  const on = (host, type, handler, opts) => {
    host.addEventListener(type, handler, opts);
    cleanups.push(() => host.removeEventListener(type, handler, opts));
  };

  // Done-notifier (desktop notification + app badge when a worker finishes).
  doneNotifier.setupDoneNotifyToggle({ documentImpl, windowImpl: target });
  doneNotifier.setupAppBadgeClearing({ documentImpl, windowImpl: target });
  on(target, 'pi-worker-done', () => {
    doneNotifier.notifyDone({ documentImpl, windowImpl: target });
  });

  setupKeyboardNav({ windowImpl: target, documentImpl });

  // Session list palette (Cmd+K / "List Sessions" menu item). The Svelte
  // <CommandPalette> component owns the palette and exposes
  // window.__piOpenSessionPalette for this global shortcut and <CommandMenu>.

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  // Cmd+K — session list palette
  on(target, 'keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      target.__piOpenSessionPalette?.();
    }
  });

  // Cmd+B — toggle sidebar/tree
  on(target, 'keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      const sidebar = documentImpl.getElementById('sidebar');
      if (target.matchMedia('(max-width: 900px)').matches) {
        const isOpen = sidebar?.classList.contains('open');
        sidebarApi.setSidebarOpen(!isOpen, { documentImpl });
      } else {
        const isCollapsed = documentImpl.body?.classList.contains('sidebar-collapsed');
        const next = !isCollapsed;
        sidebarApi.setSidebarCollapsed(next, { documentImpl });
        sidebarApi.saveSidebarCollapsed(next);
      }
    }
  });

  // Cmd+T — new session
  on(target, 'keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
      e.preventDefault();
      const newBtn = documentImpl.getElementById('new-btn');
      if (newBtn) newBtn.click();
    }
  });

  // Cmd+Shift+L — system theme toggle. Capture phase so the browser doesn't
  // swallow it before we see it.
  on(target, 'keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme(target, documentImpl);
      syncThemeIcons(documentImpl);
    }
  }, { capture: true });

  // Cmd+Shift+N — toggle scratchpad (right sidebar)
  on(target, 'keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      target.__piRightSidebar?.toggle();
    }
  });

  // Cmd+/ — keyboard shortcuts help modal (the <ShortcutsModal> Svelte
  // component; SessionPage exposes the opener on window).
  on(target, 'keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      target.__piOpenShortcuts?.();
    }
  });

  const shortcutsBtn = documentImpl.getElementById('shortcuts-help-btn');
  if (shortcutsBtn) {
    on(shortcutsBtn, 'click', (e) => {
      e.stopPropagation();
      target.__piOpenShortcuts?.();
    });
  }

  const newSessionHeaderBtn = documentImpl.getElementById('new-session-header-btn');
  if (newSessionHeaderBtn) {
    on(newSessionHeaderBtn, 'click', (e) => {
      e.stopPropagation();
      documentImpl.getElementById('new-btn')?.click();
    });
  }

  // Visual Viewport handling — keep the fixed top header in view when the mobile
  // virtual keyboard opens.
  if (target.visualViewport) {
    const handleVisualViewportChange = () => {
      const height = target.visualViewport.height;
      documentImpl.documentElement.style.setProperty('--viewport-height', `${height}px`);
      const offsetTop = Math.max(0, target.visualViewport.offsetTop);
      const header = documentImpl.querySelector('.session-header-bar');
      if (header) header.style.transform = `translateY(${offsetTop}px)`;
    };
    on(target.visualViewport, 'resize', handleVisualViewportChange);
    on(target.visualViewport, 'scroll', handleVisualViewportChange);
    handleVisualViewportChange();
  }

  // Prevent the mobile browser from auto-scrolling the layout viewport when the
  // keyboard opens.
  on(target, 'scroll', () => {
    if (target.scrollY !== 0 || target.scrollX !== 0) target.scrollTo(0, 0);
  });
  on(documentImpl, 'scroll', () => {
    if (documentImpl.documentElement.scrollTop !== 0 || documentImpl.documentElement.scrollLeft !== 0) {
      documentImpl.documentElement.scrollTop = 0;
      documentImpl.documentElement.scrollLeft = 0;
    }
    if (documentImpl.body.scrollTop !== 0 || documentImpl.body.scrollLeft !== 0) {
      documentImpl.body.scrollTop = 0;
      documentImpl.body.scrollLeft = 0;
    }
  });

  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
