<script>
  import { onMount } from 'svelte';
  import AboutSettings from '../components/settings/AboutSettings.svelte';
  import AppearanceSettings from '../components/settings/AppearanceSettings.svelte';
  import ArtifactSettings from '../components/settings/ArtifactSettings.svelte';
  import CatGatekeeperSettings from '../components/settings/CatGatekeeperSettings.svelte';
  import LanguageSettings from '../components/settings/LanguageSettings.svelte';
  import NotificationSettings from '../components/settings/NotificationSettings.svelte';
  import SessionDisplayDefaultsSettings from '../components/settings/SessionDisplayDefaultsSettings.svelte';
  import SessionsListSettings from '../components/settings/SessionsListSettings.svelte';
  import SessionTitleSettings from '../components/settings/SessionTitleSettings.svelte';
  import { t } from '../shared/i18n.js';
  import { navigate } from '../shared/navigation.js';
  import { loadSettings, persistSetting } from '../settings/settings-support.js';

  let settings = $state({});
  let savedVisible = $state(false);
  let savedTimer = null;

  const sections = [
    { id: 'appearance', labelKey: 'settings.appearance' },
    { id: 'language', labelKey: 'settings.language' },
    { id: 'sessionsList', labelKey: 'settings.sessionsList' },
    { id: 'sessionTitles', labelKey: 'settings.sessionTitles' },
    { id: 'sessionDisplay', labelKey: 'settings.sessionDisplay' },
    { id: 'artifacts', labelKey: 'settings.artifacts' },
    { id: 'notifications', labelKey: 'settings.notifications' },
    { id: 'catGatekeeper', labelKey: 'settings.catGatekeeper' },
    { id: 'about', labelKey: 'settings.about' },
  ];
  let activeSection = $state('appearance');
  let isMobile = $state(false);
  let mobileShowingPane = $state(false);
  let cameFromApp = $state(false);

  const activeLabel = $derived(
    t(sections.find((s) => s.id === activeSection)?.labelKey || 'settings.title'),
  );

  function selectSection(id) {
    activeSection = id;
    if (isMobile) mobileShowingPane = true;
  }

  function backToList() {
    mobileShowingPane = false;
  }

  function onHomeBack(e) {
    if (e.defaultPrevented) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (cameFromApp && window.history && window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/');
    }
  }

  function flashSaved() {
    savedVisible = true;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      savedVisible = false;
    }, 1200);
  }

  function saveSetting(key, value) {
    settings = { ...settings, [key]: value };
    persistSetting(key, value, { storage: localStorage });
    flashSaved();
  }

  onMount(() => {
    const previousTitle = document.title;
    document.title = `${t('settings.title')} — Pi Sessions`;

    try {
      const ref = document.referrer;
      cameFromApp =
        !!ref &&
        new URL(ref).origin === window.location.origin &&
        new URL(ref).pathname !== '/settings';
    } catch {
      cameFromApp = false;
    }

    const mq = window.matchMedia?.('(max-width: 760px)');
    const updateMobile = () => {
      isMobile = !!mq?.matches;
      if (!isMobile) mobileShowingPane = false;
    };
    updateMobile();
    mq?.addEventListener('change', updateMobile);

    loadSettings({ windowImpl: window })
      .then((loaded) => {
        settings = loaded || {};
      })
      .catch(() => {});
    return () => {
      document.title = previousTitle;
      clearTimeout(savedTimer);
      mq?.removeEventListener('change', updateMobile);
    };
  });
</script>

<div class="session-header-bar">
  <div class="session-header-left">
    {#if isMobile && mobileShowingPane}
      <button type="button" class="session-header-back" onclick={backToList}>
        <span>←</span>
        {t('settings.title')}
      </button>
    {:else}
      <a class="session-header-back" href="/" onclick={onHomeBack}>
        <span>←</span>
        {cameFromApp ? t('common.back') : t('session.back')}
      </a>
    {/if}
  </div>
  <span class="session-header-title">
    {isMobile && mobileShowingPane ? activeLabel : t('settings.title')}
  </span>
  <div class="session-header-right"></div>
</div>

<div
  class="settings-page"
  class:settings-page-mobile-list={isMobile && !mobileShowingPane}
  class:settings-page-mobile-pane={isMobile && mobileShowingPane}
>
  <nav class="settings-sidebar" aria-label={t('settings.title')}>
    {#each sections as section (section.id)}
      <button
        type="button"
        class="settings-sidebar-item"
        class:active={activeSection === section.id}
        data-settings-nav={section.id}
        aria-current={activeSection === section.id ? 'page' : undefined}
        onclick={() => selectSection(section.id)}
      >
        <span>{t(section.labelKey)}</span>
        <span class="settings-sidebar-chev" aria-hidden="true">›</span>
      </button>
    {/each}
  </nav>

  <div class="settings-pane">
    {#if activeSection === 'appearance'}
      <AppearanceSettings {settings} onSave={saveSetting} onSaved={flashSaved} />
    {:else if activeSection === 'language'}
      <LanguageSettings {settings} onSave={saveSetting} />
    {:else if activeSection === 'sessionsList'}
      <SessionsListSettings {settings} onSave={saveSetting} />
    {:else if activeSection === 'sessionTitles'}
      <SessionTitleSettings {settings} onSave={saveSetting} />
    {:else if activeSection === 'sessionDisplay'}
      <SessionDisplayDefaultsSettings {settings} onSave={saveSetting} />
    {:else if activeSection === 'artifacts'}
      <ArtifactSettings {settings} onSave={saveSetting} />
    {:else if activeSection === 'notifications'}
      <NotificationSettings {settings} onSave={saveSetting} onSaved={flashSaved} />
    {:else if activeSection === 'catGatekeeper'}
      <CatGatekeeperSettings {settings} onSave={saveSetting} />
    {:else if activeSection === 'about'}
      <AboutSettings />
    {/if}
  </div>

  <div class="settings-saved-hint" class:visible={savedVisible} data-settings-saved>
    {t('common.saved')}
  </div>
</div>
