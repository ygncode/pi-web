<script>
  import { t } from '../../shared/i18n.js';
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.artifacts')}</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.showArtifacts')}</span>
      <span class="hint">{t('settings.showArtifactsHint')}</span>
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
      <span class="name">{t('settings.includeFilter')}</span>
      <span class="hint">{t('settings.includeFilterHint')}</span>
    </div>
    <div class="settings-control">
      <input type="text" data-setting="pi-web:v1:artifacts:include" placeholder="*.md, *.html" spellcheck="false" autocapitalize="off" autocomplete="off">
    </div>
  </div>
</section>
