<script>
  import { onMount, tick } from 'svelte';
  import CommandPalette from '../components/shared/CommandPalette.svelte';
  import HomeMenu from '../components/index/HomeMenu.svelte';
  import IndexHeader from '../components/index/IndexHeader.svelte';
  import NewSessionModal from '../components/index/NewSessionModal.svelte';
  import ProjectsModal from '../components/index/ProjectsModal.svelte';
  import SessionsList from '../components/index/SessionsList.svelte';
  import { createStatusEvents } from '../shared/status-events.js';
  import { setupKeyboardNav } from '../shared/keyboard-nav.js';
  import { toggleTheme, syncThemeIcons } from '../shared/theme.js';
  import { configureSettingsSync, hydrateSettings, writeSetting } from '../shared/settings-store.js';
  import { icon, Sun, Moon } from '../shared/icons.js';
  import { t } from '../shared/i18n.js';
  import {
    defaultCreateSession,
    defaultFetchProjects,
    defaultFetchRecent,
    defaultFetchSessions,
    defaultUpdateProject,
    layoutStorageKey,
    normalizeSession,
  } from '../index/sessions.js';

  let sessions = $state([]);
  let loading = $state(true);
  let layoutReady = $state(false);
  let query = $state('');
  let layout = $state('timeline');
  let runningSessionIds = $state(new Set());
  let runningStatuses = $state(new Map());
  let newSessionOpen = $state(false);
  let newSessionPath = $state('');
  let recentLocations = $state([]);
  let creating = $state(false);
  let newSessionError = $state('');
  let menuOpen = $state(false);
  let projectsOpen = $state(false);
  let projects = $state([]);
  let projectsFilterEnabled = $state(false);
  let projectsBusy = $state(false);
  let projectsError = $state('');
  let refreshInflight = false;
  let modalOpen = $derived(newSessionOpen || projectsOpen);

  const totalSessionsLabel = $derived(sessions.length === 1 ? t('index.sessionCountOne') : t('index.sessionsCount', { count: sessions.length }));
  const runningCount = $derived(runningSessionIds.size);

  function setRunningSessions(snapshot) {
    const ids = Array.isArray(snapshot) ? snapshot : snapshot?.ids;
    const statuses = snapshot && !Array.isArray(snapshot) ? snapshot.statuses : {};
    runningSessionIds = new Set(Array.isArray(ids) ? ids : []);
    runningStatuses = new Map(Object.entries(statuses || {}));
  }

  function setSessionRunning(id, running, status = {}) {
    const ids = new Set(runningSessionIds);
    const statuses = new Map(runningStatuses);
    if (running) {
      ids.add(id);
      statuses.set(id, status);
    } else {
      ids.delete(id);
      statuses.delete(id);
    }
    runningSessionIds = ids;
    runningStatuses = statuses;
  }

  async function refreshSessions() {
    if (refreshInflight || newSessionOpen) return;
    refreshInflight = true;
    try {
      const response = await defaultFetchSessions();
      sessions = (response.sessions || []).map(normalizeSession);
      await tick();
      window.__piSessionPalette?.refresh?.();
    } catch {
      // Keep existing list if a soft refresh fails.
    } finally {
      refreshInflight = false;
      loading = false;
      layoutReady = true;
    }
  }

  let reloadTimer = null;
  function scheduleReload() {
    if (reloadTimer) clearTimeout(reloadTimer);
    if (newSessionOpen || query.trim()) return;
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      refreshSessions();
    }, 500);
  }

  async function setLayout(nextLayout) {
    layout = nextLayout === 'projects' ? 'projects' : 'timeline';
    writeSetting(layoutStorageKey, layout, { storage: localStorage });
    await refreshSessions();
  }

  async function openNewSessionModal() {
    closeMenu();
    projectsOpen = false;
    newSessionOpen = true;
    newSessionPath = '';
    newSessionError = '';
    document.body?.classList.add('modal-sheet-open');
    try {
      const response = await defaultFetchRecent();
      recentLocations = (response.locations || []).slice(0, 10);
    } catch {
      recentLocations = [];
    }
    await tick();
    document.getElementById('sessionPath')?.focus();
  }

  function closeNewSessionModal() {
    newSessionOpen = false;
    document.body?.classList.remove('modal-sheet-open');
  }

  async function createSession() {
    const path = newSessionPath.trim();
    if (!path) {
      newSessionError = t('index.enterPath');
      return;
    }
    creating = true;
    newSessionError = '';
    try {
      const response = await defaultCreateSession(path);
      if (response.ok && response.id) {
        window.location.href = '/session?id=' + encodeURIComponent(response.id);
        return;
      }
      newSessionError = response.error || t('index.failedCreateSession');
    } catch (error) {
      newSessionError = error.message || t('index.networkError');
    } finally {
      creating = false;
    }
  }

  function closeMenu() { menuOpen = false; }
  function toggleMenu() { menuOpen = !menuOpen; }

  async function refreshProjectsList() {
    projectsError = '';
    projectsBusy = true;
    try {
      const response = await defaultFetchProjects();
      projects = Array.isArray(response.projects) ? response.projects : [];
      projectsFilterEnabled = !!response.filterEnabled;
    } catch (error) {
      projectsError = error.message || t('index.failedLoadProjects');
    } finally {
      projectsBusy = false;
    }
  }

  async function openProjectsModal() {
    closeMenu();
    newSessionOpen = false;
    projectsOpen = true;
    document.body?.classList.add('modal-sheet-open');
    await refreshProjectsList();
  }

  function closeProjectsModal() {
    projectsOpen = false;
    document.body?.classList.remove('modal-sheet-open');
  }

  async function updateProject(path, action) {
    projectsBusy = true;
    projectsError = '';
    try {
      await defaultUpdateProject(path, action);
      await refreshSessions();
      await refreshProjectsList();
    } catch (error) {
      projectsError = error.message || t('index.failedUpdateProject');
    } finally {
      projectsBusy = false;
    }
  }

  function openPalette() { window.__piOpenSessionPalette?.(); }

  onMount(() => {
    const previousTitle = document.title;
    document.title = 'Pi Sessions';
    configureSettingsSync({ fetchImpl: window.fetch.bind(window) });
    setupKeyboardNav({ windowImpl: window, documentImpl: document });

    try { layout = localStorage.getItem(layoutStorageKey) === 'projects' ? 'projects' : 'timeline'; } catch {}
    hydrateSettings({ storage: localStorage }).then((settings) => {
      if (!settings) return;
      const serverLayout = settings[layoutStorageKey] === 'projects' ? 'projects' : 'timeline';
      if (serverLayout !== layout) setLayout(serverLayout);
    }).catch(() => {});

    const statusEvents = createStatusEvents({
      onSnapshot: (snapshot) => setRunningSessions(snapshot),
      onDelta: (status) => setSessionRunning(status.id, status.running, status),
      onMessage: (message) => {
        if (message === 'new-session') refreshSessions();
        if (message === 'reload') scheduleReload();
      },
    });
    try { statusEvents.connect(); } catch {}

    const keydown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme(window, document);
        syncThemeIcons(document);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.key === 'Escape') {
        if (menuOpen) closeMenu();
        else if (projectsOpen) closeProjectsModal();
        else if (newSessionOpen) closeNewSessionModal();
      }
    };
    window.addEventListener('keydown', keydown, { capture: true });
    const click = () => closeMenu();
    window.addEventListener('click', click);

    refreshSessions();

    return () => {
      document.title = previousTitle;
      document.body?.classList.remove('modal-sheet-open');
      window.removeEventListener('keydown', keydown, { capture: true });
      window.removeEventListener('click', click);
      statusEvents.cleanup?.();
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  });
</script>

