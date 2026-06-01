import { isDoneNotifyEnabled, setupSoundSelector } from '../chat/done-notifier.js';
import { applyTheme, toggleTheme, syncThemeIcons } from '../../shared/theme.js';
import { showModelUsageModal } from './model-usage-modal.js';
import { showForkModal } from './fork-modal.js';
import { openVersionModal } from '../../shared/version.js';

export { applyTheme, toggleTheme, syncThemeIcons };

function chatUrl(path, sessionId) {
  return `${path}?id=${encodeURIComponent(sessionId)}`;
}

function showToast(message, documentImpl, windowImpl) {
  let notice = documentImpl.getElementById('command-menu-toast');
  if (!notice) {
    notice = documentImpl.createElement('div');
    notice.id = 'command-menu-toast';
    notice.className = 'toast-notice';
    documentImpl.body.appendChild(notice);
  }
  notice.textContent = message;
  notice.classList.add('visible');
  clearTimeout(showToast._timer);
  showToast._timer = windowImpl.setTimeout(() => {
    notice.classList.remove('visible');
  }, 1500);
}

function clickHiddenButton(id, documentImpl) {
  const btn = documentImpl.getElementById(id);
  if (btn) btn.click();
}

function isMobileLayout(windowImpl) {
  return windowImpl.matchMedia('(max-width: 900px)').matches;
}

function getSessionId(windowImpl) {
  try {
    return new URLSearchParams(windowImpl.location.search).get('id') || '';
  } catch (_) {
    return '';
  }
}

async function renameSession({ name, sessionId, fetchImpl }) {
  const response = await fetchImpl('/api/rename-session?id=' + encodeURIComponent(sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'rename failed');
  }
  return data;
}

