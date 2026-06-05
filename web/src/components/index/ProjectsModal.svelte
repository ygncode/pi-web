<div class="modal-overlay" id="projectsModalOverlay">
  <div class="modal">
    <div class="modal-sheet-header">
      <button class="modal-sheet-back" id="projectsModalBackBtn" type="button" aria-label="Close Manage projects">
        <span aria-hidden="true">←</span>
        <span>Manage projects</span>
      </button>
    </div>
    <h2>Manage projects</h2>
    <label class="projects-filter-switch">
      <span class="projects-filter-text">
        <span class="projects-filter-title">Filter projects</span>
        <span class="projects-filter-desc" id="projectsFilterDesc">All projects are shown.</span>
      </span>
      <span class="switch"><input type="checkbox" id="projectsFilterToggle"><span class="switch-slider"></span></span>
    </label>
    <div class="projects-config" id="projectsConfig">
      <div class="projects-toolbar">
        <input type="search" id="projectsSearch" class="projects-search" placeholder="Search projects…" autocomplete="off">
        <button class="projects-bulk-btn" id="projectsToggleAllBtn" type="button">Deselect all</button>
      </div>
      <div class="projects-list" id="projectsList" data-projects-list></div>
    </div>
    <div class="projects-footer">
      <label class="projects-footer-label" for="projectsAddPath">Register a folder</label>
      <input type="text" id="projectsAddPath" placeholder="/path/to/project or ~/project">
      <div class="modal-error" id="projectsModalError"></div>
      <div class="modal-actions">
        <button class="btn-secondary" id="projectsDoneBtn" type="button">Done</button>
        <button class="btn-primary" id="projectsAddBtn" type="button">Add</button>
      </div>
    </div>
  </div>
</div>
