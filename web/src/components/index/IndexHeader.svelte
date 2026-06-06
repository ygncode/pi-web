<script>
  import { icon, MoreHorizontal } from '../../shared/icons.js';
</script>

<div class="header">
  <div class="header-inner">
    <div class="header-top">
      <h1><span class="pi-logo-mark" aria-hidden="true"></span><span>Sessions</span></h1>
      <div class="header-actions">
        <button class="nav-search-btn" id="open-search" type="button" aria-haspopup="dialog" aria-controls="sessionPalette"><span>Search sessions...</span><kbd>⌘K</kbd></button>
        <button class="nav-menu-btn" id="web-menu-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="web-menu">{@html icon(MoreHorizontal, { size: 16 })}</button>
      </div>
    </div>
    <div class="workspace-summary">
      <div class="workspace-stats">
        <span data-total-count>0 sessions</span>
        <span class="stat-running" id="statRunning" data-running-stat><span class="status-dot" aria-hidden="true"></span><span data-running-count>0</span><span class="stat-running-label"> active</span></span>
      </div>
      <div class="layout-toggle" aria-label="Session layout">
        <button type="button" data-layout-btn="timeline" aria-pressed="true">Timeline</button>
        <button type="button" data-layout-btn="projects">Projects</button>
      </div>
    </div>
  </div>
</div>
