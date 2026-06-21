import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSteerQueue } from './steer-queue.js';

function makeAttachments() {
  let files = [];
  return {
    files: () => files,
    setFiles: (next) => {
      files = next;
    },
    composeMessage: (typed) => typed,
    clear: vi.fn(() => {
      files = [];
    }),
  };
}

function render() {
  document.body.innerHTML = `
    <div id="pi-chat-pending"></div>
    <textarea id="pi-chat-message"></textarea>
    <button id="pi-chat-queue"></button>
  `;
  return {
    pendingList: document.getElementById('pi-chat-pending'),
    textarea: document.getElementById('pi-chat-message'),
    queueButton: document.getElementById('pi-chat-queue'),
  };
}

function fire(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function type(textarea, value) {
  textarea.value = value;
  textarea.dispatchEvent(new Event('input'));
}

let api;

afterEach(() => {
  api?.dispose();
  api = null;
  document.body.innerHTML = '';
});

describe('setupSteerQueue', () => {
  let dom;
  let attachments;
  let sendChatMessage;

  beforeEach(() => {
    dom = render();
    attachments = makeAttachments();
    sendChatMessage = vi.fn(async () => true);
    api = setupSteerQueue({
      windowImpl: window,
      pendingList: dom.pendingList,
      queueButton: dom.queueButton,
      textarea: dom.textarea,
      attachments,
      sendChatMessage,
    });
  });

  it('enqueues composer content as a deletable chip without sending', () => {
    type(dom.textarea, 'queued one');
    dom.queueButton.click();

    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(api.queuedCount()).toBe(1);
    expect(dom.textarea.value).toBe('');
    const chip = dom.pendingList.querySelector('.pi-chat-pending-queued');
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('queued one');
    expect(chip.querySelector('.pi-chat-remove')).not.toBeNull();
  });

  it('removes a queued chip when its delete button is clicked', () => {
    type(dom.textarea, 'to delete');
    dom.queueButton.click();
    expect(api.queuedCount()).toBe(1);

    dom.pendingList.querySelector('.pi-chat-remove').click();

    expect(api.queuedCount()).toBe(0);
    expect(dom.pendingList.querySelector('.pi-chat-pending-queued')).toBeNull();
  });

  it('sends queued messages one per completed run, in order', () => {
    type(dom.textarea, 'first');
    dom.queueButton.click();
    type(dom.textarea, 'second');
    dom.queueButton.click();
    expect(api.queuedCount()).toBe(2);

    fire('pi-worker-done');
    expect(sendChatMessage).toHaveBeenCalledTimes(1);
    expect(sendChatMessage).toHaveBeenLastCalledWith('first', []);
    expect(api.queuedCount()).toBe(1);

    fire('pi-worker-done');
    expect(sendChatMessage).toHaveBeenCalledTimes(2);
    expect(sendChatMessage).toHaveBeenLastCalledWith('second', []);
    expect(api.queuedCount()).toBe(0);
  });

  it('shows a steer chip only for sends after a run is already active', () => {
    // First send starts the run: not a steer.
    fire('pi-chat-message-sent', { message: 'start' });
    expect(api.steerCount()).toBe(0);
    expect(dom.pendingList.querySelector('.pi-chat-pending-steer')).toBeNull();

    // Second send during the active run: a steer.
    fire('pi-chat-message-sent', { message: 'also check tests' });
    expect(api.steerCount()).toBe(1);
    const chip = dom.pendingList.querySelector('.pi-chat-pending-steer');
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('also check tests');
  });

  it('clears steer chips when the run completes', () => {
    fire('pi-chat-message-sent', { message: 'start' });
    fire('pi-chat-message-sent', { message: 'steer me' });
    expect(api.steerCount()).toBe(1);

    fire('pi-worker-done');

    expect(api.steerCount()).toBe(0);
    expect(dom.pendingList.querySelector('.pi-chat-pending-steer')).toBeNull();
  });

  it('does not treat an auto-dequeued message as a steer', () => {
    // A real sendChatMessage dispatches pi-chat-message-sent synchronously; the
    // dequeue path suppresses the steer chip for that internal send.
    sendChatMessage.mockImplementation(async (message) => {
      fire('pi-chat-message-sent', { message });
      return true;
    });
    type(dom.textarea, 'queued work');
    dom.queueButton.click();

    fire('pi-worker-done');

    expect(sendChatMessage).toHaveBeenCalledWith('queued work', []);
    expect(api.steerCount()).toBe(0);
  });
});
