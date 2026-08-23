import { t } from '../../../shared/i18n.js';

export function parseCompactCommand(message) {
  if (typeof message !== 'string') return null;
  const match = message.trim().match(/^\/compact(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  return { customInstructions: (match[1] || '').trim() };
}

export function setupChatSubmission({
  windowImpl = window,
  form,
  textarea,
  sendButton,
  cancelButton,
  attachments,
  chatApi,
  sessionId = '',
  setStatus = () => {},
  autoResizeTextarea = () => {},
  updateSendEnabled = () => {},
  FormDataImpl = FormData,
  CustomEventImpl = CustomEvent,
} = {}) {
  let refreshWorkerStatus = async () => {};

  if (cancelButton) {
    cancelButton.addEventListener('click', async () => {
      cancelButton.disabled = true;
      setStatus('cancelling', 'running');
      try {
        const response = await chatApi.cancelChat(sessionId);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'cancel failed');
        setStatus('idle', '');
        refreshWorkerStatus();
      } catch (error) {
        setStatus(error.message || String(error), 'error');
      } finally {
        cancelButton.disabled = false;
      }
    });
  }

  async function sendChatMessage(message, files = attachments.files()) {
    if (!message && files.length === 0) {
      setStatus('message or image required', 'error');
      return false;
    }
    const body = new FormDataImpl();
    body.set('message', message);
    for (const file of files) body.append('images', file);
    sendButton.dataset.sending = '1';
    sendButton.disabled = true;
    setStatus('sending', 'running');
    windowImpl.dispatchEvent(new CustomEventImpl('pi-chat-message-sent', { detail: { message } }));
    try {
      const response = await chatApi.sendChat(sessionId, body);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'chat request failed');
      setStatus(data.status || 'queued', 'running');
      return true;
    } catch (error) {
      setStatus(error.message || String(error), 'error');
      return false;
    } finally {
      delete sendButton.dataset.sending;
      sendButton.disabled = false;
      updateSendEnabled();
    }
  }

  async function compactSession(customInstructions = '') {
    sendButton.dataset.sending = '1';
    sendButton.disabled = true;
    setStatus(t('composer.compacting'), 'running');
    try {
      const response = await chatApi.compactSession(sessionId, { customInstructions });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'compact request failed');
      setStatus(t('composer.compacted'), '');
      return true;
    } catch (error) {
      setStatus(error.message || String(error), 'error');
      return false;
    } finally {
      delete sendButton.dataset.sending;
      sendButton.disabled = false;
      updateSendEnabled();
    }
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const typed = textarea.value.trim();
    const filesToSend = attachments.files().slice();
    const textAttachmentsToSend = attachments.textAttachments().slice();
    const compactCommand =
      filesToSend.length === 0 && textAttachmentsToSend.length === 0
        ? parseCompactCommand(typed)
        : null;
    const message = attachments.composeMessage(typed);
    if (!message && filesToSend.length === 0) {
      setStatus('message or image required', 'error');
      return;
    }

    // Optimistically move the draft out of the composer immediately. If the
    // request fails before pi accepts it, restore the draft so the user can retry.
    textarea.value = '';
    attachments.clear();
    autoResizeTextarea();
    updateSendEnabled();

    const sent = compactCommand
      ? await compactSession(compactCommand.customInstructions)
      : await sendChatMessage(message, filesToSend);
    if (!sent) {
      textarea.value = typed;
      attachments.restore({ files: filesToSend, textAttachments: textAttachmentsToSend });
      autoResizeTextarea();
      updateSendEnabled();
    }
  });

  return {
    sendChatMessage,
    compactSession,
    setRefreshWorkerStatus: (fn) => {
      refreshWorkerStatus = typeof fn === 'function' ? fn : async () => {};
    },
  };
}
