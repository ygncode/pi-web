<script>
  import { icon, PanelLeftClose, X } from '../../shared/icons.js';
</script>

<aside id="sidebar">
  <div class="sidebar-header">
    <div class="sidebar-controls"><input type="text" class="sidebar-search" id="tree-search" placeholder="Search..."><button id="hide-sidebar" class="hide-sidebar" title="Hide sidebar">{@html icon(PanelLeftClose, { size: 14 })}</button><button id="sidebar-close" class="sidebar-close" title="Close" aria-label="Close session tree">{@html icon(X, { size: 14 })}</button></div>
    <div class="sidebar-filters"><button class="filter-btn active" data-filter="default" title="Hide settings entries">Default</button><button class="filter-btn" data-filter="no-tools" title="Default minus tool results">No-tools</button><button class="filter-btn" data-filter="user-only" title="Only user messages">User</button><button class="filter-btn" data-filter="labeled-only" title="Only labeled entries">Labeled</button><button class="filter-btn" data-filter="all" title="Show everything">All</button></div>
  </div>
  <div class="tree-container" id="tree-container"></div><div class="tree-status" id="tree-status"></div>
</aside>
<div id="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Resize session tree sidebar"></div>
