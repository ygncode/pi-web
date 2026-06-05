<script>
  let { scratchpad = '' } = $props();
</script>

<div id="right-sidebar-resizer" class="right-sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Resize scratchpad sidebar"></div>
<aside id="right-sidebar" class="right-sidebar">
  <div class="right-sidebar-header">
    <div class="right-sidebar-tabs" role="tablist">
      <button type="button" id="right-tab-scratchpad" class="right-sidebar-tab active" role="tab" data-pane="scratchpad" aria-selected="true">Scratchpad</button>
      <button type="button" id="right-tab-notes" class="right-sidebar-tab" role="tab" data-pane="notes" aria-selected="false">Annotations<span id="annotation-tab-count" class="right-sidebar-tab-count" hidden>0</span></button>
      <button type="button" id="right-tab-artifacts" class="right-sidebar-tab" role="tab" data-pane="artifacts" aria-selected="false">Artifacts<span id="artifact-tab-count" class="right-sidebar-tab-count" hidden>0</span></button>
    </div>
    <div class="right-sidebar-actions">
      <button id="artifact-help-btn" class="right-sidebar-btn artifact-help-btn" title="How artifacts work" aria-label="How artifacts work">?</button>
      <button id="expand-right-sidebar" class="right-sidebar-btn" title="Expand panel">⛶</button>
      <button id="close-right-sidebar" class="right-sidebar-btn" title="Hide panel (⌘⇧N)">×</button>
    </div>
  </div>
  <div class="right-sidebar-content">
    <div id="right-pane-scratchpad" class="right-sidebar-pane active" role="tabpanel" aria-labelledby="right-tab-scratchpad">
      <textarea id="scratchpad-textarea" class="scratchpad-textarea" placeholder="Write project-level notes, scratchpad, tasks...">{scratchpad}</textarea>
    </div>
    <div id="right-pane-artifacts" class="right-sidebar-pane" role="tabpanel" aria-labelledby="right-tab-artifacts" hidden>
      <div id="artifact-panel-host" class="artifact-panel-host"></div>
    </div>
    <div id="right-pane-notes" class="right-sidebar-pane" role="tabpanel" aria-labelledby="right-tab-notes" hidden>
      <div id="annotation-list-host" class="annotation-list-host"></div>
    </div>
  </div>
  <div class="right-sidebar-footer"><span id="scratchpad-status" class="scratchpad-status">Saved</span></div>
</aside>
<div id="right-sidebar-backdrop" class="right-sidebar-backdrop"></div>
<div id="artifact-help-modal" class="artifact-help-modal" hidden>
  <div class="artifact-help-backdrop" data-action="close-artifact-help"></div>
  <div class="artifact-help-card" role="dialog" aria-modal="true" aria-labelledby="artifact-help-title">
    <div class="artifact-help-header"><h3 id="artifact-help-title">How artifacts work</h3><button class="artifact-help-close" data-action="close-artifact-help" aria-label="Close">&times;</button></div>
    <div class="artifact-help-body"><p><strong>Artifacts</strong> are files and sizeable code blocks from the conversation.</p></div>
  </div>
</div>
