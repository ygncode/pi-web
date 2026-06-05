<section class="settings-section">
  <div class="settings-section-title">Sessions List</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Spinner style</span>
      <span class="hint">Animation shown next to running sessions.</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-sessions:spinner-style">
        <option value="runcat">Runcat</option>
        <option value="braille">Braille</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Default layout</span>
      <span class="hint">How the sessions list is grouped on load.</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-sessions:view-layout">
        <option value="timeline">Timeline</option>
        <option value="projects">Projects</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Show btw chats in list</span>
      <span class="hint">Include the throwaway btw scratch-chats in the sessions list. Hidden by default.</span>
    </div>
    <div class="settings-control">
      <label class="settings-toggle">
        <input type="checkbox" data-setting="pi-web:v1:show-btw-in-index" data-setting-bool>
        <span class="slider"></span>
      </label>
    </div>
  </div>
</section>
