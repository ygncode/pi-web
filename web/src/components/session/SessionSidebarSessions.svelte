<script>
  import { onMount, tick, untrack } from 'svelte';
  import {
    icon,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FolderGit2,
    Search,
  } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
  import { handleNavClick } from '../../shared/navigation.js';
  import {
    defaultFetchProjects,
    defaultFetchSessions,
    formatRelativeTime,
    groupSessionsByDate,
    normalizeSession,
    sessionModelLabel,
    sessionsCountLabel,
  } from '../../index/sessions.js';
  import { prefetchSession } from '../../routes/session-prefetch.js';
  import { getSpinnerConfig } from '../../session/live/chat-preview.js';
  import { sessionRuntime } from '../../session/session-runtime.js';

  let {
    cwd = '',
    currentSessionId = '',
    fetchSessions = defaultFetchSessions,
    fetchProjects = defaultFetchProjects,
    runningSessionIds = null,
  } = $props();

  let sessions = $state([]);
  let totalSessions = $state(0);
  let projectSessionCount = $state(0);
  let currentPage = $state(0);
  let query = $state('');
  let loading = $state(true);
  let error = $state('');
  let now = $state(Date.now());
  let spinnerChar = $state('');
  let spinnerStyle = $state('');
  let selectedProject = $state(untrack(() => cwd));
  let projects = $state([]);
  let projectsOpen = $state(false);
  let projectsLoading = $state(false);
  let projectsError = $state('');
  let projectQuery = $state('');
  let projectSwitcherEl = $state(null);
  let projectSearchEl = $state(null);
  let sessionListEl = $state(null);
  let sessionLoadGeneration = 0;
  let sessionSearchTimer = null;

  const pageSize = 20;
  const activeSessionCat = getSpinnerConfig(null);
  const activeSessionCatStyle = `font-family:${activeSessionCat.fontFamily}`;
  const projectName = $derived(
    selectedProject.split(/[\\/]/).filter(Boolean).at(-1) || selectedProject,
  );
  const filteredProjects = $derived.by(() => {
    const normalizedQuery = projectQuery.trim().toLowerCase();
    if (!normalizedQuery) return projects;
    return projects.filter((project) =>
      String(project.path || '')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  });
  const groupedSessions = $derived(groupSessionsByDate(sessions, now));
  const pageStart = $derived(totalSessions && sessions.length ? currentPage * pageSize + 1 : 0);
  const pageEnd = $derived(pageStart ? pageStart + sessions.length - 1 : 0);
  const hasPreviousPage = $derived(currentPage > 0);
  const hasNextPage = $derived((currentPage + 1) * pageSize < totalSessions);

  const dateBucketKeys = {
    today: 'index.dateToday',
    yesterday: 'index.dateYesterday',
    previous7days: 'index.datePrevious7Days',
    previous30days: 'index.datePrevious30Days',
    older: 'index.dateOlder',
  };

  function startPrefetch(sessionId) {
    if (sessionId) prefetchSession(sessionId);
  }

  function isRunning(sessionId) {
    return !!runningSessionIds?.has(sessionId);
  }

  async function loadProjectSessions(
    project,
    { pageIndex = currentPage, searchQuery = query.trim() } = {},
  ) {
    const generation = ++sessionLoadGeneration;
    loading = true;
    error = '';
    try {
      const response = await fetchSessions({
        project,
        limit: pageSize,
        offset: pageIndex * pageSize,
        ...(searchQuery ? { query: searchQuery } : {}),
      });
      if (generation !== sessionLoadGeneration) return;
      sessions = (response.sessions || []).map(normalizeSession);
      totalSessions = response.total ?? sessions.length;
      if (!searchQuery) projectSessionCount = totalSessions;
      currentPage = pageIndex;
      await tick();
      sessionListEl?.scrollTo?.({ top: 0 });
    } catch (err) {
      if (generation !== sessionLoadGeneration) return;
      sessions = [];
      totalSessions = 0;
      if (!searchQuery) projectSessionCount = 0;
      error = err?.message || t('session.sessionsLoadFailed');
    } finally {
      if (generation === sessionLoadGeneration) loading = false;
    }
  }

  async function openProjectSwitcher() {
    projectsOpen = true;
    projectsLoading = true;
    projectsError = '';
    projectQuery = '';
    await tick();
    projectSearchEl?.focus();
    try {
      const response = await fetchProjects({ filtered: true });
      projects = Array.isArray(response.projects) ? response.projects : [];
    } catch (err) {
      projects = [];
      projectsError = err?.message || t('index.failedLoadProjects');
    } finally {
      projectsLoading = false;
    }
  }

  function selectProject(project) {
    projectsOpen = false;
    if (!project || project === selectedProject) return;
    if (sessionSearchTimer) clearTimeout(sessionSearchTimer);
    query = '';
    selectedProject = project;
    loadProjectSessions(project, { pageIndex: 0, searchQuery: '' });
  }

  function onSessionSearch(event) {
    query = event.currentTarget.value;
    if (sessionSearchTimer) clearTimeout(sessionSearchTimer);
    sessionSearchTimer = setTimeout(() => {
      sessionSearchTimer = null;
      loadProjectSessions(selectedProject, { pageIndex: 0, searchQuery: query.trim() });
    }, 250);
  }

  function changePage(offset) {
    const pageIndex = currentPage + offset;
    if (pageIndex < 0 || pageIndex * pageSize >= totalSessions) return;
    loadProjectSessions(selectedProject, { pageIndex });
  }

  $effect(() => {
    if (!runningSessionIds?.size) {
      spinnerChar = '';
      spinnerStyle = '';
      return;
    }

    const config = getSpinnerConfig(window);
    let frame = 0;
    spinnerChar = config.frames[0] || '';
    spinnerStyle = `font-family:${config.fontFamily};width:${config.width}`;
    const timer = window.setInterval(() => {
      frame = (frame + 1) % config.frames.length;
      spinnerChar = config.frames[frame] || '';
    }, config.interval);
    return () => window.clearInterval(timer);
  });

  function onSessionClick(event, href) {
    handleNavClick(event, href);
    if (sessionRuntime.layout?.isMobileLayout?.()) sessionRuntime.layout?.closeSidebar?.();
  }

  onMount(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 60000);
    const onDocumentClick = (event) => {
      if (projectsOpen && !projectSwitcherEl?.contains(event.target)) projectsOpen = false;
    };
    const onDocumentKeydown = (event) => {
      if (event.key === 'Escape' && projectsOpen) {
        event.preventDefault();
        projectsOpen = false;
      }
    };

    if (selectedProject) loadProjectSessions(selectedProject, { pageIndex: 0, searchQuery: '' });
    else loading = false;
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown);

    return () => {
      sessionLoadGeneration += 1;
      if (sessionSearchTimer) clearTimeout(sessionSearchTimer);
      clearInterval(timer);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeydown);
    };
  });
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG -->

