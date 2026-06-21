<script>
  import { icon, Play, Pause, X, CornerDownRight, Layers } from '../../../shared/icons.js';
  import { t } from '../../../shared/i18n.js';

  let { store } = $props();

  // Hide the whole panel when there are no items, so the composer collapses
  // back to its normal height.
  const visible = $derived(!store.isEmpty);
  const queuedCount = $derived(store.queuedCount);
  const steerCount = $derived(store.steerCount);

  const statusLabel = $derived(
    store.paused ? t('composer.queuePaused') : t('composer.queueActive'),
  );
  const countLabel = $derived(formatCount(queuedCount, steerCount));
  const activeDescendantId = $derived(
    store.focusIndex >= 0 && store.focusIndex < store.items.length
      ? `pi-queue-item-${store.items[store.focusIndex].id}`
      : '',
  );

  function formatCount(queued, steers) {
    if (queued === 0 && steers === 0) return '';
    if (queued === 0) return `${steers} ${t('composer.queueSteeringCount')}`;
    if (steers === 0) return `${queued} ${t('composer.queueQueuedCount')}`;
    return `${queued} ${t('composer.queueQueuedCount')} · ${steers} ${t('composer.queueSteeringCount')}`;
  }

  function chipText(item) {
    const raw = (item.displayText || item.text || '').trim();
    return raw || t('composer.attachmentText');
  }

  function onResume() {
    store.actions.resume?.();
  }

  function onPause() {
    store.setPaused(true);
  }

  function onItemClick(index) {
    store.setFocusIndex(index);
  }

  function onDelete(item) {
    store.removeById(item.id);
  }

  // Standard ARIA listbox pattern: keyboard events live on the listbox
  // container; the user moves through options via aria-activedescendant.
  function onListKeydown(event) {
    if (!visible) return;
    const key = event.key;
    if (key === 'ArrowDown') {
      event.preventDefault();
      store.focusDown();
      return;
    }
    if (key === 'ArrowUp') {
      event.preventDefault();
      store.focusUp();
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      listEl?.blur();
      return;
    }
    const focused = store.focusedItem();
    if (!focused) return;
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      store.removeById(focused.id);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      if (focused.kind === 'queued') store.actions.sendNow?.(focused.id);
      return;
    }
    if (key === 'e' || key === 'E') {
      event.preventDefault();
      if (focused.kind === 'queued') store.actions.edit?.(focused.id);
    }
  }

  let listEl = $state(null);
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG -->
{#if visible}
  <section
    class="pi-queue-panel"
    class:pi-queue-panel--paused={store.paused}
    aria-label={t('composer.queueAria')}
  >
    <header class="pi-queue-header">
      <div class="pi-queue-status">
        <span class="pi-queue-status-label">{statusLabel}</span>
        {#if countLabel}<span class="pi-queue-status-count"> · {countLabel}</span>{/if}
      </div>
      <div class="pi-queue-header-actions">
        {#if store.paused}
          <button
            type="button"
            class="pi-queue-toggle pi-queue-toggle--resume"
            onclick={onResume}
            title={t('composer.queueResumeHint')}
          >
            {@html icon(Play, { size: 13 })}<span>{t('composer.resume')}</span>
          </button>
        {:else}
          <button
            type="button"
            class="pi-queue-toggle"
            onclick={onPause}
            title={t('composer.queuePauseHint')}
          >
            {@html icon(Pause, { size: 13 })}<span>{t('composer.pause')}</span>
          </button>
        {/if}
      </div>
    </header>

    <ul
      bind:this={listEl}
      class="pi-queue-list"
      role="listbox"
      tabindex="0"
      aria-label={t('composer.queueAria')}
      aria-activedescendant={activeDescendantId || undefined}
      onkeydown={onListKeydown}
    >
      {#each store.items as item, i (item.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- Listbox parent handles keyboard navigation; the <li> is a click-to-select target only. -->
        <li
          id={`pi-queue-item-${item.id}`}
          class="pi-queue-item"
          class:pi-queue-item--focused={store.focusIndex === i}
          class:pi-queue-item--steer={item.kind === 'steer'}
          role="option"
          aria-selected={store.focusIndex === i}
          onclick={() => onItemClick(i)}
          onmousedown={(event) => event.preventDefault()}
        >
          <span class="pi-queue-item-icon" aria-hidden="true">
            {@html icon(item.kind === 'steer' ? CornerDownRight : Layers, { size: 12 })}
          </span>
          <span class="pi-queue-item-text">{chipText(item)}</span>
          {#if item.kind === 'steer'}
            <span class="pi-queue-item-tag">{t('composer.steerTag')}</span>
          {/if}
          <button
            type="button"
            class="pi-queue-item-remove"
            aria-label={t('composer.removeQueued')}
            onclick={(event) => {
              event.stopPropagation();
              onDelete(item);
            }}
          >
            {@html icon(X, { size: 12 })}
          </button>
        </li>
      {/each}
    </ul>

    <footer class="pi-queue-shortcuts" aria-hidden="true">
      <span class="pi-queue-shortcut"><kbd>↑↓</kbd>{t('composer.queueNavigate')}</span>
      <span class="pi-queue-shortcut"><kbd>E</kbd>{t('composer.queueEdit')}</span>
      <span class="pi-queue-shortcut"><kbd>⌫</kbd>{t('composer.queueDelete')}</span>
      <span class="pi-queue-shortcut"><kbd>↩</kbd>{t('composer.queueSendNow')}</span>
      <span class="pi-queue-shortcut pi-queue-shortcut--right"
        ><kbd>Esc</kbd>{t('composer.queueExit')}</span
      >
    </footer>
  </section>
{/if}
