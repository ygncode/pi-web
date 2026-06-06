<script>
  import { t } from '../../shared/i18n.js';
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.catGatekeeper')}</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.catEnable')}</span>
      <span class="hint">{t('settings.catEnableHint')}</span>
    </div>
    <div class="settings-control">
      <label class="settings-toggle">
        <input type="checkbox" data-setting="pi-web:v1:cat:enabled" data-setting-bool>
        <span class="slider"></span>
      </label>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.catFocus')}</span>
      <span class="hint">{t('settings.catFocusHint')}</span>
    </div>
    <div class="settings-control">
      <input type="number" min="1" max="240" data-setting="pi-web:v1:cat:focus-min">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.catBreak')}</span>
      <span class="hint">{t('settings.catBreakHint')}</span>
    </div>
    <div class="settings-control">
      <input type="number" min="1" max="120" data-setting="pi-web:v1:cat:break-min">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.catBedtime')}</span>
      <span class="hint">{t('settings.catBedtimeHint')}</span>
    </div>
    <div class="settings-control">
      <input type="time" data-setting="pi-web:v1:cat:bedtime">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.catWakeup')}</span>
      <span class="hint">{t('settings.catWakeupHint')}</span>
    </div>
    <div class="settings-control">
      <input type="time" data-setting="pi-web:v1:cat:wakeup">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.catSleep')}</span>
      <span class="hint">{t('settings.catSleepHint')}</span>
    </div>
    <div class="settings-control">
      <input type="number" min="1" max="60" data-setting="pi-web:v1:cat:sleep-min">
    </div>
  </div>
</section>
