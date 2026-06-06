<script>
  import { t } from '../../shared/i18n.js';
</script>

<div id="web-menu-backdrop" class="mobile-command-backdrop" style="display: none;"></div>
<div id="web-menu" class="web-menu" role="menu" aria-labelledby="web-menu-btn" hidden>
  <div class="web-menu-section">
    <button class="web-menu-item" type="button" data-new-session-btn role="menuitem">{t('index.newSession')}</button>
    <button class="web-menu-item" type="button" id="manage-projects-btn" data-manage-projects-btn role="menuitem">{t('index.manageProjects')}</button>
  </div>
  <div class="web-menu-section">
    <a class="web-menu-item" href="/settings" role="menuitem"><span>{t('common.settings')}</span><kbd>⌘,</kbd></a>
    <button class="web-menu-item" type="button" id="index-version-row" data-version-row role="menuitem"><span>{t('common.version')}</span><span class="version-status" data-version-status>…</span></button>
  </div>
</div>
