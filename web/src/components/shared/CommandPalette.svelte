<script>
  import { icon, X } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
</script>

<div class="command-palette-overlay" id="sessionPalette" aria-hidden="true">
  <div class="command-palette" role="dialog" aria-modal="true" aria-label={t('palette.listSessions')}>
    <div class="palette-search-wrap">
      <input type="text" id="session-palette-search" placeholder={t('index.searchSessions')} autocomplete="off">
      <button class="palette-search-close" type="button" data-palette-close aria-label={t('palette.closeSearch')}>{@html icon(X, { size: 15 })}</button>
    </div>
    <div class="palette-results" data-palette-results></div>
    <div class="palette-section-title">{t('palette.actions')}</div>
    <button class="palette-action" type="button" data-new-session-btn>{t('palette.newSession')}</button>
    <button class="palette-action muted" type="button" data-import-session-btn disabled>{t('index.importSession')}</button>
  </div>
</div>
