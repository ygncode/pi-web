<script module>
  import { t } from '../../shared/i18n.js';
  import { runChatComposer } from './chat/chat-composer-runtime.js';
  // runChatComposer is the live-only DOM/runtime glue (used by onMount below).
  // Re-exported so existing imports and tests can reach it via this module.
  // eslint-disable-next-line no-import-assign -- re-export of an imported binding; false positive across module/instance scripts
  export { runChatComposer };
</script>

<script>
  import { onMount } from 'svelte';
  import { escapeHtml } from '../../session/render/session-format.js';
  import { getSessionRuntime } from '../../session/session-runtime-context.js';
  import * as chatApi from '../../session/chat/chat-api.js';
  import GitFooter from './GitFooter.svelte';
  import ChatExpandButton from './chat/ChatExpandButton.svelte';
  import ChatSelectorPopups from './chat/ChatSelectorPopups.svelte';
  import ChatToolbar from './chat/ChatToolbar.svelte';
  import ContextUsage from './chat/ContextUsage.svelte';
  import QueuePanel from './chat/QueuePanel.svelte';
  import TextAttachmentModal from './chat/TextAttachmentModal.svelte';
  import { ChatToolbarState } from './chat/chat-toolbar-state.svelte.js';
  import { QueueStore } from './chat/queue-store.svelte.js';

  let {
    sessionId = '',
    chatAvailable = true,
    chatDisabledReason = '',
    cwd = '',
    modelLabel = '',
  } = $props();

  // Reactive toolbar state owned here so the live runtime can mutate it while
  // <ChatToolbar> renders from it.
  const toolbar = new ChatToolbarState();
  // Reactive queue panel state — shared with chat-composer-runtime so its
  // steer/queue glue mutates the same items <QueuePanel> renders.
  const queueStore = new QueueStore();

  // The composer runtime lives in <script module> (runChatComposer). It reads the
  // shared model + navigateTo (owned by SessionPage runtime context) at mount —
  // both are ready before this onMount. <LiveReload> mounts first, so its
  // pi-chat-message-sent listener is attached before the user can send. Live-only.
  onMount(() => {
    const target = window;
    const runtime = getSessionRuntime();
    const model = runtime.model;
    globalThis.__PI_TEST_CHAT_COMPOSER_HOOK__?.();
    runChatComposer({
      documentImpl: document,
      windowImpl: target,
      locationImpl: target.location,
      localEntries: model?.entries || [],
      leafId: model?.leafId || '',
      urlTargetId: model?.urlTargetId || '',
      byId: model?.byId || new Map(),
      navigateTo: runtime.navigateTo,
      escapeHtml: (text) => escapeHtml(text, { documentImpl: document }),
      chatApi,
      FormDataImpl: target.FormData,
      URLSearchParamsImpl: target.URLSearchParams,
      CustomEventImpl: target.CustomEvent,
      setIntervalImpl: target.setInterval.bind(target),
      toolbar,
      queueStore,
    });
  });
</script>

<form
  id="pi-chat-composer"
  class="pi-chat-composer"
  data-session-id={sessionId}
  data-chat-available={chatAvailable}
  data-chat-disabled-reason={chatDisabledReason}
>
  <input
    id="pi-chat-images"
    name="images"
    type="file"
    accept="image/*"
    multiple
    hidden
    disabled={!chatAvailable}
  />
  <div class="pi-chat-shell">
    <ChatExpandButton {chatAvailable} />
    {#if cwd}<div class="pi-chat-toolbar pi-chat-cwd-bar">
        <span class="pi-chat-cwd" title={t('composer.copyPath')} data-cwd={cwd}>cwd: {cwd}</span
        ><span class="pi-chat-focus-shortcut">{t('composer.focusShortcut')}</span>
      </div>{/if}
    {#if !chatAvailable}<div class="pi-chat-disabled-notice">{chatDisabledReason}</div>{/if}
    <QueuePanel store={queueStore} />
    <textarea
      id="pi-chat-message"
      name="message"
      rows="1"
      placeholder={t('composer.placeholder')}
      disabled={!chatAvailable}
    ></textarea>
    <div id="pi-chat-attachments" class="pi-chat-attachments"></div>
    <ChatSelectorPopups />
    <ChatToolbar {chatAvailable} {toolbar} {modelLabel} />
    <ContextUsage popover />
  </div>
  <TextAttachmentModal />
  <GitFooter {sessionId} />
</form>
