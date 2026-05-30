/**
 * Full-Screen Sheet — a reusable panel that renders as a centered dialog on
 * desktop and a fullscreen bottom-sheet on mobile (≤ 900px).
 *
 * On mobile, the sheet owns one synthetic history entry so browser back
 * gestures close the sheet instead of leaving the session page.
 *
 * Usage:
 *   const sheet = showSheet({
 *     title: 'Usage',
 *     renderBody: ({ close, bodyEl }) => string|Node,
 *     showBack: true,
 *     showClose: true,
 *     closeOnEscape: true,
 *     closeOnBackdrop: true,
 *     onClose: () => {},
 *   });
 *   // Later: sheet.close();
 */

const SHEET_BREAKPOINT = 900;
const REMOVE_DELAY = 300; // must match CSS transition duration
const openSheetCounts = new WeakMap();

function lockPageScroll(documentImpl) {
  const body = documentImpl?.body;
  if (!body?.classList) return;
  const count = openSheetCounts.get(body) || 0;
  openSheetCounts.set(body, count + 1);
  body.classList.add('pi-sheet-open');
}

function unlockPageScroll(documentImpl) {
  const body = documentImpl?.body;
  if (!body?.classList) return;
  const count = Math.max(0, (openSheetCounts.get(body) || 0) - 1);
  if (count === 0) {
    openSheetCounts.delete(body);
    body.classList.remove('pi-sheet-open');
  } else {
    openSheetCounts.set(body, count);
  }
}

function isMobile(windowImpl) {
  return typeof windowImpl.matchMedia === 'function'
    && windowImpl.matchMedia(`(max-width: ${SHEET_BREAKPOINT}px)`).matches;
}

function setupHistoryClose({ id, closeSheet, windowImpl }) {
  const historyImpl = windowImpl?.history;
  if (!historyImpl || typeof historyImpl.pushState !== 'function' || typeof historyImpl.back !== 'function') return null;
  if (typeof windowImpl.addEventListener !== 'function' || typeof windowImpl.removeEventListener !== 'function') return null;

  const marker = `pi-sheet:${id}`;
  const currentState = historyImpl.state && typeof historyImpl.state === 'object' ? historyImpl.state : {};

  try {
    historyImpl.pushState({ ...currentState, __piSheet: marker }, '', windowImpl.location?.href);
  } catch {
    return null;
  }

  function onPopState() {
    closeSheet({ skipHistory: true });
  }

  windowImpl.addEventListener('popstate', onPopState);

  return ({ skipHistory = false } = {}) => {
    windowImpl.removeEventListener('popstate', onPopState);
    if (!skipHistory && historyImpl.state?.__piSheet === marker) {
      try { historyImpl.back(); } catch { /* ignore */ }
    }
  };
}

function escapeForAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isNode(value) {
  return value != null && typeof value === 'object' && typeof value.nodeType === 'number';
}

function getFocusable(panel) {
  return panel.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
}

/**
 * @typedef SheetOptions
 * @property {string} title
 * @property {(ctx: { close: () => void, bodyEl: HTMLElement }) => string | Node} renderBody
 * @property {() => void} [onClose]
 * @property {boolean} [showBack=true]
 * @property {boolean} [showClose=true]
 * @property {boolean} [closeOnEscape=true]
 * @property {boolean} [closeOnBackdrop=true]
 * @property {Document} [documentImpl]
 * @property {Window} [windowImpl]
 * @property {typeof requestAnimationFrame} [requestAnimationFrameImpl]
 */

/**
 * Open a fullscreen sheet.
 * @param {SheetOptions} opts
 * @returns {{ close: () => void, updateBody: (content: string | Node) => void }}
 */
