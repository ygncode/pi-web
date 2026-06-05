<section class="settings-section">
  <div class="settings-section-title">Session Titles</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Auto-generate titles</span>
      <span class="hint">Let pi-web name sessions automatically from the first message.</span>
    </div>
    <div class="settings-control">
      <label class="settings-toggle">
        <input type="checkbox" data-setting="pi-web:v1:auto-title:enabled" data-setting-bool>
        <span class="slider"></span>
      </label>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">When to title</span>
      <span class="hint">Title a session once, or refresh it as the focus shifts.</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-web:v1:auto-title:mode">
        <option value="once">Once per session</option>
        <option value="each-turn">Every new message</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Title model</span>
      <span class="hint">Built-in is a free, instant word heuristic (no AI). Pick a model for smarter titles — a small, fast one is ideal.</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-web:v1:auto-title:model" data-auto-title-model>
        <option value="">Built-in heuristic (no AI)</option>
      </select>
    </div>
  </div>
</section>
