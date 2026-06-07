<script>
  import { onMount } from 'svelte';
  import { icon, Maximize2, Paperclip, ChevronDown, ExternalLink, X } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
  import { escapeHtml } from '../../session/render/session-format.js';
  import { runChatComposer } from '../../session/chat/chat-composer-runner.js';
  import * as chatApi from '../../session/chat/chat-api.js';
  import * as chatSelectors from '../../session/chat/chat-selectors.js';
  import * as modelSelector from '../../session/chat/model-selector.js';
  import * as thinkingSelector from '../../session/chat/thinking-selector.js';
  import * as slashSelector from '../../session/chat/slash-command.js';
  import * as mentionSelector from '../../session/chat/mention-autocomplete.js';
  import * as gitApi from '../../session/chat/git-api.js';
  import { setupGitFooter } from '../../session/chat/git-footer.js';

  let {
    sessionId = '',
    chatAvailable = true,
    chatDisabledReason = '',
    cwd = '',
    modelLabel = '',
  } = $props();

  // The composer absorbs the chat runner + git footer. It reads the shared model
  // and navigateTo (owned by SessionPage, on window) at mount — both are ready
  // before this onMount. Live reload mounts first, so its pi-chat-message-sent
  // listener is attached before the user can send. Live-only.
  onMount(() => {
    const target = window;
    const model = target.__piSessionDataModel;
    globalThis.__PI_TEST_CHAT_COMPOSER_HOOK__?.();
    runChatComposer({
      documentImpl: document,
      windowImpl: target,
      locationImpl: target.location,
      localEntries: model?.entries || [],
      leafId: model?.leafId || '',
      urlTargetId: model?.urlTargetId || '',
      byId: model?.byId || new Map(),
      navigateTo: target.navigateTo,
      escapeHtml: (text) => escapeHtml(text, { documentImpl: document }),
      chatApi,
      chatSelectors,
      modelSelector,
      thinkingSelector,
      slashSelector,
      mentionSelector,
      FormDataImpl: target.FormData,
      URLSearchParamsImpl: target.URLSearchParams,
      CustomEventImpl: target.CustomEvent,
      setIntervalImpl: target.setInterval.bind(target),
    });

    setupGitFooter({ documentImpl: document, windowImpl: target, sessionId, gitApi });
  });
</script>

