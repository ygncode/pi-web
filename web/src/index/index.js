import { createSessionsPage } from './sessions-page.js';
import { setupKeyboardNav } from '../shared/keyboard-nav.js';
import { toggleTheme, syncThemeIcons } from '../shared/theme.js';
import { setupSessionListPalette } from '../shared/session-list-palette.js';
import { createVersionController } from '../shared/version.js';
import { configureSettingsSync, hydrateSettings, writeSetting } from '../shared/settings-store.js';

export { createSessionsPage };

export function runIndexPage({
  documentImpl = document,
  windowImpl = window,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
} = {}) {
  configureSettingsSync({ fetchImpl: windowImpl.fetch ? windowImpl.fetch.bind(windowImpl) : undefined });

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
  const layoutBtns = Array.from(documentImpl.querySelectorAll('[data-layout-btn]'));
  const layoutStorageKey = 'pi-sessions:view-layout';
  const manageProjectsBtns = Array.from(documentImpl.querySelectorAll('[data-manage-projects-btn]'));
  const projectsModalOverlay = documentImpl.getElementById('projectsModalOverlay');
  const projectsModalBackBtn = documentImpl.getElementById('projectsModalBackBtn');
  const projectsDoneBtn = documentImpl.getElementById('projectsDoneBtn');
  const projectsList = documentImpl.getElementById('projectsList');
  const projectsAddPath = documentImpl.getElementById('projectsAddPath');
  const projectsAddBtn = documentImpl.getElementById('projectsAddBtn');
  const projectsModalError = documentImpl.getElementById('projectsModalError');
  const projectsSearch = documentImpl.getElementById('projectsSearch');
  const projectsToggleAllBtn = documentImpl.getElementById('projectsToggleAllBtn');
  const projectsFilterToggle = documentImpl.getElementById('projectsFilterToggle');
  const projectsFilterDesc = documentImpl.getElementById('projectsFilterDesc');
  const projectsConfig = documentImpl.getElementById('projectsConfig');

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
      writeSetting(layoutStorageKey, layout, { storage: windowImpl.localStorage });
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
      else if (projectsModalOpen) hideProjectsModal();
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

  // ── Manage projects modal ──

  let projectsModalHideTimer = null;
  let projectsModalOpen = false;

  function showProjectsModal() {
    closeMenu();
    if (!projectsModalOverlay) return;
    if (projectsModalHideTimer) {
      clearTimeoutImpl(projectsModalHideTimer);
      projectsModalHideTimer = null;
    }
    projectsModalOpen = true;
    projectsModalOverlay.classList.add('visible');
    documentImpl.body?.classList.add('modal-sheet-open');
    const requestFrame = windowImpl.requestAnimationFrame?.bind(windowImpl) || ((fn) => setTimeoutImpl(fn, 0));
    requestFrame(() => projectsModalOverlay.classList.add('open'));
  }

  function hideProjectsModal() {
    projectsModalOpen = false;
    if (projectsModalOverlay) {
      projectsModalOverlay.classList.remove('open');
      if (projectsModalHideTimer) clearTimeoutImpl(projectsModalHideTimer);
      projectsModalHideTimer = setTimeoutImpl(() => {
        projectsModalOverlay.classList.remove('visible');
        projectsModalHideTimer = null;
      }, 300);
    }
    documentImpl.body?.classList.remove('modal-sheet-open');
  }

  let projectsCache = [];

  function applyProjectsSearch() {
    if (!projectsList) return;
    const q = (projectsSearch?.value || '').trim().toLowerCase();
    const rows = projectsList.querySelectorAll('.project-row');
    let anyVisible = false;
    rows.forEach((row) => {
      const match = !q || (row.dataset.path || '').toLowerCase().includes(q);
      row.classList.toggle('hidden', !match);
      if (match) anyVisible = true;
    });
    let noResults = projectsList.querySelector('[data-projects-no-results]');
    if (q && rows.length && !anyVisible) {
      if (!noResults) {
        noResults = documentImpl.createElement('div');
        noResults.className = 'projects-empty';
        noResults.setAttribute('data-projects-no-results', '');
        noResults.textContent = 'No projects match your search.';
        projectsList.appendChild(noResults);
      }
      noResults.classList.remove('hidden');
    } else if (noResults) {
      noResults.classList.add('hidden');
    }
  }

  function updateToggleAllLabel() {
    if (!projectsToggleAllBtn) return;
    const allEnabled = projectsCache.length > 0 && projectsCache.every((p) => p.enabled);
    projectsToggleAllBtn.textContent = allEnabled ? 'Deselect all' : 'Select all';
    projectsToggleAllBtn.dataset.target = allEnabled ? 'disable' : 'enable';
    projectsToggleAllBtn.disabled = projectsCache.length === 0;
  }

  function renderProjectsList(projects) {
    if (!projectsList) return;
    projectsCache = projects;
    updateToggleAllLabel();
    projectsList.innerHTML = '';
    if (!projects.length) {
      const empty = documentImpl.createElement('div');
      empty.className = 'projects-empty';
      empty.textContent = 'No projects found yet.';
      projectsList.appendChild(empty);
      return;
    }
    for (const project of projects) {
      const row = documentImpl.createElement('div');
      row.className = 'project-row';
      row.dataset.path = project.path;

      const checkbox = documentImpl.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!project.enabled;
      const applyToggle = async () => {
        checkbox.disabled = true;
        try {
          await page.setProjectEnabled(project.path, checkbox.checked);
        } catch (err) {
          checkbox.checked = !checkbox.checked;
          if (projectsModalError) projectsModalError.textContent = err.message || 'Failed to update project';
        } finally {
          checkbox.disabled = false;
        }
      };
      checkbox.addEventListener('change', applyToggle);

      const name = documentImpl.createElement('span');
      name.className = 'project-row-name';
      const nameText = documentImpl.createElement('bdi');
      nameText.textContent = project.path;
      name.appendChild(nameText);
      name.title = project.path;
      name.addEventListener('click', () => {
        if (checkbox.disabled) return;
        checkbox.checked = !checkbox.checked;
        applyToggle();
      });

      const meta = documentImpl.createElement('span');
      meta.className = 'project-row-count';
      const count = project.sessionCount || 0;
      meta.textContent = count === 1 ? '1 session' : `${count} sessions`;

      row.appendChild(checkbox);
      row.appendChild(name);
      row.appendChild(meta);

      if (project.source === 'registered') {
        const remove = documentImpl.createElement('button');
        remove.type = 'button';
        remove.className = 'project-row-remove';
        remove.textContent = 'Remove';
        remove.addEventListener('click', async () => {
          remove.disabled = true;
          try {
            await page.removeProject(project.path);
            await refreshProjectsList();
          } catch (err) {
            remove.disabled = false;
            if (projectsModalError) projectsModalError.textContent = err.message || 'Failed to remove project';
          }
        });
        row.appendChild(remove);
      }

      projectsList.appendChild(row);
    }
    applyProjectsSearch();
  }

  function syncFilterToggle(filterEnabled) {
    if (projectsFilterToggle) projectsFilterToggle.checked = filterEnabled;
    if (projectsConfig) projectsConfig.classList.toggle('filter-off', !filterEnabled);
    if (projectsFilterDesc) {
      projectsFilterDesc.textContent = filterEnabled
        ? 'Only checked projects appear on the homepage.'
        : 'All projects are shown. Turn on to show only the checked ones.';
    }
  }

  async function refreshProjectsList() {
    if (projectsModalError) projectsModalError.textContent = '';
    try {
      const { projects, filterEnabled } = await page.loadProjects();
      renderProjectsList(projects);
      syncFilterToggle(filterEnabled);
    } catch (err) {
      if (projectsModalError) projectsModalError.textContent = err.message || 'Failed to load projects';
    }
  }

  async function openProjectsModal() {
    showProjectsModal();
    if (projectsAddPath) projectsAddPath.value = '';
    if (projectsSearch) projectsSearch.value = '';
    await refreshProjectsList();
  }

  async function doRegisterProject() {
    if (!projectsAddPath) return;
    const path = projectsAddPath.value.trim();
    if (!path) return;
    if (projectsModalError) projectsModalError.textContent = '';
    if (projectsAddBtn) projectsAddBtn.disabled = true;
    try {
      await page.registerProject(path);
      projectsAddPath.value = '';
      await refreshProjectsList();
    } catch (err) {
      if (projectsModalError) projectsModalError.textContent = err.message || 'Failed to add project';
    } finally {
      if (projectsAddBtn) projectsAddBtn.disabled = false;
    }
  }

  async function doToggleAll() {
    if (!projectsToggleAllBtn) return;
    const enable = projectsToggleAllBtn.dataset.target !== 'disable';
    projectsToggleAllBtn.disabled = true;
    if (projectsModalError) projectsModalError.textContent = '';
    try {
      await page.setAllProjectsEnabled(enable);
      await refreshProjectsList();
    } catch (err) {
      if (projectsModalError) projectsModalError.textContent = err.message || 'Failed to update projects';
      projectsToggleAllBtn.disabled = false;
    }
  }

  manageProjectsBtns.forEach((btn) => {
    btn.addEventListener('click', openProjectsModal);
  });

  if (projectsSearch) projectsSearch.addEventListener('input', applyProjectsSearch);
  if (projectsToggleAllBtn) projectsToggleAllBtn.addEventListener('click', doToggleAll);
  if (projectsFilterToggle) {
    projectsFilterToggle.addEventListener('change', async () => {
      const enabled = projectsFilterToggle.checked;
      projectsFilterToggle.disabled = true;
      syncFilterToggle(enabled);
      if (projectsModalError) projectsModalError.textContent = '';
      try {
        await page.setFilterEnabled(enabled);
      } catch (err) {
        syncFilterToggle(!enabled);
        if (projectsModalError) projectsModalError.textContent = err.message || 'Failed to update filter';
      } finally {
        projectsFilterToggle.disabled = false;
      }
    });
  }

  if (projectsModalBackBtn) projectsModalBackBtn.addEventListener('click', hideProjectsModal);
  if (projectsDoneBtn) projectsDoneBtn.addEventListener('click', hideProjectsModal);
  if (projectsAddBtn) projectsAddBtn.addEventListener('click', doRegisterProject);
  if (projectsAddPath) {
    projectsAddPath.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doRegisterProject();
      }
    });
  }
  if (projectsModalOverlay) {
    projectsModalOverlay.addEventListener('click', (e) => {
      if (e.target === projectsModalOverlay) hideProjectsModal();
    });
  }

  let initialLayout = 'timeline';
  try {
    initialLayout = windowImpl.localStorage.getItem(layoutStorageKey) === 'projects' ? 'projects' : 'timeline';
  } catch (_) {}
  setLayoutButtonState(initialLayout);

  // Pull server-backed settings and reconcile the layout control. Theme is
  // already injected server-side; this catches cross-browser drift for the
  // default layout without blocking first paint.
  hydrateSettings({ storage: windowImpl.localStorage }).then((settings) => {
    if (!settings) return;
    const serverLayout = settings[layoutStorageKey] === 'projects' ? 'projects' : 'timeline';
    if (serverLayout !== (documentImpl.documentElement.dataset.sessionLayout || 'timeline')) {
      setLayoutButtonState(serverLayout);
      page.setLayout(serverLayout)
        .then(() => sessionPalette.refresh())
        .catch(() => {})
        .finally(markLayoutReady);
    }
  });

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
