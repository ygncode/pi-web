<script>
  import { t } from '../../shared/i18n.js';
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.sessionTitles')}</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.autoTitle')}</span>
      <span class="hint">{t('settings.autoTitleHint')}</span>
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
      <span class="name">{t('settings.whenToTitle')}</span>
      <span class="hint">{t('settings.whenToTitleHint')}</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-web:v1:auto-title:mode">
        <option value="once">{t('settings.titleOnce')}</option>
        <option value="each-turn">{t('settings.titleEachTurn')}</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.titleModel')}</span>
      <span class="hint">{t('settings.titleModelHint')}</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-web:v1:auto-title:model" data-auto-title-model>
        <option value="">{t('settings.titleBuiltin')}</option>
      </select>
    </div>
  </div>
</section>
