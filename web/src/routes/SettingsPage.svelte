<script>
  import { onMount } from 'svelte';
  import AboutSettings from '../components/settings/AboutSettings.svelte';
  import AppearanceSettings from '../components/settings/AppearanceSettings.svelte';
  import ArtifactSettings from '../components/settings/ArtifactSettings.svelte';
  import CatGatekeeperSettings from '../components/settings/CatGatekeeperSettings.svelte';
  import LanguageSettings from '../components/settings/LanguageSettings.svelte';
  import NotificationSettings from '../components/settings/NotificationSettings.svelte';
  import SessionsListSettings from '../components/settings/SessionsListSettings.svelte';
  import SessionTitleSettings from '../components/settings/SessionTitleSettings.svelte';
  import { t } from '../shared/i18n.js';
  import { loadSettings, persistSetting, setupBackLink } from '../settings/settings-support.js';

  let settings = $state({});
  let savedVisible = $state(false);
  let savedTimer = null;

  function flashSaved() {
    savedVisible = true;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { savedVisible = false; }, 1200);
  }

  function saveSetting(key, value) {
    settings = { ...settings, [key]: value };
    persistSetting(key, value, { storage: localStorage });
    flashSaved();
  }

  onMount(() => {
    const previousTitle = document.title;
    document.title = `${t('settings.title')} — Pi Sessions`;
    setupBackLink(document, window);
    loadSettings({ windowImpl: window }).then((loaded) => { settings = loaded || {}; }).catch(() => {});
    return () => {
      document.title = previousTitle;
      clearTimeout(savedTimer);
    };
  });
</script>

<div class="settings-page">
  <div class="settings-header">
    <a class="settings-back" href="/" data-settings-back><span aria-hidden="true">←</span><span data-settings-back-label>{t('session.back')}</span></a>
    <h1>{t('settings.title')}</h1>
  </div>

  <AppearanceSettings {settings} onSave={saveSetting} onSaved={flashSaved} />
  <LanguageSettings {settings} onSave={saveSetting} />
  <SessionsListSettings {settings} onSave={saveSetting} />
  <SessionTitleSettings {settings} onSave={saveSetting} />
  <ArtifactSettings {settings} onSave={saveSetting} />
  <NotificationSettings {settings} onSave={saveSetting} onSaved={flashSaved} />
  <CatGatekeeperSettings {settings} onSave={saveSetting} />
  <AboutSettings />

  <div class="settings-saved-hint" class:visible={savedVisible} data-settings-saved>{t('common.saved')}</div>
</div>
