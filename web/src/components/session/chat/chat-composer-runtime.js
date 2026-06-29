// Live-only DOM/runtime glue for the chat composer, extracted from
// ChatComposer.svelte so the component stays declarative. Kept DI-friendly so
// tests can drive it directly and inject selector implementations.
import { THINKING_LEVELS } from '../../../session/chat/chat-selectors.js';
import { setupModelSelector } from './model-selector.js';
import { setupThinkingLevelSelector } from './thinking-selector.js';
import { setupSlashCommands } from './slash-command.js';
import { setupMentionAutocomplete } from './mention-autocomplete.js';
import { createContextUsageController } from './context-usage.js';
import { setupComposerExpansion } from './composer-expand.js';
import { setupWorkerStatusPolling } from './worker-status.js';
import { setupAskQuestionHandlers } from './ask-question-handler.js';
import { readComposerConfig } from './composer-config.js';
import { getComposerElements } from './composer-elements.js';
import { setupContextPopover } from './context-popover.js';
import { setupTextareaControls } from './textarea-controls.js';
import { setupAttachmentManager } from './attachment-manager.js';
import { setupCwdCopy } from './cwd-copy.js';
import { setupComposerHeightVar } from './composer-height.js';
import { createComposerSendState } from './composer-send-state.js';
import { getComposerStorage } from './composer-storage.js';
import { navigateInitialChatLeaf } from './initial-navigation.js';
import { ChatToolbarState } from './chat-toolbar-state.svelte.js';
import { setupChatSubmission } from './chat-submit.js';
import { setupSteerQueue } from './steer-queue.js';
import { QueueStore } from './queue-store.svelte.js';
import { createChatSelectorLoaders } from './selector-loaders.js';
import { createCompactController } from './compact-controller.js';

