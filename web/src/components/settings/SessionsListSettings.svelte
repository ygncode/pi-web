<script>
  import { t } from '../../shared/i18n.js';
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.sessionsList')}</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.spinnerStyle')}</span>
      <span class="hint">{t('settings.spinnerStyleHint')}</span>
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
      <span class="name">{t('settings.defaultLayout')}</span>
      <span class="hint">{t('settings.defaultLayoutHint')}</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-sessions:view-layout">
        <option value="timeline">{t('index.layoutTimeline')}</option>
        <option value="projects">{t('index.layoutProjects')}</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.showBtw')}</span>
      <span class="hint">{t('settings.showBtwHint')}</span>
    </div>
    <div class="settings-control">
      <label class="settings-toggle">
        <input type="checkbox" data-setting="pi-web:v1:show-btw-in-index" data-setting-bool>
        <span class="slider"></span>
      </label>
    </div>
  </div>
</section>
