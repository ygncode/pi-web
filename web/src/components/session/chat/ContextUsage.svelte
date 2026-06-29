<script>
  import { t } from '../../../shared/i18n.js';
  import { icon, X } from '../../../shared/icons.js';

  let { popover = false } = $props();
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG and rendered session markdown -->

{#if !popover}
  <div
    id="pi-chat-context-usage"
    class="pi-chat-context-usage"
    style="display: none"
    title={t('composer.contextDetails')}
  >
    <svg class="pi-context-circle" viewBox="0 0 36 36">
      <path
        class="pi-context-bg"
        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
      />
      <path
        class="pi-context-fill"
        stroke-dasharray="0, 100"
        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
      />
    </svg>
    <span class="pi-context-text">0%</span>
  </div>
{:else}
  <div id="pi-chat-context-popover" class="pi-chat-context-popover" style="display: none;">
    <div class="pi-popover-arrow"></div>
    <div class="pi-popover-header">
      <span class="pi-popover-title">Context</span>
      <span class="pi-popover-close">{@html icon(X, { size: 13 })}</span>
    </div>
    <div class="pi-popover-body">
      <div class="pi-popover-hero">
        <span class="pi-popover-used">0</span>
        <span class="pi-popover-divider">/</span>
        <span class="pi-popover-limit">128k</span>
      </div>
      <div class="pi-popover-progress-container">
        <div class="pi-popover-progress-bar" style="width: 0%;"></div>
      </div>
      <div class="pi-popover-details">
        <div class="pi-popover-row">
          <span class="pi-row-label">Input</span>
          <span class="pi-row-value" id="pi-popover-val-input">0</span>
        </div>
        <div class="pi-popover-row">
          <span class="pi-row-label">Cache read</span>
          <span class="pi-row-value" id="pi-popover-val-cache-read">0</span>
        </div>
        <div class="pi-popover-row">
          <span class="pi-row-label">Cache write</span>
          <span class="pi-row-value" id="pi-popover-val-cache-write">0</span>
        </div>
        <div class="pi-popover-row">
          <span class="pi-row-label">Output</span>
          <span class="pi-row-value" id="pi-popover-val-output">0</span>
        </div>
        <div class="pi-popover-separator"></div>
        <div class="pi-popover-row pi-popover-total">
          <span class="pi-row-label">Total I/O</span>
          <span class="pi-row-value" id="pi-popover-val-total">0</span>
        </div>
      </div>
      <button
        type="button"
        id="pi-chat-compact"
        class="pi-popover-compact"
        title={t('composer.compact')}
      >
        <span class="pi-compact-label">{t('composer.compactLabel')}</span>
        <span class="pi-compact-kbd"><kbd>⌘</kbd><kbd>L</kbd></span>
      </button>
    </div>
  </div>
{/if}
