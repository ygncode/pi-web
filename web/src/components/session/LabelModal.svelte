<script>
  // Label modal — Svelte port of ui/label-modal.js. Small dialog to set/clear a
  // tree label for an entry. Opened via the bindable `open` prop; `onSave({
  // entryId, label })` persists (the caller handles the API + tree refresh).
  import { tick } from 'svelte';
  import { t } from '../../shared/i18n.js';

  let { open = $bindable(false), entryId = '', currentLabel = '', onSave = null } = $props();

  let value = $state('');
  let inputEl = $state(null);
  let backdropEl = $state(null);

  function close() { open = false; }
  function submit(label) { onSave?.({ entryId, label }); close(); }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Enter') { e.preventDefault(); submit(value.trim()); }
  }

  // Initialize the field + focus each time it opens; close on backdrop click
  // (attached imperatively to match the codebase convention + avoid a11y lint).
  $effect(() => {
    if (!open) return;
    value = currentLabel || '';
    tick().then(() => { inputEl?.focus(); inputEl?.select(); });
    const onBackdropClick = (e) => { if (e.target === backdropEl) close(); };
    backdropEl?.addEventListener('click', onBackdropClick);
    return () => backdropEl?.removeEventListener('click', onBackdropClick);
  });
</script>

{#if open}
  <div id="label-modal-backdrop" class="label-modal-backdrop" bind:this={backdropEl}>
    <div class="label-modal" role="dialog" aria-modal="true" aria-labelledby="label-modal-title">
      <h3 id="label-modal-title">{t('session.labelEntry')}</h3>
      <label class="label-modal-field">
        <span>{t('session.labelInput')}</span>
        <input id="label-modal-input" type="text" autocomplete="off" spellcheck="false" bind:value bind:this={inputEl} onkeydown={onKey}>
      </label>
      <div class="label-modal-actions">
        <button type="button" class="label-modal-remove" hidden={!currentLabel} onclick={() => submit('')}>{t('session.removeLabel')}</button>
        <span class="label-modal-spacer"></span>
        <button type="button" class="label-modal-cancel" onclick={close}>{t('common.cancel')}</button>
        <button type="button" class="label-modal-save" onclick={() => submit(value.trim())}>{t('common.save')}</button>
      </div>
    </div>
  </div>
{/if}
