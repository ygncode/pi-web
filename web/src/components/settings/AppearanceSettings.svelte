<section class="settings-section">
  <div class="settings-section-title">Appearance</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Theme</span>
      <span class="hint">Applies to every browser pointed at this instance.</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-web-theme" data-setting-theme>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="nord">Nord</option>
        <option value="dracula">Dracula</option>
        <option value="custom">Custom</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Interface font</span>
      <span class="hint">Font for the app UI — menus, lists, headers.</span>
    </div>
    <div class="settings-control settings-font-control">
      <select data-font-select="ui">
        <optgroup label="Built-in">
          <option value="mono">Monospace</option>
          <option value="system">System</option>
          <option value="sans">Sans-serif</option>
          <option value="serif">Serif</option>
        </optgroup>
        <optgroup label="Actions">
          <option value="__detect__">Detect installed fonts…</option>
          <option value="__custom__">Custom…</option>
        </optgroup>
      </select>
      <input type="text" class="settings-font-custom" data-font-custom="ui" placeholder="Font family name" hidden>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Interface font size</span>
      <span class="hint">Size of the app UI text (px).</span>
    </div>
    <div class="settings-control">
      <input type="number" min="8" max="32" data-setting="pi-web:v1:font-ui-size" data-setting-size="ui">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Content font</span>
      <span class="hint">Font for rendered message content. Code stays monospace.</span>
    </div>
    <div class="settings-control settings-font-control">
      <select data-font-select="content">
        <optgroup label="Built-in">
          <option value="mono">Monospace</option>
          <option value="system">System</option>
          <option value="sans">Sans-serif</option>
          <option value="serif">Serif</option>
        </optgroup>
        <optgroup label="Actions">
          <option value="__detect__">Detect installed fonts…</option>
          <option value="__custom__">Custom…</option>
        </optgroup>
      </select>
      <input type="text" class="settings-font-custom" data-font-custom="content" placeholder="Font family name" hidden>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Content font size</span>
      <span class="hint">Size of rendered message text (px).</span>
    </div>
    <div class="settings-control">
      <input type="number" min="8" max="32" data-setting="pi-web:v1:font-content-size" data-setting-size="content">
    </div>
  </div>
</section>
