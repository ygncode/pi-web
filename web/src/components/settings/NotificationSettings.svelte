<script>
  import { t } from '../../shared/i18n.js';
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.notifications')}</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.notifyReady')}</span>
      <span class="hint">{t('settings.notifyReadyHint')}</span>
    </div>
    <div class="settings-control">
      <label class="settings-toggle">
        <input type="checkbox" data-setting="pi-share:v1:notify-on-done" data-setting-bool data-setting-notify>
        <span class="slider"></span>
      </label>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.doneSound')}</span>
      <span class="hint">{t('settings.doneSoundHint')}</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-share:v1:done-sound" data-setting-sound></select>
    </div>
  </div>
</section>