export function runChatComposer({
  documentImpl = document,
  windowImpl = window,
  locationImpl = windowImpl.location,
  localEntries = [],
  leafId = '',
  urlTargetId = '',
  byId = new Map(),
  navigateTo = () => {},
  escapeHtml = (text) => String(text),
  chatApi,
  chatSelectors = { THINKING_LEVELS },
  modelSelector = { setupModelSelector },
  thinkingSelector = { setupThinkingLevelSelector },
  slashSelector = { setupSlashCommands },
  mentionSelector = { setupMentionAutocomplete },
  FormDataImpl = FormData,
  URLSearchParamsImpl = URLSearchParams,
  CustomEventImpl = CustomEvent,
  setIntervalImpl = setInterval,
  toolbar = new ChatToolbarState(),
  queueStore = new QueueStore(),
  queueApi = null,
  getLiveEntries = null,
} = {}) {
  const document = documentImpl;
  const window = windowImpl;
  const location = locationImpl;
  const entries = localEntries;
  const __piChatApi = chatApi;
  const __piChatSelectors = chatSelectors;
  const __piModelSelector = modelSelector;
  const __piThinkingSelector = thinkingSelector;
  const __piSlashSelector = slashSelector;
  const __piMentionSelector = mentionSelector;
  const FormData = FormDataImpl;
  const URLSearchParams = URLSearchParamsImpl;
  const CustomEvent = CustomEventImpl;
  const setInterval = setIntervalImpl;
  let onWorkerModelUpdate = null;
  let currentModelForThinking = null;
  let positionPopover = () => {};
  const contextUsage = createContextUsageController({
    documentImpl: document,
    entries,
    chatApi,
    getKnownModelLabel: () => toolbar.knownModelLabel,
    positionPopover: () => positionPopover(),
  });
  const updateContextUsage = () => contextUsage.update();
  toolbar.updateContextUsage = updateContextUsage;

  function isMobileTextInputMode() {
    return !!(
      window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches
    );
  }

  const setChatStatus = toolbar.setStatus;
  const setModelLabel = toolbar.setModelLabel;
  const setThinkingLabel = toolbar.setThinkingLabel;
  const selectorLoaders = createChatSelectorLoaders({
    documentImpl: document,
    windowImpl: window,
    locationImpl: location,
    URLSearchParamsImpl: URLSearchParams,
    entries,
    chatApi: __piChatApi,
    escapeHtml,
    modelSelector: __piModelSelector,
    thinkingSelector: __piThinkingSelector,
    slashSelector: __piSlashSelector,
    mentionSelector: __piMentionSelector,
    setModelLabel,
    setChatStatus,
    setThinkingLabel,
    setKnownModelLabel: toolbar.setKnownModelLabel,
    getKnownModelLabel: toolbar.getKnownModelLabel,
    setCurrentModelForThinking: (model) => {
      currentModelForThinking = model;
    },
    setWorkerModelUpdate: (handler) => {
      onWorkerModelUpdate = handler;
    },
    getCurrentModelForThinking: () => currentModelForThinking,
    getKnownThinkingLevel: toolbar.getKnownThinkingLevel,
    setKnownThinkingLevel: toolbar.setKnownThinkingLevel,
  });

  function setupPiChatComposer() {
    const form = document.getElementById('pi-chat-composer');
    const composerConfig = readComposerConfig({ form, setChatStatus });
    if (!composerConfig.ready) return false;
    const { sessionId } = composerConfig;
    const {
      textarea,
      fileInput,
      attachButton,
      attachmentList,
      sendButton,
      cancelButton,
      queueButton,
      shell,
      expandButton,
    } = getComposerElements({ documentImpl: document, form });

    const { update: updateComposerHeightVar } = setupComposerHeightVar({
      documentImpl: document,
      windowImpl: window,
      form,
    });

    // Expand/collapse the composer for larger typing area. State persists
    // per-session in localStorage.
    let attachments = { hasAttachments: () => false };
    const sendState = createComposerSendState({
      textarea,
      sendButton,
      getAttachments: () => attachments,
    });
    const updateSendEnabled = sendState.updateSendEnabled;

    attachments = setupAttachmentManager({
      documentImpl: document,
      windowImpl: window,
      textarea,
      fileInput,
      attachButton,
      attachmentList,
      updateSendEnabled,
    });

    const textareaControls = setupTextareaControls({
      windowImpl: window,
      textarea,
      shell,
      form,
      isMobileTextInputMode,
      getSlashSelector: () => _slashSelectorApi,
      getMentionSelector: () => _mentionSelectorApi,
      getThinkingSelector: () => _thinkingSelectorApi,
      getModelSelector: () => _modelSelectorApi,
      getCompact: () => compact,
      updateSendEnabled,
      updateComposerHeight: updateComposerHeightVar,
    });
    const autoResizeTextarea = textareaControls.autoResize;

    setupComposerExpansion({
      sessionId,
      shell,
      expandButton,
      textarea,
      storage: getComposerStorage({ windowImpl: window }),
      onHeightChange: updateComposerHeightVar,
    });

    function setStatus(text, cls) {
      setChatStatus(text, cls);
    }

    // Shared /compact trigger + "compacting" UI state, used by the keydown
    // handler, the context popover button, and the worker-status poll.
    const compact = createCompactController({
      documentImpl: document,
      chatApi: __piChatApi,
      sessionId,
      setStatus,
    });

    const submission = setupChatSubmission({
      windowImpl: window,
      form,
      textarea,
      sendButton,
      cancelButton,
      attachments,
      chatApi: __piChatApi,
      sessionId,
      setStatus,
      autoResizeTextarea,
      updateSendEnabled,
      FormDataImpl: FormData,
      CustomEventImpl: CustomEvent,
    });

    setupAskQuestionHandlers({
      documentImpl: document,
      sendChatMessage: submission.sendChatMessage,
    });

    setupSteerQueue({
      windowImpl: window,
      store: queueStore,
      queueButton,
      textarea,
      attachments,
      sendChatMessage: submission.sendChatMessage,
      autoResizeTextarea,
      updateSendEnabled,
      queueApi,
      getLiveEntries,
    });

    const workerStatus = setupWorkerStatusPolling({
      windowImpl: window,
      chatApi: __piChatApi,
      sessionId,
      setStatus,
      setModelLabel,
      setThinkingLabel,
      updateContextUsage,
      getKnownModelLabel: toolbar.getKnownModelLabel,
      setKnownModelLabel: toolbar.setKnownModelLabel,
      getKnownThinkingLevel: toolbar.getKnownThinkingLevel,
      setKnownThinkingLevel: toolbar.setKnownThinkingLevel,
      getWorkerModelUpdate: () => onWorkerModelUpdate,
      getCompact: () => compact,
      setIntervalImpl: setInterval,
      CustomEventImpl: CustomEvent,
    });
    submission.setRefreshWorkerStatus(workerStatus.refresh);

    // Focus the message textarea on page load so the user can start typing immediately.
    if (textarea && typeof textarea.focus === 'function') {
      textarea.focus();
    }

    const contextPopover = setupContextPopover({
      documentImpl: document,
      windowImpl: window,
      updateContextUsage,
      onCompact: () => compact.trigger(),
    });
    positionPopover = contextPopover.position;

    return true;
  }

  let _modelSelectorApi = null;
  let _thinkingSelectorApi = null;
  let _slashSelectorApi = null;
  let _mentionSelectorApi = null;

  function initPiChatControls() {
    setupCwdCopy({ documentImpl: document, windowImpl: window });
    if (!setupPiChatComposer()) return;

    _modelSelectorApi = selectorLoaders.loadModelSelector();
    _thinkingSelectorApi = selectorLoaders.loadThinkingSelector();
    _slashSelectorApi = selectorLoaders.loadSlashSelector();
    _mentionSelectorApi = selectorLoaders.loadMentionSelector();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPiChatControls);
  } else {
    initPiChatControls();
  }

  navigateInitialChatLeaf({ entries, leafId, urlTargetId, byId, navigateTo });
}
