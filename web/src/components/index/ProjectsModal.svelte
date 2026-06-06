<script>
  import { t } from '../../shared/i18n.js';
</script>

<div class="modal-overlay" id="projectsModalOverlay">
  <div class="modal">
    <div class="modal-sheet-header">
      <button class="modal-sheet-back" id="projectsModalBackBtn" type="button" aria-label={t('index.closeManageProjects')}>
        <span aria-hidden="true">←</span>
        <span>{t('index.manageProjectsTitle')}</span>
      </button>
    </div>
    <h2>{t('index.manageProjectsTitle')}</h2>
    <label class="projects-filter-switch">
      <span class="projects-filter-text">
        <span class="projects-filter-title">{t('index.filterProjects')}</span>
        <span class="projects-filter-desc" id="projectsFilterDesc">{t('index.filterProjectsAllShown')}</span>
      </span>
      <span class="switch"><input type="checkbox" id="projectsFilterToggle"><span class="switch-slider"></span></span>
    </label>
    <div class="projects-config" id="projectsConfig">
      <div class="projects-toolbar">
        <input type="search" id="projectsSearch" class="projects-search" placeholder={t('index.searchProjects')} autocomplete="off">
        <button class="projects-bulk-btn" id="projectsToggleAllBtn" type="button">{t('index.deselectAll')}</button>
      </div>
      <div class="projects-list" id="projectsList" data-projects-list></div>
    </div>
    <div class="projects-footer">
      <label class="projects-footer-label" for="projectsAddPath">{t('index.registerFolder')}</label>
      <input type="text" id="projectsAddPath" placeholder={t('index.sessionPathPlaceholder')}>
      <div class="modal-error" id="projectsModalError"></div>
      <div class="modal-actions">
        <button class="btn-secondary" id="projectsDoneBtn" type="button">{t('common.done')}</button>
        <button class="btn-primary" id="projectsAddBtn" type="button">{t('common.add')}</button>
      </div>
    </div>
  </div>
</div>
