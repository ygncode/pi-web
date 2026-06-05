<section class="settings-section">
  <div class="settings-section-title">Artifacts</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Show Artifacts panel</span>
      <span class="hint">Surface files the agent wrote and sizeable code blocks in a right-sidebar tab. When off, the tab is hidden.</span>
    </div>
    <div class="settings-control">
      <label class="settings-toggle">
        <input type="checkbox" data-setting="pi-web:v1:artifacts:enabled" data-setting-bool>
        <span class="slider"></span>
      </label>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Include filter</span>
      <span class="hint">Comma-separated globs (e.g. <code>*.md, *.html, artifacts/**</code>). Only matching files are shown. Leave empty to show everything; any filter also hides loose chat code snippets.</span>
    </div>
    <div class="settings-control">
      <input type="text" data-setting="pi-web:v1:artifacts:include" placeholder="*.md, *.html" spellcheck="false" autocapitalize="off" autocomplete="off">
    </div>
  </div>
</section>
