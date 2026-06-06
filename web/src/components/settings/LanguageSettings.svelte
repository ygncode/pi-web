<script>
  import { availableLocales, t } from '../../shared/i18n.js';
  // Built-ins + any custom locales defined in the setting (read at load).
  const locales = availableLocales();
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.language')}</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.language')}</span>
      <span class="hint">{t('settings.languageHint')}</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-web:v1:locale" data-setting-locale>
        {#each locales as loc (loc.code)}
          <option value={loc.code}>{loc.label}</option>
        {/each}
      </select>
    </div>
  </div>
  <div class="settings-row settings-row-stacked">
    <div class="settings-row-label">
      <span class="name">{t('settings.customLanguages')}</span>
      <span class="hint">{t('settings.customLanguagesHint')}</span>
    </div>
    <div class="settings-control settings-control-stacked">
      <textarea data-custom-languages class="settings-custom-languages" rows="8" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="[]"></textarea>
      <div class="settings-custom-languages-actions">
        <button type="button" class="btn-secondary" data-copy-en-keys>{t('settings.copyEnglishKeys')}</button>
        <button type="button" class="btn-primary" data-save-custom-languages>{t('settings.saveApply')}</button>
      </div>
      <div class="settings-custom-languages-status" data-custom-languages-status hidden></div>
    </div>
  </div>
</section>
