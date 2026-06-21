export function getComposerElements({ documentImpl = document, form } = {}) {
  return {
    form,
    textarea: documentImpl.getElementById('pi-chat-message'),
    fileInput: documentImpl.getElementById('pi-chat-images'),
    attachButton: documentImpl.getElementById('pi-chat-attach'),
    attachmentList: documentImpl.getElementById('pi-chat-attachments'),
    sendButton: documentImpl.getElementById('pi-chat-send'),
    cancelButton: documentImpl.getElementById('pi-chat-cancel'),
    queueButton: documentImpl.getElementById('pi-chat-queue'),
    shell: form?.querySelector('.pi-chat-shell') || null,
    expandButton: documentImpl.getElementById('pi-chat-expand'),
  };
}
