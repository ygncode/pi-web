// Runtime glue between the chat-composer DOM and the reactive QueueStore that
// drives <QueuePanel>. Pure JS so it can be unit-tested without Svelte.
//
//   - Steer: the message is sent immediately to /api/chat. Because the worker
//     is already running, the server tags the prompt streamingBehavior:"steer"
//     so pi folds it into the active turn. The steer row in the panel is
//     browser-local and disappears either when the user dismisses it or when
//     the run completes.
//   - Queue: enqueueing goes through POST /api/chat/queue; the autonomous
//     server-side drainer dispatches items to the worker when it becomes idle
//     (or via a kick from the queue API). The browser is just a viewer onto
//     the server-side queue, kept in sync by SSE 'queue' events.
//   - sendNow / edit: both pull a queued row out of the server queue (DELETE)
//     before acting on it locally — send via /api/chat (sendNow) or put back
//     into the textarea (edit). That way the server doesn't try to dispatch
//     a row we've already taken over.
//
// `activeRun` is driven solely by the `pi-chat-message-sent` (-> true) and
// `pi-worker-done` (-> false) events, so the first message of a run is never
// mistaken for a steer.
export function setupSteerQueue({
  windowImpl = window,
  store,
  queueButton,
  textarea,
  attachments = { files: () => [], composeMessage: (typed) => typed, clear: () => {} },
  sendChatMessage = async () => false,
  autoResizeTextarea = () => {},
  updateSendEnabled = () => {},
  queueApi = null,
} = {}) {
  if (!store) throw new Error('setupSteerQueue: store is required');

  let activeRun = false;

  function hasContent() {
    const typed = textarea ? textarea.value.trim() : '';
    return typed.length > 0 || !!attachments.files?.().length;
  }

  function updateQueueEnabled() {
    if (queueButton) queueButton.disabled = !hasContent();
  }

  function enqueueFromComposer() {
    const typed = textarea ? textarea.value.trim() : '';
    const message = attachments.composeMessage(typed);
    const files = (attachments.files?.() || []).slice();
    if (!message && files.length === 0) return false;
    // Clear the composer synchronously so a rapid second queue click can read
    // fresh content from the textarea before our POST round-trips. The store
    // mutation lands later when api.add resolves.
    if (textarea) textarea.value = '';
    attachments.clear?.();
    autoResizeTextarea();
    updateSendEnabled();
    updateQueueEnabled();
    if (textarea && typeof textarea.focus === 'function') textarea.focus();
    void store.enqueueQueued({ message, displayText: typed, files });
    return true;
  }

  async function sendNow(id) {
    const focused = store.items.find((it) => it.id === id);
    if (!focused || focused.kind !== 'queued') return;
    // Pull from the server first so the drainer doesn't race us.
    if (queueApi && Number.isInteger(focused.position)) {
      try {
        await queueApi.remove(focused.position);
      } catch {
        /* best-effort — proceed even if the server-side delete fails */
      }
    }
    store.takeLocalById(id);
    void sendChatMessage(focused.text, focused.files || []);
  }

  async function edit(id) {
    const focused = store.items.find((it) => it.id === id);
    if (!focused || focused.kind !== 'queued') return;
    if (queueApi && Number.isInteger(focused.position)) {
      try {
        await queueApi.remove(focused.position);
      } catch {
        /* ignore — local-only edit still works */
      }
    }
    store.takeLocalById(id);
    if (textarea) {
      textarea.value = focused.displayText || focused.text || '';
      autoResizeTextarea();
      updateSendEnabled();
      updateQueueEnabled();
      if (typeof textarea.focus === 'function') textarea.focus();
    }
  }

  async function resume() {
    await store.setPaused(false);
    // The server-side drainer kicks itself on PATCH, so no client-side
    // dispatch is needed.
  }

  const onMessageSent = (event) => {
    const message = event?.detail?.message;
    if (activeRun) {
      store.pushSteer({ text: message });
    }
    activeRun = true;
  };

  const onWorkerDone = () => {
    activeRun = false;
    store.clearSteers();
    // Server drainer dispatches the next queued message; SSE 'queue' event
    // will refresh the panel so the head item disappears from the list.
  };

  store.actions.sendNow = sendNow;
  store.actions.edit = edit;
  store.actions.resume = resume;

  queueButton?.addEventListener('click', enqueueFromComposer);
  textarea?.addEventListener('input', updateQueueEnabled);
  windowImpl.addEventListener('pi-chat-message-sent', onMessageSent);
  windowImpl.addEventListener('pi-worker-done', onWorkerDone);

  updateQueueEnabled();

  return {
    enqueueFromComposer,
    sendNow,
    edit,
    resume,
    queuedCount: () => store.queuedCount,
    steerCount: () => store.steerCount,
    dispose: () => {
      windowImpl.removeEventListener('pi-chat-message-sent', onMessageSent);
      windowImpl.removeEventListener('pi-worker-done', onWorkerDone);
    },
  };
}
