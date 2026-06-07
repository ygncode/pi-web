<script>
  import { onMount } from 'svelte';
  import { availableLocales, CUSTOM_LANGUAGES_KEY, englishTemplate, t } from '../../shared/i18n.js';
  import { persistSetting, valueFor } from '../../settings/settings-support.js';

  let { settings = {}, onSave = () => {} } = $props();
  const localeKey = 'pi-web:v1:locale';
  const locales = availableLocales();
  let locale = $derived(valueFor(settings, localeKey, 'en'));
  let customJson = $state('');
  let status = $state('');
  let statusError = $state(false);

  onMount(() => {
    let stored = '';
    try { stored = localStorage.getItem(CUSTOM_LANGUAGES_KEY) || ''; } catch {}
    if (stored) {
      try { customJson = JSON.stringify(JSON.parse(stored), null, 2); }
      catch { customJson = stored; }
    }
  });

  function showStatus(message, isError = false) {
    status = message;
    statusError = isError;
  }

  async function copyEnglishKeys() {
    const template = JSON.stringify([{ code: 'xx', label: 'My Language', strings: englishTemplate() }], null, 2);
    try {
      await navigator.clipboard?.writeText(template);
      showStatus(t('settings.copiedTemplate'));
    } catch {
      customJson = template;
      showStatus(t('settings.clipboardUnavailable'));
    }
  }

  function saveCustomLanguages() {
    const raw = customJson.trim();
    if (raw === '') {
      persistSetting(CUSTOM_LANGUAGES_KEY, '', { storage: localStorage });
      window.location.reload();
      return;
    }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (err) { showStatus(t('settings.invalidJson', { error: err?.message || 'parse error' }), true); return; }
    if (!Array.isArray(parsed) || parsed.some((l) => !l || typeof l.code !== 'string' || !l.code.trim())) {
      showStatus(t('settings.expectedArray'), true);
      return;
    }
    persistSetting(CUSTOM_LANGUAGES_KEY, JSON.stringify(parsed), { storage: localStorage });
    window.location.reload();
  }

  function changeLocale(value) {
    onSave(localeKey, value);
    window.location.reload();
  }
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.language')}</div>
  <div class="settings-row">
    <div class="settings-row-label"><span class="name">{t('settings.language')}</span><span class="hint">{t('settings.languageHint')}</span></div>
    <div class="settings-control"><select data-setting={localeKey} data-setting-locale="" value={locale} onchange={(e) => changeLocale(e.currentTarget.value)}>{#each locales as loc (loc.code)}<option value={loc.code}>{loc.label}</option>{/each}</select></div>
  </div>
  <div class="settings-row settings-row-stacked">
    <div class="settings-row-label"><span class="name">{t('settings.customLanguages')}</span><span class="hint">{t('settings.customLanguagesHint')}</span></div>
    <div class="settings-control settings-control-stacked">
      <textarea data-custom-languages class="settings-custom-languages" rows="8" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="[]" bind:value={customJson}></textarea>
      <div class="settings-custom-languages-actions"><button type="button" class="btn-secondary" data-copy-en-keys onclick={copyEnglishKeys}>{t('settings.copyEnglishKeys')}</button><button type="button" class="btn-primary" data-save-custom-languages onclick={saveCustomLanguages}>{t('settings.saveApply')}</button></div>
      <div class="settings-custom-languages-status" class:is-error={statusError} data-custom-languages-status hidden={!status}>{status}</div>
    </div>
  </div>
</section>