<IndexHeader
  {layout}
  {totalSessionsLabel}
  {runningCount}
  runningVisible={runningCount > 0}
  onSearch={openPalette}
  onToggleMenu={toggleMenu}
  onLayoutChange={setLayout}
/>

<HomeMenu
  open={menuOpen}
  onClose={closeMenu}
  onNewSession={openNewSessionModal}
  onManageProjects={openProjectsModal}
/>

<button class="new-session-btn new-session-btn-mobile" id="newSessionBtn" type="button" data-new-session-btn aria-label={t('index.startNewSession')} title={t('index.newSession')} onclick={openNewSessionModal}>+</button>

<CommandPalette onQueryChange={(q) => { query = q; }} onNewSession={openNewSessionModal} />

<SessionsList {sessions} {layout} {query} {runningSessionIds} {runningStatuses} {loading} {layoutReady} />

<NewSessionModal open={newSessionOpen} recent={recentLocations} bind:path={newSessionPath} creating={creating} error={newSessionError} onClose={closeNewSessionModal} onCreate={createSession} />

<ProjectsModal
  open={projectsOpen}
  {projects}
  filterEnabled={projectsFilterEnabled}
  error={projectsError}
  busy={projectsBusy}
  onClose={closeProjectsModal}
  onToggleProject={(path, enabled) => updateProject(path, enabled ? 'enable' : 'disable')}
  onToggleAll={(enabled) => updateProject('', enabled ? 'enable-all' : 'disable-all')}
  onToggleFilter={(enabled) => updateProject('', enabled ? 'enable-filter' : 'disable-filter')}
  onRegister={(path) => updateProject(path, 'register')}
  onRemove={(path) => updateProject(path, 'remove')}
/>

{#if modalOpen}
  <!-- class hook only; modals render their own overlays -->
{/if}
