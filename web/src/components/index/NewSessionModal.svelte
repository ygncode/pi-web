<script>
  import { t } from '../../shared/i18n.js';

  let { open = false, recent = [], path = $bindable(''), creating = false, error = '', onClose = () => {}, onCreate = () => {} } = $props();

  function chooseRecent(loc) {
    path = loc;
    requestAnimationFrame(() => document.getElementById('sessionPath')?.focus());
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCreate();
    }
  }
</script>

<div class="modal-overlay" id="modalOverlay" class:visible={open} class:open={open} role="presentation" onclick={(e) => { if (e.currentTarget === e.target) onClose(); }}>
  <div class="modal">
    <div class="modal-sheet-header">
      <button class="modal-sheet-back" id="modalBackBtn" type="button" aria-label={t('index.closeNewSession')} onclick={onClose}>
        <span aria-hidden="true">←</span>
        <span>{t('index.startNewSession')}</span>
      </button>
    </div>
    <h2>{t('index.startNewSession')}</h2>
    <div class="recent-locations" id="recentLocations">
      {#each recent as loc}
        <button type="button" class="recent-chip" onclick={() => chooseRecent(loc)}>{loc}</button>
      {/each}
    </div>
    <input type="text" id="sessionPath" placeholder={t('index.sessionPathPlaceholder')} bind:value={path} onkeydown={handleKeydown}>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancelBtn" type="button" onclick={onClose}>{t('common.cancel')}</button>
      <button class="btn-primary" id="createBtn" type="button" disabled={creating} onclick={onCreate}>{t('common.create')}</button>
    </div>
    <div class="modal-error" id="modalError">{error}</div>
  </div>
</div>
