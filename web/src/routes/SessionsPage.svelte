<script>
  import { onMount } from 'svelte';
  import { runIndexPage } from '../index/index.js';

  onMount(() => {
    const previousTitle = document.title;
    document.title = 'Pi Sessions';
    runIndexPage({ documentImpl: document, windowImpl: window, refreshOnStart: true });
    return () => {
      document.title = previousTitle;
    };
  });
</script>

<div class="header">
  <div class="header-inner">
    <div class="header-top">
      <h1><span class="pi-logo-mark" aria-hidden="true"></span><span>Sessions</span></h1>
      <div class="header-actions">
        <button class="nav-search-btn" id="open-search" type="button" aria-haspopup="dialog" aria-controls="sessionPalette"><span>Search sessions...</span><kbd>⌘K</kbd></button>
        <button class="nav-menu-btn" id="web-menu-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="web-menu">⋯</button>
      </div>
    </div>
    <div class="workspace-summary">
      <div class="workspace-stats">
        <span>Sessions</span>
        <span class="stat-running" id="statRunning" data-running-stat><span class="status-dot" aria-hidden="true"></span><span data-running-count>0</span><span class="stat-running-label"> active</span></span>
      </div>
      <div class="layout-toggle" aria-label="Session layout">
        <button type="button" data-layout-btn="timeline" aria-pressed="true">Timeline</button>
        <button type="button" data-layout-btn="projects">Projects</button>
      </div>
    </div>
  </div>
</div>

<div id="web-menu-backdrop" class="mobile-command-backdrop" style="display: none;"></div>
<div id="web-menu" class="web-menu" role="menu" aria-labelledby="web-menu-btn" hidden>
  <div class="web-menu-section">
    <button class="web-menu-item" type="button" data-new-session-btn role="menuitem">New Session</button>
    <button class="web-menu-item" type="button" id="manage-projects-btn" data-manage-projects-btn role="menuitem">Manage Projects</button>
  </div>
  <div class="web-menu-section">
    <a class="web-menu-item" href="/settings" role="menuitem"><span>Settings</span><kbd>⌘,</kbd></a>
    <button class="web-menu-item" type="button" id="index-version-row" data-version-row role="menuitem"><span>Version</span><span class="version-status" data-version-status>…</span></button>
  </div>
</div>

<button class="new-session-btn new-session-btn-mobile" id="newSessionBtn" type="button" data-new-session-btn aria-label="Start a new session" title="Start new session">+</button>

<div class="command-palette-overlay" id="sessionPalette" aria-hidden="true">
  <div class="command-palette" role="dialog" aria-modal="true" aria-label="List sessions">
    <div class="palette-search-wrap">
      <input type="text" id="session-palette-search" placeholder="Search sessions..." autocomplete="off">
      <button class="palette-search-close" type="button" data-palette-close aria-label="Close search">×</button>
    </div>
    <div class="palette-results" data-palette-results></div>
    <div class="palette-section-title">Actions</div>
    <button class="palette-action" type="button" data-new-session-btn>New session</button>
    <button class="palette-action muted" type="button" data-import-session-btn disabled>Import session</button>
  </div>
</div>

<div class="content" data-sessions-content>
  <div class="empty-state">
    <h3>Loading sessions…</h3>
    <p>Fetching the latest session list.</p>
  </div>
</div>

<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <div class="modal-sheet-header">
      <button class="modal-sheet-back" id="modalBackBtn" type="button" aria-label="Close Start a new session">
        <span aria-hidden="true">←</span>
        <span>Start a new session</span>
      </button>
    </div>
    <h2>Start a new session</h2>
    <div class="recent-locations" id="recentLocations"></div>
    <input type="text" id="sessionPath" placeholder="/path/to/project or ~/project">
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
      <button class="btn-primary" id="createBtn">Create</button>
    </div>
    <div class="modal-error" id="modalError"></div>
  </div>
</div>

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