<form id="pi-chat-composer" class="pi-chat-composer" data-session-id={sessionId} data-chat-available={chatAvailable} data-chat-disabled-reason={chatDisabledReason}>
  <input id="pi-chat-images" name="images" type="file" accept="image/*" multiple hidden disabled={!chatAvailable}>
  <div class="pi-chat-shell">
    <button type="button" id="pi-chat-expand" class="pi-chat-expand-button" title={t('composer.expand')} aria-label={t('composer.expand')} aria-pressed="false" disabled={!chatAvailable}>{@html icon(Maximize2, { size: 14 })}</button>
    {#if cwd}<div class="pi-chat-toolbar pi-chat-cwd-bar"><span class="pi-chat-cwd" title={t('composer.copyPath')} data-cwd={cwd}>cwd: {cwd}</span><span class="pi-chat-focus-shortcut">{t('composer.focusShortcut')}</span></div>{/if}
    {#if !chatAvailable}<div class="pi-chat-disabled-notice">{chatDisabledReason}</div>{/if}
    <textarea id="pi-chat-message" name="message" rows="1" placeholder={t('composer.placeholder')} disabled={!chatAvailable}></textarea>
    <div id="pi-chat-attachments" class="pi-chat-attachments"></div>
    <div id="pi-chat-model-popup" class="pi-chat-model-popup" style="display: none"><input type="text" id="pi-chat-model-search" class="pi-chat-model-search" placeholder={t('composer.searchModels')} autocomplete="off"><div id="pi-chat-model-list" class="pi-chat-model-list"></div></div>
    <div id="pi-chat-thinking-popup" class="pi-chat-thinking-popup" style="display: none"><div id="pi-chat-thinking-list" class="pi-chat-thinking-list"></div></div>
    <div id="pi-chat-slash-popup" class="pi-chat-slash-popup" style="display: none"><div id="pi-chat-slash-list" class="pi-chat-slash-list"></div></div>
    <div id="pi-chat-mention-popup" class="pi-chat-slash-popup" style="display: none"><div id="pi-chat-mention-list" class="pi-chat-slash-list"></div></div>
    <div class="pi-chat-toolbar"><div class="pi-chat-toolbar-left"><button type="button" id="pi-chat-attach" class="pi-chat-icon-button pi-chat-photo-button" title={t('composer.attachPhotos')} aria-label={t('composer.attachPhotos')} disabled={!chatAvailable}>{@html icon(Paperclip, { size: 15 })}</button><span id="pi-chat-status" class="pi-chat-status">{chatAvailable ? t('composer.idle') : t('composer.unavailable')}</span><button type="button" id="pi-chat-thinking-label" class="pi-chat-thinking-label" style="display: none" title={t('composer.switchEffort')} disabled={!chatAvailable}></button><button type="button" id="pi-chat-model-label" class="pi-chat-model-label" title={t('composer.switchModel')} style:display={modelLabel ? '' : 'none'} disabled={!chatAvailable}>{modelLabel}</button><div id="pi-chat-context-usage" class="pi-chat-context-usage" style="display: none" title={t('composer.contextDetails')}><svg class="pi-context-circle" viewBox="0 0 36 36"><path class="pi-context-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/><path class="pi-context-fill" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/></svg><span class="pi-context-text">0%</span></div></div><div class="actions"><button type="button" id="pi-chat-cancel" class="pi-chat-cancel" style="display: none" title={t('composer.cancelRunning')} aria-label={t('composer.cancelRunning')} disabled={!chatAvailable}>{t('composer.cancel')}</button><button type="submit" id="pi-chat-send" class="pi-chat-send" disabled>{t('composer.send')}</button></div></div>
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
      </div>
    </div>
  </div>
  <div id="pi-chat-attachment-modal" class="pi-chat-attachment-modal" hidden>
    <div class="pi-chat-attachment-backdrop" data-action="close-attachment"></div>
    <div class="pi-chat-attachment-card" role="dialog" aria-modal="true" aria-label={t('composer.attachmentText')}>
      <div class="pi-chat-attachment-card-header">
        <span class="pi-chat-attachment-card-title">{t('composer.attachmentText')}</span>
        <button type="button" class="pi-chat-attachment-card-close" data-action="close-attachment" aria-label={t('common.close')}>{@html icon(X, { size: 15 })}</button>
      </div>
      <pre class="pi-chat-attachment-card-quote"></pre>
      <div class="pi-chat-attachment-card-note" hidden></div>
    </div>
  </div>
  <div class="pi-git-bar" id="pi-git-bar" data-git-repo="false" data-git-branch="" data-git-default="false" data-git-has-changes="false"><div class="pi-git-branch" id="pi-git-branch" hidden><span class="pi-git-branch-name" id="pi-git-branch-name" title={t('git.currentBranch')}></span><button type="button" class="pi-git-edit" id="pi-git-branch-edit" title={t('git.renameBranch')} aria-label={t('git.renameBranch')}></button><input type="text" class="pi-git-branch-input" id="pi-git-branch-input" autocomplete="off" spellcheck="false" aria-label={t('git.newBranchName')} hidden></div><div class="pi-git-right"><button type="button" class="pi-git-pr-button pi-btw-button" id="pi-btw-button" title="btw">btw</button><div class="pi-git-pr" id="pi-git-pr" hidden><button type="button" class="pi-git-pr-button pi-git-primary" id="pi-git-primary"><span id="pi-git-primary-label">{t('git.createPr')}</span></button><button type="button" class="pi-git-pr-button pi-git-caret" id="pi-git-caret" aria-haspopup="true" aria-expanded="false" aria-label={t('git.moreActions')}>{@html icon(ChevronDown, { size: 12 })}</button><div class="pi-git-pr-menu" id="pi-git-pr-menu" role="menu" hidden><button type="button" class="pi-git-pr-item" id="pi-git-pr-view" role="menuitem" hidden>{t('git.viewPr')} {@html icon(ExternalLink, { size: 12 })}</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-draft" role="menuitem" hidden>{t('git.createDraftPr')}</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-manual" role="menuitem">{t('git.createPrManually')} {@html icon(ExternalLink, { size: 12 })}</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-merge" role="menuitem" hidden>{t('git.mergePr')}</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-commit" role="menuitem" hidden>{t('git.commitPush')}</button></div></div></div></div>
</form>
