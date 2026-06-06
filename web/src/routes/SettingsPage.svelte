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
  import { runSettingsPage } from '../settings/settings.js';
  import { t } from '../shared/i18n.js';

  onMount(() => {
    const previousTitle = document.title;
    document.title = `${t('settings.title')} — Pi Sessions`;
    runSettingsPage({ documentImpl: document, windowImpl: window });
    return () => {
      document.title = previousTitle;
    };
  });
</script>

<div class="settings-page">
  <div class="settings-header">
    <a class="settings-back" href="/" data-settings-back><span aria-hidden="true">←</span><span data-settings-back-label>{t('session.back')}</span></a>
    <h1>{t('settings.title')}</h1>
  </div>

  <AppearanceSettings />
  <LanguageSettings />
  <SessionsListSettings />
  <SessionTitleSettings />
  <ArtifactSettings />
  <NotificationSettings />
  <CatGatekeeperSettings />
  <AboutSettings />

  <div class="settings-saved-hint" data-settings-saved>Saved</div>
</div>
