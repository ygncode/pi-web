import { createSessionsPage } from './sessions-page.js';
import {
  isDoneNotifyEnabled,
  registerPushSubscription,
  requestNotifyPermission,
  setDoneNotifyEnabled,
  unregisterPushSubscription,
  setupSoundSelector,
  playDoneSound,
} from '../session/chat/done-notifier.js';
import { setupKeyboardNav } from '../shared/keyboard-nav.js';
import { toggleTheme, syncThemeIcons } from '../shared/theme.js';
import { setupSessionListPalette } from '../shared/session-list-palette.js';
import { createVersionController } from '../shared/version.js';

export { createSessionsPage };

export function runIndexPage({
  documentImpl = document,
  windowImpl = window,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
} = {}) {
  const page = createSessionsPage({
    root: documentImpl,
    setTimeoutImpl,
    clearTimeoutImpl,
  });

  setupKeyboardNav({ windowImpl, documentImpl });

  createVersionController({ documentImpl, windowImpl });

  const openSearchBtn = documentImpl.getElementById('open-search');
  const menuBtn = documentImpl.getElementById('web-menu-btn');
  const webMenu = documentImpl.getElementById('web-menu');
  const webMenuBackdrop = documentImpl.getElementById('web-menu-backdrop');
  const modalOverlay = documentImpl.getElementById('modalOverlay');
  const newSessionBtns = Array.from(documentImpl.querySelectorAll('[data-new-session-btn]'));
  const modalBackBtn = documentImpl.getElementById('modalBackBtn');
  const cancelBtn = documentImpl.getElementById('cancelBtn');
  const createBtn = documentImpl.getElementById('createBtn');
  const sessionPathInput = documentImpl.getElementById('sessionPath');
  const recentLocations = documentImpl.getElementById('recentLocations');
  const modalError = documentImpl.getElementById('modalError');
  const notifyToggle = documentImpl.getElementById('index-notify-toggle');
  const notifyStatus = documentImpl.getElementById('index-notify-status');
  const spinnerToggle = documentImpl.getElementById('index-spinner-toggle');
  const spinnerStatus = documentImpl.getElementById('index-spinner-status');
  const layoutBtns = Array.from(documentImpl.querySelectorAll('[data-layout-btn]'));
  const layoutStorageKey = 'pi-sessions:view-layout';

  let modalHideTimer = null;
  let sessionPalette = null;

  function showModal() {
    closePalette();
    closeMenu();
    if (!modalOverlay) return;
    if (modalHideTimer) {
      clearTimeoutImpl(modalHideTimer);
      modalHideTimer = null;
    }
    modalOverlay.classList.add('visible');
    documentImpl.body?.classList.add('modal-sheet-open');
    const requestFrame = windowImpl.requestAnimationFrame?.bind(windowImpl) || ((fn) => setTimeoutImpl(fn, 0));
    requestFrame(() => modalOverlay.classList.add('open'));
  }

  function hideModal() {
    if (modalOverlay) {
      modalOverlay.classList.remove('open');
      if (modalHideTimer) clearTimeoutImpl(modalHideTimer);
      modalHideTimer = setTimeoutImpl(() => {
        modalOverlay.classList.remove('visible');
        modalHideTimer = null;
      }, 300);
    }
    documentImpl.body?.classList.remove('modal-sheet-open');
    page.modal = false;
  }

  const isMobile = () => windowImpl.matchMedia('(max-width: 900px)').matches;

  function closeMenu() {
    if (!webMenu || !menuBtn) return;
    if (isMobile()) {
      if (webMenuBackdrop) webMenuBackdrop.classList.remove('open');
      webMenu.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      setTimeoutImpl(() => {
        if (!webMenu.classList.contains('open')) {
          webMenu.hidden = true;
          if (webMenuBackdrop) webMenuBackdrop.style.display = 'none';
        }
      }, 260);
    } else {
      webMenu.hidden = true;
      webMenu.classList.remove('open');
      if (webMenuBackdrop) {
        webMenuBackdrop.classList.remove('open');
        webMenuBackdrop.style.display = 'none';
      }
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function openMenu() {
    if (!webMenu || !menuBtn) return;
    menuBtn.setAttribute('aria-expanded', 'true');
    if (isMobile()) {
      webMenu.hidden = false;
      if (webMenuBackdrop) {
        webMenuBackdrop.style.display = '';
      }
      windowImpl.requestAnimationFrame(() => {
        if (webMenuBackdrop) webMenuBackdrop.classList.add('open');
        webMenu.classList.add('open');
      });
    } else {
      webMenu.hidden = false;
      windowImpl.requestAnimationFrame(() => {
        webMenu.classList.add('open');
      });
    }
  }

  function toggleMenu() {
    if (!webMenu) return;
    const isOpen = !webMenu.hidden && webMenu.classList.contains('open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function setLayoutButtonState(layout) {
    documentImpl.documentElement.dataset.sessionLayout = layout;
    layoutBtns.forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.layoutBtn === layout ? 'true' : 'false');
    });
  }

  function markLayoutReady() {
    documentImpl.querySelector('[data-sessions-content]')?.classList.add('index-layout-ready');
  }

  function openPalette() {
    closeMenu();
    if (sessionPalette) sessionPalette.open();
  }

  function closePalette() {
    if (sessionPalette) sessionPalette.close();
  }

  sessionPalette = setupSessionListPalette({
    documentImpl,
    windowImpl,
    onQueryChange: (query) => {
      page.query = query;
      page.filter();
    },
  });

  if (openSearchBtn) {
    openSearchBtn.addEventListener('click', openPalette);
  }

  layoutBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const layout = btn.dataset.layoutBtn === 'projects' ? 'projects' : 'timeline';
      try { windowImpl.localStorage.setItem(layoutStorageKey, layout); } catch (_) {}
      setLayoutButtonState(layout);
      await page.setLayout(layout);
      markLayoutReady();
      sessionPalette.refresh();
    });
  });

  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });
  }

  if (webMenu) {
    webMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.web-menu-item');
      if (item) {
        closeMenu();
      } else {
        e.stopPropagation();
      }
    });
    windowImpl.addEventListener('click', closeMenu);
  }

  if (webMenuBackdrop) {
    webMenuBackdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
    });
  }

  function syncNotifyMenuItem() {
    if (!notifyToggle || !notifyStatus) return;
    const enabled = isDoneNotifyEnabled({ storage: windowImpl.localStorage });
    notifyStatus.textContent = enabled ? 'ON' : 'OFF';
    notifyStatus.classList.toggle('on', enabled);
    notifyToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');

    const parent = notifyStatus.parentElement;
    if (parent) {
      const selector = parent.querySelector('.sound-selector');
      if (selector) {
        selector.style.display = enabled ? '' : 'none';
      }
    }
  }

  if (notifyToggle) {
    syncNotifyMenuItem();
    notifyToggle.addEventListener('click', async () => {
      const enabled = isDoneNotifyEnabled({ storage: windowImpl.localStorage });
      if (enabled) {
        setDoneNotifyEnabled(false, { storage: windowImpl.localStorage });
        await unregisterPushSubscription({ windowImpl });
      } else {
        const permission = await requestNotifyPermission({ windowImpl });
        const granted = permission === 'granted';
        setDoneNotifyEnabled(granted, { storage: windowImpl.localStorage });
        if (granted) await registerPushSubscription({ windowImpl });
      }
      syncNotifyMenuItem();
    });

    setupSoundSelector({
      documentImpl,
      windowImpl,
      storage: windowImpl.localStorage,
      fetchImpl: windowImpl.fetch.bind(windowImpl)
    });
  }

  function syncSpinnerMenuItem() {
    if (!spinnerToggle || !spinnerStatus) return;
    const isRuncat = windowImpl.localStorage.getItem('pi-sessions:spinner-style') !== 'braille';
    spinnerStatus.textContent = isRuncat ? 'RUNCAT' : 'BRAILLE';
    spinnerStatus.classList.toggle('on', isRuncat);
    spinnerToggle.setAttribute('aria-pressed', isRuncat ? 'true' : 'false');
  }

  if (spinnerToggle) {
    syncSpinnerMenuItem();
    spinnerToggle.addEventListener('click', () => {
      const current = windowImpl.localStorage.getItem('pi-sessions:spinner-style') === 'braille' ? 'braille' : 'runcat';
      const next = current === 'runcat' ? 'braille' : 'runcat';
      windowImpl.localStorage.setItem('pi-sessions:spinner-style', next);
      syncSpinnerMenuItem();
    });
  }

  async function openNewSessionModal() {
    showModal();
    page.modal = true;
    const recent = await page.openModal();
    if (recentLocations) {
      recentLocations.innerHTML = '';
      for (const loc of recent) {
        const chip = documentImpl.createElement('span');
        chip.className = 'recent-chip';
        chip.textContent = loc;
        chip.addEventListener('click', () => {
          if (sessionPathInput) {
            sessionPathInput.value = loc;
            page.path = loc;
            sessionPathInput.focus();
          }
        });
        recentLocations.appendChild(chip);
      }
    }
    if (sessionPathInput) sessionPathInput.focus();
  }

  newSessionBtns.forEach((btn) => {
    btn.addEventListener('click', openNewSessionModal);
  });

  if (modalBackBtn) {
    modalBackBtn.addEventListener('click', hideModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', hideModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) hideModal();
    });
  }

  // Cmd+Shift+L keyboard shortcut for system theme toggle (capture phase)
  windowImpl.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme(windowImpl, documentImpl);
      syncThemeIcons(documentImpl);
      // Also update index page's inline theme-toggle icon
      const indexIcon = documentImpl.querySelector('[data-theme-icon]');
      if (indexIcon) {
        const isDark = (documentImpl.documentElement.dataset.theme || 'dark') === 'dark';
        indexIcon.textContent = isDark ? '☀' : '◐';
      }
    }
  }, { capture: true });

  windowImpl.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }
    if (e.key === 'Escape') {
      const paletteOverlay = documentImpl.getElementById('sessionPalette');
      if (paletteOverlay?.classList.contains('open')) closePalette();
      else if (webMenu && !webMenu.hidden) closeMenu();
      else if (page.modal) hideModal();
    }
  });

  if (sessionPathInput) {
    sessionPathInput.addEventListener('input', () => {
      page.path = sessionPathInput.value;
    });
    sessionPathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doCreate();
      }
    });
  }

  async function doCreate() {
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
    }
    if (modalError) modalError.textContent = '';

    await page.create();

    if (createBtn) {
      createBtn.disabled = false;
      createBtn.textContent = 'Create';
    }
    if (modalError) modalError.textContent = page.error || '';
  }

  if (createBtn) {
    createBtn.addEventListener('click', doCreate);
  }

  let initialLayout = 'timeline';
  try {
    initialLayout = windowImpl.localStorage.getItem(layoutStorageKey) === 'projects' ? 'projects' : 'timeline';
  } catch (_) {}
  setLayoutButtonState(initialLayout);

  page.filter();
  sessionPalette.refresh();
  page.subscribe();
  if (initialLayout === 'projects') {
    page.setLayout('projects')
      .then(() => sessionPalette.refresh())
      .catch(() => {})
      .finally(markLayoutReady);
  } else {
    markLayoutReady();
  }

  // ── Integrated design system helpers (originally inlined in HTML) ──

  function formatRelativeTime(date) {
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    const units = [
      ['year', 31536000], ['month', 2592000], ['week', 604800],
      ['day', 86400], ['hour', 3600], ['minute', 60]
    ];
    for (let i = 0; i < units.length; i++) {
      const count = Math.floor(seconds / units[i][1]);
      if (count >= 1) return count + ' ' + units[i][0] + (count === 1 ? '' : 's') + ' ago';
    }
    return 'just now';
  }

  function updateRelativeTimes() {
    documentImpl.querySelectorAll('[data-timestamp]').forEach((el) => {
      const ts = el.dataset.timestamp;
      if (!ts) return;
      const d = new Date(ts);
      if (isNaN(d)) return;
      el.title = d.toLocaleString();
      el.textContent = formatRelativeTime(d);
    });
  }

  setTimeoutImpl(function tickRelativeTimes() {
    updateRelativeTimes();
    setTimeoutImpl(tickRelativeTimes, 60000);
  }, 60000);

  const COLLAPSED_STORAGE_KEY = 'pi-sessions:collapsed-projects';
  function readCollapsed() {
    try {
      const raw = windowImpl.localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
  }

  function writeCollapsed(state) {
    try { windowImpl.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function initProjectGroups() {
    const collapsed = readCollapsed();
    const groups = documentImpl.querySelectorAll('.project-group');
    groups.forEach((group) => {
      const project = group.dataset.project || '';
      const toggle = group.querySelector('.project-toggle');
      const countEl = group.querySelector('[data-project-count]');
      const total = group.querySelectorAll('.session-card').length;
      if (countEl) {
        countEl.dataset.total = String(total);
        countEl.textContent = `${total} sessions`;
      }
      if (collapsed[project]) {
        group.classList.add('collapsed');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
      if (toggle) {
        // Remove existing listener to prevent duplicate binding
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        newToggle.addEventListener('click', () => {
          const willCollapse = !group.classList.contains('collapsed');
          group.classList.toggle('collapsed', willCollapse);
          newToggle.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
          const state = readCollapsed();
          if (willCollapse) state[project] = 1; else delete state[project];
          writeCollapsed(state);
        });
      }
    });
  }

  function updateRunningCounts() {
    let total = 0;
    documentImpl.querySelectorAll('.project-group').forEach((group) => {
      const running = group.querySelectorAll('.session-card--running').length;
      total += running;
      const countEl = group.querySelector('[data-project-count]');
      if (countEl) {
        countEl.setAttribute('data-running', String(running));
        const totalVal = countEl.dataset.total || String(group.querySelectorAll('.session-card').length);
        countEl.textContent = running > 0 ? `(${running} active)` : `${totalVal} sessions`;
      }
    });
    documentImpl.querySelectorAll('[data-running-count]').forEach((countEl) => {
      countEl.textContent = String(total);
    });
    documentImpl.querySelectorAll('[data-running-stat]').forEach((statEl) => {
      statEl.classList.toggle('visible', total > 0);
    });
  }

  let runningObserver = null;
  function start() {
    initProjectGroups();
    updateRunningCounts();
    updateRelativeTimes();
    if (runningObserver) runningObserver.disconnect();
    if (typeof windowImpl.MutationObserver !== 'undefined') {
      runningObserver = new windowImpl.MutationObserver(updateRunningCounts);
      documentImpl.querySelectorAll('.session-card').forEach((card) => {
        runningObserver.observe(card, { attributes: true, attributeFilter: ['class'] });
      });
    }
  }

  documentImpl.addEventListener('pi-index-sessions-rendered', start);
  start();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && (document.getElementById('session-palette-search') || document.getElementById('search') || document.querySelector('[data-sessions-content]'))) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => runIndexPage());
  } else {
    runIndexPage();
  }
}
