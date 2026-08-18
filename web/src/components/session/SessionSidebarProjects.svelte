<script>
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { icon, ChevronRight, Folder, FolderOpen } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
  import { handleNavClick } from '../../shared/navigation.js';
  import {
    defaultFetchProjects,
    defaultFetchSessions,
    normalizeSession,
  } from '../../index/sessions.js';
  import { prefetchSession } from '../../routes/session-prefetch.js';
  import { getSpinnerConfig } from '../../session/live/chat-preview.js';
  import { sessionRuntime } from '../../session/session-runtime.js';

  let {
    cwd = '',
    currentSessionId = '',
    fetchProjects = defaultFetchProjects,
    fetchSessions = defaultFetchSessions,
    runningSessionIds = null,
    runningSessionProjects = null,
  } = $props();

  let projects = $state([]);
  let loading = $state(true);
  let error = $state('');
  let spinnerChar = $state('');
  let spinnerStyle = $state('');
  let totalProjects = $state(0);
  let projectsLoaded = $state(false);
  let projectsLoadingMore = $state(false);
  let projectsLoadMoreError = $state('');
  let destroyed = false;

  const projectPageSize = 20;
  const sessionPageSize = 5;
  const activeSessionCat = getSpinnerConfig(null);
  const activeSessionCatStyle = `font-family:${activeSessionCat.fontFamily}`;
  const sortedProjects = $derived(
    [...projects].sort((a, b) => Number(b.path === cwd) - Number(a.path === cwd)),
  );
  const liveRunningProjects = $derived.by(() => {
    const paths = new SvelteSet();
    if (!runningSessionProjects) return paths;
    for (const [sessionId, project] of runningSessionProjects) {
      if (project && isRunning(sessionId)) paths.add(project);
    }
    return paths;
  });

  function projectName(path) {
    return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
  }

  function isRunning(sessionId) {
    return !!runningSessionIds?.has(sessionId);
  }

  function startPrefetch(sessionId) {
    if (sessionId) prefetchSession(sessionId);
  }

  function isProjectRunning(project) {
    if (liveRunningProjects.has(project.path)) return true;
    if (project.runningSessionIds?.some((sessionId) => isRunning(sessionId))) return true;
    return project.sessions.some((session) => isRunning(session.id));
  }

  async function loadMoreProjectSessions(project) {
    if (
      project.sessionsLoading ||
      (project.sessionsLoaded && project.sessions.length >= project.sessionsTotal)
    ) {
      return;
    }

    project.sessionsLoading = true;
    project.sessionsError = '';
    try {
      const response = await fetchSessions({
        project: project.path,
        limit: sessionPageSize,
        offset: project.sessions.length,
      });
      if (destroyed) return;
      const nextSessions = (response.sessions || []).map(normalizeSession);
      const knownSessionIds = new Set(project.sessions.map((session) => session.id));
      project.sessions.push(...nextSessions.filter((session) => !knownSessionIds.has(session.id)));
      project.sessionsTotal = response.total ?? project.sessions.length;
      project.sessionsLoaded = true;
    } catch (err) {
      if (destroyed) return;
      project.sessionsError = err?.message || t('session.sessionsLoadFailed');
      project.sessionsLoaded = true;
    } finally {
      if (!destroyed) project.sessionsLoading = false;
    }
  }

  function toggleProject(project) {
    project.expanded = !project.expanded;
    if (project.expanded && !project.sessionsLoaded) loadMoreProjectSessions(project);
  }

  function onProjectSessionsScroll(event, project) {
    const list = event.currentTarget;
    if (list.scrollHeight - list.scrollTop - list.clientHeight > 24) return;
    loadMoreProjectSessions(project);
  }

  async function loadMoreProjects(retryTransient = true) {
    if (projectsLoadingMore || (projectsLoaded && projects.length >= totalProjects)) {
      return;
    }

    projectsLoadingMore = true;
    projectsLoadMoreError = '';
    try {
      const response = await fetchProjects({
        limit: projectPageSize,
        offset: projects.length,
        currentProject: cwd,
        currentSessionLimit: sessionPageSize,
        filtered: true,
      });
      if (destroyed) return;
      const knownProjectPaths = new Set(projects.map((project) => project.path));
      const nextProjects = (Array.isArray(response.projects) ? response.projects : [])
        .filter((project) => !knownProjectPaths.has(project.path))
        .map((project) => {
          const expanded = project.path === cwd;
          const hasBundledSessions = expanded && Array.isArray(response.currentSessions);
          const bundledSessions = hasBundledSessions
            ? response.currentSessions.map(normalizeSession)
            : [];
          return {
            ...project,
            expanded,
            sessions: bundledSessions,
            sessionsTotal: hasBundledSessions
              ? (response.currentSessionsTotal ?? bundledSessions.length)
              : project.sessionCount || 0,
            sessionsLoaded: hasBundledSessions,
            sessionsLoading: false,
            sessionsError: '',
          };
        });
      projects.push(...nextProjects);
      totalProjects = response.total ?? projects.length;
      projectsLoaded = true;
      const currentProject = nextProjects.find((project) => project.expanded);
      if (currentProject && !currentProject.sessionsLoaded) {
        loadMoreProjectSessions(currentProject);
      }
    } catch (err) {
      if (destroyed) return;
      if (retryTransient && err instanceof TypeError) {
        projectsLoadingMore = false;
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        if (!destroyed) return loadMoreProjects(false);
        return;
      }
      const message = err?.message || t('index.failedLoadProjects');
      if (projects.length === 0) error = message;
      else projectsLoadMoreError = message;
    } finally {
      if (!destroyed) projectsLoadingMore = false;
    }
  }

  function onProjectsScroll(event) {
    const list = event.currentTarget;
    if (list.scrollHeight - list.scrollTop - list.clientHeight > 40) return;
    loadMoreProjects();
  }

  function onSessionClick(event, href) {
    handleNavClick(event, href);
    if (sessionRuntime.layout?.isMobileLayout?.()) sessionRuntime.layout?.closeSidebar?.();
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

  onMount(() => {
    destroyed = false;
    loadMoreProjects().finally(() => {
      if (!destroyed) loading = false;
    });

    return () => {
      destroyed = true;
    };
  });
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG -->

<div class="sidebar-projects-list" aria-live="polite" onscroll={onProjectsScroll}>
  {#if loading}
    <div class="sidebar-session-state">{t('session.loadingProjects')}</div>
  {:else if error}
    <div class="sidebar-session-state sidebar-session-state--error">{error}</div>
  {:else if sortedProjects.length === 0}
    <div class="sidebar-session-state">{t('index.noProjectsFound')}</div>
  {:else}
    {#each sortedProjects as project, projectIndex (project.path)}
      {@const name = projectName(project.path)}
      <section
        class="sidebar-project-group"
        class:sidebar-project-group--current={project.path === cwd}
      >
        <button
          type="button"
          class="sidebar-project-heading"
          title={project.path}
          aria-expanded={project.expanded}
          aria-controls={`sidebar-project-sessions-${projectIndex}`}
          onclick={() => toggleProject(project)}
        >
          <span
            class="sidebar-project-disclosure"
            class:sidebar-project-disclosure--expanded={project.expanded}
          >
            {@html icon(ChevronRight, { size: 12, strokeWidth: 1.8 })}
          </span>
          <span class="sidebar-project-folder">
            {@html icon(project.expanded ? FolderOpen : Folder, { size: 15, strokeWidth: 1.7 })}
          </span>
          <span class="sidebar-project-title">{name}</span>
          <span class="sidebar-project-session-count">{project.sessionCount || 0}</span>
          {#if isProjectRunning(project)}
            <span
              class="sidebar-project-running-spinner"
              data-project-running-spinner
              aria-label={t('session.projectActive')}
              style={spinnerStyle}>{spinnerChar}</span
            >
          {/if}
        </button>

        {#if project.expanded}
          <div
            id={`sidebar-project-sessions-${projectIndex}`}
            class="sidebar-project-sessions"
            class:sidebar-project-sessions--scrollable={project.sessionsLoaded &&
              project.sessionsTotal > sessionPageSize}
            role="region"
            aria-label={t('session.projectSessions', { project: name })}
            onscroll={(event) => onProjectSessionsScroll(event, project)}
          >
            {#each project.sessions as session (session.id)}
              {@const activeSession = session.id === currentSessionId}
              {@const href = `/session?id=${encodeURIComponent(session.id)}`}
              <a
                class="sidebar-project-session"
                class:sidebar-project-session--active={activeSession}
                class:sidebar-project-session--running={isRunning(session.id)}
                {href}
                aria-current={activeSession ? 'page' : undefined}
                onclick={(event) => onSessionClick(event, href)}
                onpointerenter={() => startPrefetch(session.id)}
                onmousedown={() => startPrefetch(session.id)}
                ontouchstart={() => startPrefetch(session.id)}
              >
                <span class="sidebar-project-session-title">
                  {session.name || session.id}
                </span>
                {#if activeSession}
                  <span
                    class="sidebar-session-indicator"
                    class:sidebar-session-indicator--running={isRunning(session.id)}
                    aria-hidden={isRunning(session.id) ? undefined : 'true'}
                    aria-label={isRunning(session.id) ? t('index.active') : undefined}
                    style={activeSessionCatStyle}>{activeSessionCat.frames[0]}</span
                  >
                {:else if isRunning(session.id)}
                  <span
                    class="sidebar-running-spinner"
                    data-running-spinner
                    aria-label={t('index.active')}
                    style={spinnerStyle}>{spinnerChar}</span
                  >
                {/if}
              </a>
            {/each}

            {#if project.sessionsLoading}
              <div class="sidebar-project-sessions-state">
                {t('session.loadingProjectSessions')}
              </div>
            {:else if project.sessionsError}
              <div class="sidebar-project-sessions-state sidebar-project-sessions-state--error">
                {project.sessionsError}
              </div>
            {:else if project.sessionsLoaded && project.sessions.length === 0}
              <div class="sidebar-project-sessions-state">
                {t('session.noProjectSessions')}
              </div>
            {/if}
          </div>
        {/if}
      </section>
    {/each}
    {#if projectsLoadingMore}
      <div class="sidebar-project-load-more">{t('session.loadingMoreProjects')}</div>
    {:else if projectsLoadMoreError}
      <button
        type="button"
        class="sidebar-project-load-more sidebar-project-load-more--error"
        title={projectsLoadMoreError}
        onclick={() => loadMoreProjects()}
      >
        {t('session.projectsLoadMoreFailed')}
        <span class="sidebar-project-load-more-retry">{t('common.retry')}</span>
      </button>
    {/if}
  {/if}
</div>

<div class="tree-status">
  {t('session.projectsStatus', { loaded: projects.length, total: totalProjects })}
</div>
