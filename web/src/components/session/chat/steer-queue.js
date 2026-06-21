import { icon, X, CornerDownRight, Layers } from '../../../shared/icons.js';
import { t } from '../../../shared/i18n.js';

// Steer/queue support for the composer while a run is in progress.
//
//   - Steer: the message is sent immediately. Because the worker is already
//     running, the server tags the prompt `streamingBehavior:"steer"` so pi
//     folds it into the active turn. A transient chip shows above the input
//     until the run finishes (the steer has, by then, been picked up).
//   - Queue: the message is held locally as a deletable chip and is sent as a
//     fresh turn once the current run completes. Multiple queued messages are
//     delivered one per completed run, in order.
//
// `activeRun` is driven solely by the `pi-chat-message-sent` (-> true) and
// `pi-worker-done` (-> false) events, so the very first message of a run is
// never mistaken for a steer and dequeued messages start clean turns.
export function setupSteerQueue({
  documentImpl = document,
  windowImpl = window,
  pendingList,
  queueButton,
  textarea,
  attachments = { files: () => [], composeMessage: (typed) => typed, clear: () => {} },
  sendChatMessage = async () => false,
  autoResizeTextarea = () => {},
  updateSendEnabled = () => {},
} = {}) {
  let queued = [];
  let steerChips = [];
  let activeRun = false;
  let suppressSteerChip = false;
  let seq = 0;
  const nextId = () => 'sq-' + Date.now().toString(36) + '-' + seq++;

  function hasContent() {
    const typed = textarea ? textarea.value.trim() : '';
    return typed.length > 0 || !!attachments.files?.().length;
  }

  function updateQueueEnabled() {
    if (queueButton) queueButton.disabled = !hasContent();
  }

  function chipText(text) {
    const trimmed = String(text || '').trim();
    return trimmed || t('composer.attachmentText');
  }

  function render() {
    if (!pendingList) return;
    const fragment = documentImpl.createDocumentFragment();

    for (const chip of steerChips) {
      const item = documentImpl.createElement('span');
      item.className = 'pi-chat-pending-item pi-chat-pending-steer';
      item.title = t('composer.steering');
      const label = documentImpl.createElement('span');
      label.className = 'pi-chat-pending-label';
      label.innerHTML = icon(CornerDownRight, { size: 12 });
      const text = documentImpl.createElement('span');
      text.textContent = chipText(chip.text);
      label.appendChild(text);
      item.appendChild(label);
      fragment.appendChild(item);
    }

    queued.forEach((entry) => {
      const item = documentImpl.createElement('span');
      item.className = 'pi-chat-pending-item pi-chat-pending-queued';
      const label = documentImpl.createElement('span');
      label.className = 'pi-chat-pending-label';
      label.innerHTML = icon(Layers, { size: 12 });
      const text = documentImpl.createElement('span');
      text.textContent = chipText(entry.displayText);
      label.appendChild(text);
      item.appendChild(label);

      const remove = documentImpl.createElement('button');
      remove.type = 'button';
      remove.className = 'pi-chat-remove';
      remove.setAttribute('aria-label', t('composer.removeQueued'));
      remove.innerHTML = icon(X, { size: 13 });
      remove.addEventListener('click', () => {
        queued = queued.filter((q) => q.id !== entry.id);
        render();
      });
      item.appendChild(remove);
      fragment.appendChild(item);
    });

    pendingList.replaceChildren(fragment);
  }

  function enqueueFromComposer() {
    const typed = textarea ? textarea.value.trim() : '';
    const message = attachments.composeMessage(typed);
    const files = (attachments.files?.() || []).slice();
    if (!message && files.length === 0) return false;
    queued.push({ id: nextId(), text: message, files, displayText: typed });
    if (textarea) textarea.value = '';
    attachments.clear?.();
    autoResizeTextarea();
    updateSendEnabled();
    updateQueueEnabled();
    render();
    if (textarea && typeof textarea.focus === 'function') textarea.focus();
    return true;
  }

  function dequeueNext() {
    if (queued.length === 0) return;
    const [next] = queued.splice(0, 1);
    render();
    suppressSteerChip = true;
    // sendChatMessage dispatches `pi-chat-message-sent` synchronously before its
    // first await, so the suppress flag is observed by that handler.
    void sendChatMessage(next.text, next.files);
    suppressSteerChip = false;
  }

  const onMessageSent = (event) => {
    const message = event?.detail?.message;
    if (activeRun && !suppressSteerChip) {
      steerChips.push({ id: nextId(), text: message });
      render();
    }
    activeRun = true;
  };

  const onWorkerDone = () => {
    activeRun = false;
    if (steerChips.length > 0) {
      steerChips = [];
      render();
    }
    dequeueNext();
  };

  queueButton?.addEventListener('click', enqueueFromComposer);
  textarea?.addEventListener('input', updateQueueEnabled);
  windowImpl.addEventListener('pi-chat-message-sent', onMessageSent);
  windowImpl.addEventListener('pi-worker-done', onWorkerDone);

  updateQueueEnabled();
  render();

  return {
    enqueueFromComposer,
    queuedCount: () => queued.length,
    steerCount: () => steerChips.length,
    dispose: () => {
      windowImpl.removeEventListener('pi-chat-message-sent', onMessageSent);
      windowImpl.removeEventListener('pi-worker-done', onWorkerDone);
    },
  };
}