export function showSheet({
  title = '',
  renderBody,
  onClose,
  showBack = true,
  showClose = true,
  closeOnEscape = true,
  closeOnBackdrop = true,
  documentImpl = document,
  windowImpl = window,
  requestAnimationFrameImpl = windowImpl?.requestAnimationFrame?.bind(windowImpl) ?? ((fn) => fn()),
} = {}) {
  if (typeof renderBody !== 'function') {
    throw new TypeError('showSheet requires renderBody to be a function');
  }

  const id = 'pi-sheet-' + Math.random().toString(36).slice(2, 8);
  const backdropId = id + '-backdrop';
  const panelId = id + '-panel';
  const bodyId = id + '-body';
  const titleId = id + '-title';

  const mobile = isMobile(windowImpl);
  const escapedTitle = escapeForAttr(title);

  // Build HTML
  const html = `
    <div class="pi-sheet-backdrop${mobile ? ' pi-sheet-mobile' : ''}" id="${backdropId}">
      <div class="pi-sheet-panel${mobile ? ' pi-sheet-mobile' : ''}" id="${panelId}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
        <h2 id="${titleId}" class="sr-only">${escapedTitle}</h2>
        <div class="pi-sheet-header">
          ${showBack ? `<button class="pi-sheet-back" id="${id}-back" aria-label="Close ${escapedTitle}">
            <span aria-hidden="true">←</span>
            <span>${escapedTitle}</span>
          </button>` : '<div></div>'}
          ${showClose ? `<button class="pi-sheet-close-x" id="${id}-close-x" aria-label="Close">✕</button>` : ''}
        </div>
        <div class="pi-sheet-body" id="${bodyId}"></div>
      </div>
    </div>
  `;

  // Inject
  const wrapper = documentImpl.createElement('div');
  wrapper.innerHTML = html;
  const backdrop = wrapper.firstElementChild;
  documentImpl.body.appendChild(backdrop);
  lockPageScroll(documentImpl);

  const panel = documentImpl.getElementById(panelId);
  const bodyEl = documentImpl.getElementById(bodyId);

  if (!backdrop || !panel || !bodyEl) {
    throw new Error('showSheet failed to create required DOM nodes');
  }

  let teardownHistory = null;

  // Render body content (string or Node)
  const bodyContent = renderBody({ close: () => closeSheet(), bodyEl });
  if (isNode(bodyContent)) {
    bodyEl.appendChild(bodyContent);
  } else {
    bodyEl.innerHTML = bodyContent;
  }

  // Remember previous focus
  const previousActive = documentImpl.activeElement;

  // Animate in + focus
  requestAnimationFrameImpl(() => {
    backdrop.classList.add('open');
    panel.classList.add('open');
    const focusables = getFocusable(panel);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      panel.focus();
    }
  });

  // Focus trap
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(getFocusable(panel));
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (documentImpl.activeElement === first || !panel.contains(documentImpl.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (documentImpl.activeElement === last || !panel.contains(documentImpl.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const setTimeoutImpl = windowImpl.setTimeout ?? setTimeout ?? ((fn) => fn());

  // On mobile, browser back gestures should close the sheet, not leave the session.
  if (mobile) {
    teardownHistory = setupHistoryClose({ id, closeSheet: (opts) => closeSheet(opts), windowImpl });
  }

  // Close logic
  let closed = false;
  function closeSheet({ skipHistory = false } = {}) {
    if (closed) return;
    closed = true;
    if (teardownHistory) teardownHistory({ skipHistory });
    unlockPageScroll(documentImpl);
    documentImpl.removeEventListener('keydown', onKey);
    documentImpl.removeEventListener('keydown', trapFocus);
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeoutImpl(() => {
      backdrop.remove();
      // Restore focus after DOM removal
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus();
      }
    }, REMOVE_DELAY);
    if (onClose) onClose();
  }

  // Back button
  const backBtn = documentImpl.getElementById(id + '-back');
  if (backBtn) backBtn.addEventListener('click', closeSheet);

  // Close X
  const closeX = documentImpl.getElementById(id + '-close-x');
  if (closeX) closeX.addEventListener('click', closeSheet);

  // Backdrop click
  backdrop.addEventListener('click', (e) => {
    if (closeOnBackdrop && e.target === backdrop) closeSheet();
  });

  // Escape key
  function onKey(e) {
    if (closeOnEscape && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSheet();
    }
  }
  if (closeOnEscape) {
    documentImpl.addEventListener('keydown', onKey);
  }
  documentImpl.addEventListener('keydown', trapFocus);

  return {
    close: closeSheet,
    updateBody(htmlOrNode) {
      if (!bodyEl) return;
      bodyEl.innerHTML = '';
      if (isNode(htmlOrNode)) {
        bodyEl.appendChild(htmlOrNode);
      } else {
        bodyEl.innerHTML = htmlOrNode;
      }
    },
  };
}
