<script>
  import { onMount } from 'svelte';
  import { t } from '../../shared/i18n.js';
  import { REPO_URL, USER_DOCS_URL } from '../../shared/links.js';
  import { applyVersionStatus } from '../../shared/version.js';

  onMount(applyVersionStatus);
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.about')}</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('common.version')}</span>
      <span class="hint">pi-web</span>
    </div>
    <div class="settings-control">
      <button class="settings-link" type="button" data-version-row
        ><span data-version-status>…</span></button
      >
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.docs')}</span>
      <span class="hint">{t('settings.docsHint')}</span>
    </div>
    <div class="settings-control">
      <a class="settings-link" href={USER_DOCS_URL} target="_blank" rel="noreferrer"
        >{t('settings.openDocs')}</a
      >
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.github')}</span>
      <span class="hint">{t('settings.githubHint')}</span>
    </div>
    <div class="settings-control">
      <a class="settings-link" href={REPO_URL} target="_blank" rel="noreferrer"
        >{t('settings.starGithub')}</a
      >
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.sponsor')}</span>
      <span class="hint">{t('settings.sponsorHint')}</span>
    </div>
    <div class="settings-control">
      <a
        class="settings-link"
        href="https://github.com/sponsors/setkyar"
        target="_blank"
        rel="noreferrer">{t('settings.becomeSponsor')}</a
      >
    </div>
  </div>
</section>
