<script>
  import { t } from '../../shared/i18n.js';
  import { sessionsCountLabel } from '../../index/sessions.js';

  let {
    open = false,
    projects = [],
    filterEnabled = false,
    error = '',
    busy = false,
    onClose = () => {},
    onToggleProject = async () => {},
    onToggleAll = async () => {},
    onToggleFilter = async () => {},
    onRegister = async () => {},
    onRemove = async () => {},
  } = $props();

  let query = $state('');
  let addPath = $state('');

  const visibleProjects = $derived(projects.filter((project) => !query.trim() || String(project.path || '').toLowerCase().includes(query.trim().toLowerCase())));
  const allEnabled = $derived(projects.length > 0 && projects.every((p) => p.enabled));

  async function registerProject() {
    const path = addPath.trim();
    if (!path) return;
    await onRegister(path);
    addPath = '';
  }
</script>

<div class="modal-overlay" id="projectsModalOverlay" class:visible={open} class:open={open} role="presentation" onclick={(e) => { if (e.currentTarget === e.target) onClose(); }}>
  <div class="modal">
    <div class="modal-sheet-header">
      <button class="modal-sheet-back" id="projectsModalBackBtn" type="button" aria-label={t('index.closeManageProjects')} onclick={onClose}>
        <span aria-hidden="true">←</span>
        <span>{t('index.manageProjectsTitle')}</span>
      </button>
    </div>
    <h2>{t('index.manageProjectsTitle')}</h2>
    <label class="projects-filter-switch">
      <span class="projects-filter-text">
        <span class="projects-filter-title">{t('index.filterProjects')}</span>
        <span class="projects-filter-desc" id="projectsFilterDesc">{filterEnabled ? t('index.filterOnDesc') : t('index.filterOffDesc')}</span>
      </span>
      <span class="switch"><input type="checkbox" id="projectsFilterToggle" checked={filterEnabled} disabled={busy} onchange={(e) => onToggleFilter(e.currentTarget.checked)}><span class="switch-slider"></span></span>
    </label>
    <div class="projects-config" id="projectsConfig" class:filter-off={!filterEnabled}>
      <div class="projects-toolbar">
        <input type="search" id="projectsSearch" class="projects-search" placeholder={t('index.searchProjects')} autocomplete="off" bind:value={query}>
        <button class="projects-bulk-btn" id="projectsToggleAllBtn" type="button" disabled={busy || projects.length === 0} data-target={allEnabled ? 'disable' : 'enable'} onclick={() => onToggleAll(!allEnabled)}>{allEnabled ? t('index.deselectAll') : t('index.selectAll')}</button>
      </div>
      <div class="projects-list" id="projectsList" data-projects-list>
        {#if projects.length === 0}
          <div class="projects-empty">{t('index.noProjectsFound')}</div>
        {:else if visibleProjects.length === 0}
          <div class="projects-empty" data-projects-no-results>{t('index.noProjectsMatch')}</div>
        {:else}
          {#each visibleProjects as project (project.path)}
            <div class="project-row" data-path={project.path}>
              <input type="checkbox" checked={!!project.enabled} disabled={busy} onchange={(e) => onToggleProject(project.path, e.currentTarget.checked)}>
              <button type="button" class="project-row-name" disabled={busy} onclick={() => onToggleProject(project.path, !project.enabled)}><bdi>{project.path}</bdi></button>
              <span class="project-row-count">{sessionsCountLabel(project.sessionCount || 0)}</span>
              {#if project.source === 'registered'}
                <button type="button" class="project-row-remove" disabled={busy} onclick={() => onRemove(project.path)}>{t('index.removeProject')}</button>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
    <div class="projects-footer">
      <label class="projects-footer-label" for="projectsAddPath">{t('index.registerFolder')}</label>
      <input type="text" id="projectsAddPath" placeholder={t('index.sessionPathPlaceholder')} bind:value={addPath} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); registerProject(); } }}>
      <div class="modal-error" id="projectsModalError">{error}</div>
      <div class="modal-actions">
        <button class="btn-secondary" id="projectsDoneBtn" type="button" onclick={onClose}>{t('common.done')}</button>
        <button class="btn-primary" id="projectsAddBtn" type="button" disabled={busy || !addPath.trim()} onclick={registerProject}>{t('common.add')}</button>
      </div>
    </div>
  </div>
</div>