export function setupCommandMenu({
  documentImpl = document,
  windowImpl = window,
  setSidebarOpen = null,
  setSidebarCollapsed = null,
  getEntries = null,
  escapeHtml = String,
  formatTokens = String,
  fetchImpl = fetch,
  sessionId = getSessionId(windowImpl),
} = {}) {
  const mobileBackdrop = documentImpl.getElementById('mobile-command-backdrop');
  const mobilePanel = documentImpl.getElementById('mobile-command-panel');
  const desktopPopover = documentImpl.getElementById('command-menu-popover');
  const menuBtn = documentImpl.getElementById('command-menu-btn');
  if (!menuBtn) return;

  let open = false;

  function syncNotifyToggle() {
    const enabled = isDoneNotifyEnabled({ storage: windowImpl.localStorage });
    const mobileStatus = documentImpl.getElementById('mobile-command-notify-status');
    const desktopStatus = documentImpl.getElementById('command-menu-notify-status');
    [mobileStatus, desktopStatus].forEach((el) => {
      if (!el) return;
      el.textContent = enabled ? 'ON' : 'OFF';
      el.classList.toggle('on', enabled);

      const parent = el.parentElement;
      if (parent) {
        const selector = parent.querySelector('.sound-selector');
        if (selector) {
          selector.style.display = enabled ? '' : 'none';
        }
      }
    });
  }

  function syncSpinnerToggle() {
    const isRuncat = windowImpl.localStorage.getItem('pi-sessions:spinner-style') !== 'braille';
    const mobileStatus = documentImpl.getElementById('mobile-command-spinner-status');
    const desktopStatus = documentImpl.getElementById('command-menu-spinner-status');
    [mobileStatus, desktopStatus].forEach((el) => {
      if (!el) return;
      el.textContent = isRuncat ? 'RUNCAT' : 'BRAILLE';
      el.classList.toggle('on', isRuncat);
    });
  }

  function openMobilePanel() {
    if (!mobileBackdrop || !mobilePanel) return;
    mobileBackdrop.style.display = '';
    mobilePanel.style.display = '';
    syncNotifyToggle();
    syncSpinnerToggle();
    syncThemeIcons(documentImpl);
    requestAnimationFrame(() => {
      mobileBackdrop.classList.add('open');
      mobilePanel.classList.add('open');
    });
  }

  function closeMobilePanel() {
    if (!mobileBackdrop || !mobilePanel) return;
    mobileBackdrop.classList.remove('open');
    mobilePanel.classList.remove('open');
    windowImpl.setTimeout(() => {
      if (!mobilePanel.classList.contains('open')) {
        mobileBackdrop.style.display = 'none';
        mobilePanel.style.display = 'none';
      }
    }, 260);
  }

  function openDesktopPopover() {
    if (!desktopPopover) return;
    syncNotifyToggle();
    syncSpinnerToggle();
    syncThemeIcons(documentImpl);
    desktopPopover.style.display = '';
    requestAnimationFrame(() => {
      desktopPopover.classList.add('open');
    });
  }

  function closeDesktopPopover() {
    if (!desktopPopover) return;
    desktopPopover.classList.remove('open');
    windowImpl.setTimeout(() => {
      if (!desktopPopover && !desktopPopover.classList.contains('open')) return;
      if (!desktopPopover.classList.contains('open')) {
        desktopPopover.style.display = 'none';
      }
    }, 160);
  }

  function openMenu() {
    open = true;
    menuBtn.setAttribute('aria-expanded', 'true');
    if (isMobileLayout(windowImpl)) {
      openMobilePanel();
    } else {
      openDesktopPopover();
    }
  }

  function closeMenu() {
    open = false;
    menuBtn.setAttribute('aria-expanded', 'false');
    closeMobilePanel();
    closeDesktopPopover();
  }

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open) { closeMenu(); } else { openMenu(); }
  });

  if (mobileBackdrop) {
    mobileBackdrop.addEventListener('click', closeMenu);
  }

  documentImpl.addEventListener('click', (e) => {
    if (!open) return;
    if (desktopPopover && desktopPopover.contains(e.target)) return;
    if (menuBtn && menuBtn.contains(e.target)) return;
    closeMenu();
  });

  documentImpl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    }
  });

  function handleAction(action) {
    switch (action) {
      case 'theme': {
        toggleTheme(windowImpl, documentImpl);
        syncThemeIcons(documentImpl);
        showToast('Appearance updated', documentImpl, windowImpl);
        break;
      }
      case 'notifications': {
        clickHiddenButton('notify-toggle', documentImpl);
        syncNotifyToggle();
        windowImpl.setTimeout(syncNotifyToggle, 400);
        break;
      }
      case 'spinner': {
        const current = windowImpl.localStorage.getItem('pi-sessions:spinner-style') === 'braille' ? 'braille' : 'runcat';
        const next = current === 'runcat' ? 'braille' : 'runcat';
        windowImpl.localStorage.setItem('pi-sessions:spinner-style', next);
        syncSpinnerToggle();
        showToast(`Spinner set to ${next.toUpperCase()}`, documentImpl, windowImpl);
        break;
      }
      case 'share': {
        clickHiddenButton('share-btn', documentImpl);
        closeMenu();
        break;
      }
      case 'list-sessions': {
        closeMenu();
        // The palette is set up by session.js — use the module-level reference
        if (setupCommandMenu._palette) {
          setupCommandMenu._palette.open();
        }
        break;
      }
      case 'new-session': {
        clickHiddenButton('new-btn', documentImpl);
        closeMenu();
        break;
      }
      case 'terminal': {
        clickHiddenButton('resume-btn', documentImpl);
        closeMenu();
        break;
      }
      case 'tree': {
        if (isMobileLayout(windowImpl)) {
          if (setSidebarOpen) setSidebarOpen(true);
        } else {
          if (setSidebarCollapsed) setSidebarCollapsed(false);
        }
        closeMenu();
        break;
      }
      case 'model-usage': {
        if (getEntries) {
          showModelUsageModal({
            entries: getEntries(),
            escapeHtml,
            formatTokens,
            documentImpl,
          });
        }
        closeMenu();
        break;
      }
      case 'rename': {
        const titleEl = documentImpl.getElementById('session-header-title');
        const current = titleEl ? titleEl.textContent : '';
        const next = windowImpl.prompt('Rename session', current);
        const trimmed = next ? next.trim() : '';
        closeMenu();
        if (!trimmed || trimmed === current) break;
        renameSession({ name: trimmed, sessionId, fetchImpl })
          .then((data) => {
            const savedName = (data && data.name) || trimmed;
            if (titleEl) titleEl.textContent = savedName;
            documentImpl.title = savedName;
            showToast('Renamed', documentImpl, windowImpl);
          })
          .catch(() => {
            showToast('Rename failed', documentImpl, windowImpl);
          });
        break;
      }
      case 'fork': {
        closeMenu();
        // Fetch fresh entries — dataModel.entries is stale after live reload
        fetchImpl(chatUrl('/api/session', sessionId))
          .then((res) => res.json())
          .then((data) => {
            const entries = data.entries || [];
            const forkSheet = showForkModal({
              entries,
              escapeHtml,
              documentImpl,
              windowImpl,
              onSelect: (entryId) => {
                fetchImpl(chatUrl('/api/fork-session', sessionId), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ entryId }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.id) {
                      windowImpl.location.href = '/session?id=' + encodeURIComponent(data.id);
                    } else {
                      showToast(data.error || 'Fork failed', documentImpl, windowImpl);
                    }
                  })
                  .catch(() => showToast('Fork failed', documentImpl, windowImpl));
              },
            });
            if (!forkSheet) {
              showToast('No user messages to fork from', documentImpl, windowImpl);
            }
          })
          .catch(() => showToast('Failed to load messages', documentImpl, windowImpl));
        break;
      }
      case 'clone': {
        closeMenu();
        // Let the backend determine the leaf from the fresh file —
        // frontend currentLeafId is stale after live reload.
        fetchImpl(chatUrl('/api/clone-session', sessionId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.id) {
              windowImpl.location.href = '/session?id=' + encodeURIComponent(data.id);
            } else {
              showToast(data.error || 'Clone failed', documentImpl, windowImpl);
            }
          })
          .catch(() => showToast('Clone failed', documentImpl, windowImpl));
        break;
      }
      case 'cat-gatekeeper':
        closeMenu();
        windowImpl.__piCatGatekeeper?.openSettings?.();
        break;
      case 'version':
        closeMenu();
        openVersionModal();
        break;
      case 'diff':
        showToast('Not yet implemented', documentImpl, windowImpl);
        closeMenu();
        break;
      default:
        break;
    }
  }

  const containers = [mobilePanel, desktopPopover].filter(Boolean);
  containers.forEach((container) => {
    container.addEventListener('click', (e) => {
      const item = e.target.closest('.mobile-command-item') || e.target.closest('.command-menu-item');
      if (!item) return;
      const action = item.dataset.action;
      if (!action) return;
      handleAction(action);
    });
  });

  // Set up the sound selector dropdown
  setupSoundSelector({ documentImpl, windowImpl, storage: windowImpl.localStorage, fetchImpl });
}