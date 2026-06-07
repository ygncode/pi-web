<script>
  import { icon, MoreHorizontal } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';

  let {
    layout = 'timeline',
    totalSessionsLabel = t('index.sessionsCount', { count: 0 }),
    runningCount = 0,
    runningVisible = false,
    onSearch = () => {},
    onToggleMenu = () => {},
    onLayoutChange = () => {},
  } = $props();
</script>

<div class="header">
  <div class="header-inner">
    <div class="header-top">
      <h1><span class="pi-logo-mark" aria-hidden="true"></span><span>{t('index.title')}</span></h1>
      <div class="header-actions">
        <button class="nav-search-btn" id="open-search" type="button" aria-haspopup="dialog" aria-controls="sessionPalette" onclick={onSearch}><span>{t('index.searchSessions')}</span><kbd>⌘K</kbd></button>
        <button class="nav-menu-btn" id="web-menu-btn" type="button" aria-haspopup="menu" aria-expanded={String(false)} aria-controls="web-menu" onclick={(e) => { e.stopPropagation(); onToggleMenu(); }}>{@html icon(MoreHorizontal, { size: 16 })}</button>
      </div>
    </div>
    <div class="workspace-summary">
      <div class="workspace-stats">
        <span data-total-count>{totalSessionsLabel}</span>
        <span class="stat-running" class:visible={runningVisible} id="statRunning" data-running-stat><span class="status-dot" aria-hidden="true"></span><span data-running-count>{runningCount}</span><span class="stat-running-label"> {t('index.active')}</span></span>
      </div>
      <div class="layout-toggle" aria-label={t('index.sessionLayout')}>
        <button type="button" data-layout-btn="timeline" aria-pressed={String(layout === 'timeline')} onclick={() => onLayoutChange('timeline')}>{t('index.layoutTimeline')}</button>
        <button type="button" data-layout-btn="projects" aria-pressed={String(layout === 'projects')} onclick={() => onLayoutChange('projects')}>{t('index.layoutProjects')}</button>
      </div>
    </div>
  </div>
</div>
