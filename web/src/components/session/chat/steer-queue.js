// Runtime glue between the chat-composer DOM and the reactive QueueStore that
// drives <QueuePanel>. Pure JS so it can be unit-tested without Svelte.
//
//   - Steer: the message is sent immediately. Because the worker is already
//     running, the server tags the prompt `streamingBehavior:"steer"` so pi
//     folds it into the active turn. A steer row appears in the queue panel
//     until the run finishes (or until the user dismisses it).
//   - Queue: the message is held locally as a row in the panel and is sent as
//     a fresh turn once the current run completes — unless the panel is paused,
//     in which case it waits until the user hits Resume.
//
// `activeRun` is driven solely by the `pi-chat-message-sent` (-> true) and
// `pi-worker-done` (-> false) events, so the very first message of a run is
// never mistaken for a steer and dequeued / send-now messages start clean turns.
export function setupSteerQueue({
  windowImpl = window,
  store,
  queueButton,
  textarea,
  attachments = { files: () => [], composeMessage: (typed) => typed, clear: () => {} },
  sendChatMessage = async () => false,
  autoResizeTextarea = () => {},
  updateSendEnabled = () => {},
} = {}) {
  if (!store) throw new Error('setupSteerQueue: store is required');

  let activeRun = false;
  let seq = 0;
  const nextId = () => 'sq-' + Date.now().toString(36) + '-' + seq++;

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
    store.enqueue({ id: nextId(), kind: 'queued', text: message, files, displayText: typed });
    if (textarea) textarea.value = '';
    attachments.clear?.();
    autoResizeTextarea();
    updateSendEnabled();
    updateQueueEnabled();
    if (textarea && typeof textarea.focus === 'function') textarea.focus();
    return true;
  }

  function dispatch(item) {
    // Auto-dequeue is gated by pi-worker-done which sets activeRun=false first,
    // so onMessageSent naturally won't tag it as a steer. sendNow (the Enter
    // shortcut) fires while activeRun=true, so the dispatched message *will*
    // be added as a steer row — that's intentional: the user can see their
    // skip-ahead message in flight, and dismiss the chip if they want.
    void sendChatMessage(item.text, item.files);
  }

  function dequeueNext() {
    if (store.paused) return;
    const next = store.takeQueuedHead();
    if (!next) return;
    dispatch(next);
  }

  function sendNow(id) {
    const item = store.takeById(id);
    if (!item || item.kind !== 'queued') return;
    dispatch(item);
  }

  function edit(id) {
    const item = store.takeById(id);
    if (!item || item.kind !== 'queued') return;
    if (textarea) {
      textarea.value = item.displayText || item.text || '';
      autoResizeTextarea();
      updateSendEnabled();
      updateQueueEnabled();
      if (typeof textarea.focus === 'function') textarea.focus();
    }
  }

  function resume() {
    store.setPaused(false);
    if (!activeRun) dequeueNext();
  }

  const onMessageSent = (event) => {
    const message = event?.detail?.message;
    if (activeRun) {
      store.pushSteer({ id: nextId(), kind: 'steer', text: message });
    }
    activeRun = true;
  };

  const onWorkerDone = () => {
    activeRun = false;
    store.clearSteers();
    dequeueNext();
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
