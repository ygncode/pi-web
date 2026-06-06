<script>
  import { icon, CircleHelp, Maximize2, X } from '../../shared/icons.js';
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
      <button id="artifact-help-btn" class="right-sidebar-btn artifact-help-btn" title="How artifacts work" aria-label="How artifacts work">{@html icon(CircleHelp, { size: 15 })}</button>
      <button id="expand-right-sidebar" class="right-sidebar-btn" title="Expand panel">{@html icon(Maximize2, { size: 14 })}</button>
      <button id="close-right-sidebar" class="right-sidebar-btn" title="Hide panel (⌘⇧N)">{@html icon(X, { size: 15 })}</button>
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
    <div class="artifact-help-header"><h3 id="artifact-help-title">How artifacts work</h3><button class="artifact-help-close" data-action="close-artifact-help" aria-label="Close">{@html icon(X, { size: 16 })}</button></div>
    <div class="artifact-help-body">
      <p><strong>Artifacts</strong> are the files the agent wrote and the larger code blocks it shared, pulled out of the conversation so you can find, read, copy, or download them in one place.</p>
      <p><strong>Viewing.</strong> Pick one from the list to see its source. HTML, SVG, and Markdown files also have a <em>Preview</em> toggle — HTML/SVG run in a secure sandbox, Markdown renders as formatted text.</p>
      <p><strong>Annotating.</strong> Select text in an artifact's source to leave a note. Your notes collect in the <em>Annotations</em> tab, where you can jump back to them or send them to the agent.</p>
      <p><strong>Staying up to date.</strong> Files the agent <em>writes</em> or <em>edits</em> update automatically, and simple renames or deletes (<code>mv</code>, <code>git mv</code>, <code>rm</code>) are tracked too. But changes made through other shell commands — like <code>sed</code> or output redirects — can't be followed from the conversation, so once in a while an artifact may show an older version. When in doubt, check the file on disk.</p>
      <p class="artifact-help-note">Artifacts are part of the live view only and aren't included in exported snapshots.</p>
    </div>
  </div>
</div>
