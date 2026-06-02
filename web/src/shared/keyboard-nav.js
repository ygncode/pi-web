const SCROLL_AMOUNT = 300;
const GG_TIMEOUT = 500; // ms window for double-tap 'gg'

/**
 * Returns true when the element is an input, textarea, select, or
 * contenteditable region where the user types text.
 */
export function isEditableTarget(element) {
  if (!element) return false;
  const tagName = element.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  return element.isContentEditable
    || Boolean(element.closest?.('[contenteditable="true"]'));
}

/**
 * Installs vim-style document-level keyboard navigation:
 *
 * 1. <kbd>Escape</kbd> blurs the active editable element so the user
 *    can then use the nav keys.
 * 2. <kbd>j</kbd> / <kbd>k</kbd> scroll down/up by SCROLL_AMOUNT px.
 * 3. <kbd>g g</kbd> (double-tap) scrolls to the very top of the page.
 * 4. <kbd>G</kbd> (shift+g) scrolls to the very bottom of the page.
 * 5. <kbd>I</kbd> (shift+i) focuses the main input box (chat composer).
 *
 * All scrolls use instant (no animation) for snappy vim-like feel.
 */
export function setupKeyboardNav({
  windowImpl = window,
  documentImpl = document,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  focusSelector = '#pi-chat-message',
} = {}) {
  let ggTimer = null;

  // Capture phase so Escape blurs the main input *before* bubble-phase
  // handlers see the event — but only when the user isn't inside a popup
  // or modal that has its own Escape handling (model popup, palette, etc.).
  documentImpl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const active = documentImpl.activeElement;
      if (!isEditableTarget(active)) return;
      // Don't steal Escape from popups / modals / overlays.
      if (active.closest?.('.pi-chat-model-popup, .pi-chat-thinking-popup, [role="menu"], [role="dialog"], .command-menu-popover, .mobile-command-panel, .share-overlay-backdrop, .mobile-command-backdrop, #commandPalette, #sessionPalette, .model-selector-dropdown, .modal-overlay, .modal')) return;
      e.preventDefault();
      e.stopPropagation();
      active.blur();
    }
  }, { capture: true });

  // Cmd/Ctrl+, opens the global settings page (standard macOS preferences
  // shortcut). Works regardless of focus, like a native app.
  documentImpl.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === ',') {
      e.preventDefault();
      windowImpl.location.href = '/settings';
    }
  });

  documentImpl.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableTarget(documentImpl.activeElement)) return;

    if (e.key === 'j') {
      e.preventDefault();
      const content = (typeof documentImpl.getElementById === 'function')
        ? documentImpl.getElementById('content')
        : null;
      if (content) {
        content.scrollBy({ top: SCROLL_AMOUNT, behavior: 'instant' });
      } else {
        windowImpl.scrollBy({ top: SCROLL_AMOUNT, behavior: 'instant' });
      }
    } else if (e.key === 'k') {
      e.preventDefault();
      const content = (typeof documentImpl.getElementById === 'function')
        ? documentImpl.getElementById('content')
        : null;
      if (content) {
        content.scrollBy({ top: -SCROLL_AMOUNT, behavior: 'instant' });
      } else {
        windowImpl.scrollBy({ top: -SCROLL_AMOUNT, behavior: 'instant' });
      }
    } else if (e.key === 'g') {
      e.preventDefault();
      if (ggTimer) {
        // Second 'g' within timeout — scroll to top
        clearTimeoutImpl(ggTimer);
        ggTimer = null;
        const content = (typeof documentImpl.getElementById === 'function')
          ? documentImpl.getElementById('content')
          : null;
        if (content) {
          content.scrollTo({ top: 0, behavior: 'instant' });
        } else {
          windowImpl.scrollTo({ top: 0, behavior: 'instant' });
        }
      } else {
        // First 'g' — start the double-tap window
        ggTimer = setTimeoutImpl(() => { ggTimer = null; }, GG_TIMEOUT);
      }
    } else if (e.key === 'G') {
      e.preventDefault();
      const content = (typeof documentImpl.getElementById === 'function')
        ? documentImpl.getElementById('content')
        : null;
      if (content) {
        content.scrollTo({ top: content.scrollHeight, behavior: 'instant' });
      } else {
        windowImpl.scrollTo({
          top: documentImpl.documentElement.scrollHeight,
          behavior: 'instant',
        });
      }
    } else if (e.key === 'I') {
      e.preventDefault();
      const el = documentImpl.querySelector(focusSelector);
      if (el) el.focus();
    }
  });
}
