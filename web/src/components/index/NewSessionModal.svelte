<script>
  import { t } from '../../shared/i18n.js';
</script>

<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <div class="modal-sheet-header">
      <button class="modal-sheet-back" id="modalBackBtn" type="button" aria-label={t('index.closeNewSession')}>
        <span aria-hidden="true">←</span>
        <span>{t('index.startNewSession')}</span>
      </button>
    </div>
    <h2>{t('index.startNewSession')}</h2>
    <div class="recent-locations" id="recentLocations"></div>
    <input type="text" id="sessionPath" placeholder={t('index.sessionPathPlaceholder')}>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn">{t('common.cancel')}</button>
      <button class="btn-primary" id="createBtn">{t('common.create')}</button>
    </div>
    <div class="modal-error" id="modalError"></div>
  </div>
</div>
