<script>
  import { onMount } from 'svelte';
  import { icon, ChevronDown } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
  import {
    collapsedProjectsStorageKey,
    filterSessions,
    groupSessionsByProject,
    groupSessionsTimeline,
    sessionsCountLabel,
  } from '../../index/sessions.js';
  import SessionCard from './SessionCard.svelte';

  let {
    sessions = [],
    layout = 'timeline',
    query = '',
    runningSessionIds = new Set(),
    runningStatuses = new Map(),
    loading = false,
    layoutReady = false,
  } = $props();

  let now = $state(Date.now());
  let collapsed = $state({});

  const visibleSessions = $derived(filterSessions(sessions, query));
  const groups = $derived(layout === 'projects' ? groupSessionsByProject(visibleSessions) : groupSessionsTimeline(visibleSessions));
  const isTimeline = $derived(layout === 'timeline');

  function readCollapsed() {
    try {
      const raw = localStorage.getItem(collapsedProjectsStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeCollapsed(state) {
    try { localStorage.setItem(collapsedProjectsStorageKey, JSON.stringify(state)); } catch {}
  }

  function toggleProject(project) {
    collapsed = { ...collapsed, [project]: collapsed[project] ? undefined : 1 };
    if (!collapsed[project]) {
      const next = { ...collapsed };
      delete next[project];
      collapsed = next;
    }
    writeCollapsed(collapsed);
  }

  function runningCountFor(group) {
    return group.sessions.filter((session) => runningSessionIds.has(session.id)).length;
  }

  onMount(() => {
    collapsed = readCollapsed();
    const timer = setInterval(() => { now = Date.now(); }, 60000);
    return () => clearInterval(timer);
  });
</script>

<div class="content" class:content--timeline={isTimeline} class:index-layout-ready={layoutReady} data-sessions-content>
  {#if loading && sessions.length === 0}
    <div class="empty-state">
      <h3>{t('index.loadingSessions')}</h3>
      <p>{t('index.loadingSessionsHint')}</p>
    </div>
  {:else if sessions.length === 0}
    <div class="empty-state">
      <h3>{t('index.noSessionsYet')}</h3>
      <p>{t('index.noSessionsYetHint')}</p>
    </div>
  {:else if visibleSessions.length === 0}
    <div class="empty-state">
      <h3>{t('index.noSessions')}</h3>
      <p>{t('index.noSessionsHint')}</p>
    </div>
  {:else}
    {#each groups as group (group.project + ':' + group.sessions[0]?.id)}
      {@const runningCount = runningCountFor(group)}
      {@const isCollapsed = !!collapsed[group.project]}
      <div class="project-group" class:timeline-group={isTimeline} class:collapsed={isCollapsed} data-project={group.project}>
        <button class="project-toggle" type="button" aria-expanded={String(!isCollapsed)} onclick={() => toggleProject(group.project)}>
          <span class="project-chevron" aria-hidden="true">{@html icon(ChevronDown, { size: 12 })}</span>
          <span class="project-name">{group.project}</span>
          <span class="project-count" data-project-count data-running={runningCount} data-total={group.sessions.length}>
            {runningCount > 0 ? t('index.activeCount', { count: runningCount }) : sessionsCountLabel(group.sessions.length)}
          </span>
        </button>
        <div class="session-grid" class:session-grid--timeline={isTimeline}>
          {#each group.sessions as session (session.id)}
            <SessionCard {session} running={runningSessionIds.has(session.id)} runningStatus={runningStatuses.get(session.id)} {now} />
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>