<div class="sidebar-session-controls">
  {#if cwd}
    <div class="sidebar-project-switcher" bind:this={projectSwitcherEl}>
      <button
        type="button"
        class="sidebar-project"
        title={`${t('session.switchProject')}: ${selectedProject}`}
        aria-haspopup="dialog"
        aria-expanded={projectsOpen}
        aria-controls="sidebar-project-picker"
        onclick={() => (projectsOpen ? (projectsOpen = false) : openProjectSwitcher())}
      >
        <span class="sidebar-project-icon">{@html icon(FolderGit2, { size: 15 })}</span>
        <span class="sidebar-project-copy">
          <span class="sidebar-project-label"
            >{t(
              selectedProject === cwd ? 'session.currentProject' : 'session.browsingProject',
            )}</span
          >
          <span class="sidebar-project-name">{projectName}</span>
        </span>
        {#if !loading && !error}
          <span
            class="sidebar-project-count"
            title={sessionsCountLabel(projectSessionCount)}
            aria-label={sessionsCountLabel(projectSessionCount)}>{projectSessionCount}</span
          >
        {/if}
        <span class="sidebar-project-chevron">{@html icon(ChevronDown, { size: 13 })}</span>
      </button>

      {#if projectsOpen}
        <div
          id="sidebar-project-picker"
          class="sidebar-project-picker"
          role="dialog"
          aria-label={t('session.switchProject')}
        >
          <label class="sidebar-project-search">
            <span>{@html icon(Search, { size: 13 })}</span>
            <input
              type="search"
              bind:this={projectSearchEl}
              bind:value={projectQuery}
              placeholder={t('index.searchProjects')}
              aria-label={t('index.searchProjects')}
            />
          </label>
          <div class="sidebar-project-options">
            {#if projectsLoading}
              <div class="sidebar-project-state">{t('session.loadingProjects')}</div>
            {:else if projectsError}
              <div class="sidebar-project-state sidebar-project-state--error">
                {projectsError}
              </div>
            {:else if filteredProjects.length === 0}
              <div class="sidebar-project-state">
                {projectQuery.trim() ? t('index.noProjectsMatch') : t('index.noProjectsFound')}
              </div>
            {:else}
              {#each filteredProjects as project (project.path)}
                {@const name = project.path.split(/[\\/]/).filter(Boolean).at(-1) || project.path}
                <button
                  type="button"
                  class="sidebar-project-option"
                  class:active={project.path === selectedProject}
                  title={project.path}
                  onclick={() => selectProject(project.path)}
                >
                  <span class="sidebar-project-option-copy">
                    <span class="sidebar-project-option-name">{name}</span>
                    <span class="sidebar-project-option-path">{project.path}</span>
                  </span>
                  <span class="sidebar-project-option-count">{project.sessionCount || 0}</span>
                  {#if project.path === selectedProject}
                    <span class="sidebar-project-option-check"
                      >{@html icon(Check, { size: 13 })}</span
                    >
                  {/if}
                </button>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
  <label class="sidebar-search-shell">
    <span class="sidebar-search-icon">{@html icon(Search, { size: 13 })}</span>
    <input
      type="search"
      class="sidebar-search"
      value={query}
      oninput={onSessionSearch}
      placeholder={t('session.searchProjectSessions')}
      aria-label={t('session.searchProjectSessions')}
    />
  </label>
</div>

<div class="sidebar-session-list" aria-live="polite" bind:this={sessionListEl}>
  {#if loading}
    <div class="sidebar-session-state">{t('index.loadingSessions')}</div>
  {:else if error}
    <div class="sidebar-session-state sidebar-session-state--error">{error}</div>
  {:else if !selectedProject}
    <div class="sidebar-session-state">{t('session.projectUnavailable')}</div>
  {:else if sessions.length === 0}
    <div class="sidebar-session-state">
      {query.trim() ? t('session.noMatchingProjectSessions') : t('session.noProjectSessions')}
    </div>
  {:else}
    {#each groupedSessions as group (group.bucket)}
      <section class="sidebar-session-group">
        {#if !query.trim()}
          <h2 class="sidebar-session-group-heading">
            <span>{t(dateBucketKeys[group.bucket])}</span>
            <span class="sidebar-session-group-count">{group.sessions.length}</span>
          </h2>
        {/if}
        {#each group.sessions as session (session.id)}
          {@const href = `/session?id=${encodeURIComponent(session.id)}`}
          {@const activeSession = selectedProject === cwd && session.id === currentSessionId}
          <a
            class="sidebar-session-row"
            class:sidebar-session-row--active={activeSession}
            class:sidebar-session-row--running={isRunning(session.id)}
            {href}
            aria-current={activeSession ? 'page' : undefined}
            onclick={(event) => onSessionClick(event, href)}
            onpointerenter={() => startPrefetch(session.id)}
            onmousedown={() => startPrefetch(session.id)}
            ontouchstart={() => startPrefetch(session.id)}
          >
            <span class="sidebar-session-copy">
              <span class="sidebar-session-heading">
                <span class="sidebar-session-title">{session.name || session.id}</span>
                {#if activeSession}
                  <span
                    class="sidebar-session-indicator"
                    class:sidebar-session-indicator--running={isRunning(session.id)}
                    aria-hidden={isRunning(session.id) ? undefined : 'true'}
                    aria-label={isRunning(session.id) ? t('index.active') : undefined}
                    style={activeSessionCatStyle}>{activeSessionCat.frames[0]}</span
                  >
                {/if}
                {#if isRunning(session.id) && !activeSession}
                  <span
                    class="sidebar-running-spinner"
                    data-running-spinner
                    aria-label={t('index.active')}
                    style={spinnerStyle}>{spinnerChar}</span
                  >
                {/if}
              </span>
              <span class="sidebar-session-meta">
                <span title={session.lastActivity}
                  >{formatRelativeTime(session.lastActivity, now)}</span
                >
                {#if sessionModelLabel(session)}
                  <span class="sidebar-session-model" title={sessionModelLabel(session)}
                    >{sessionModelLabel(session)}</span
                  >
                {/if}
              </span>
            </span>
          </a>
        {/each}
      </section>
    {/each}
  {/if}
</div>
<div class="tree-status sidebar-session-status" id="sidebar-session-status">
  <span>
    {t('session.sessionsPageStatus', {
      start: pageStart,
      end: pageEnd,
      total: totalSessions,
    })}
  </span>
  <span class="sidebar-session-pagination">
    <button
      type="button"
      title={t('session.previousSessionsPage')}
      aria-label={t('session.previousSessionsPage')}
      disabled={loading || !hasPreviousPage}
      onclick={() => changePage(-1)}
    >
      {@html icon(ChevronLeft, { size: 13 })}
    </button>
    <button
      type="button"
      title={t('session.nextSessionsPage')}
      aria-label={t('session.nextSessionsPage')}
      disabled={loading || !hasNextPage}
      onclick={() => changePage(1)}
    >
      {@html icon(ChevronRight, { size: 13 })}
    </button>
  </span>
</div>
