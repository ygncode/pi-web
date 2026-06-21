import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import ChatToolbar from './ChatToolbar.svelte';
import { ChatToolbarState } from './chat-toolbar-state.svelte.js';

afterEach(() => {
  cleanup();
});

describe('ChatToolbar', () => {
  it('renders runtime anchors and reflects toolbar state', () => {
    const toolbar = new ChatToolbarState();
    toolbar.modelLabel = 'gpt-test';
    toolbar.setStatus('running', 'running');
    render(ChatToolbar, { props: { chatAvailable: true, toolbar } });

    expect(document.getElementById('pi-chat-attach').disabled).toBe(false);
    expect(document.getElementById('pi-chat-status').textContent).toBe('running');
    expect(document.getElementById('pi-chat-status').className).toBe('pi-chat-status running');
    expect(document.getElementById('pi-chat-thinking-label').disabled).toBe(false);
    expect(document.getElementById('pi-chat-model-label').textContent).toBe('gpt-test');
    expect(document.getElementById('pi-chat-model-label').style.display).toBe('');
    // Cancel + Queue surface only while a response is running; Send becomes Steer.
    expect(document.getElementById('pi-chat-cancel').style.display).toBe('');
    expect(document.getElementById('pi-chat-cancel').textContent).toBe('Cancel');
    expect(document.getElementById('pi-chat-queue').style.display).toBe('');
    expect(document.getElementById('pi-chat-queue').textContent).toBe('Queue');
    expect(document.getElementById('pi-chat-send').textContent).toBe('Steer');
  });

  it('falls back to defaults and hides controls when unavailable', () => {
    const toolbar = new ChatToolbarState();
    render(ChatToolbar, { props: { chatAvailable: false, toolbar } });

    expect(document.getElementById('pi-chat-attach').disabled).toBe(true);
    expect(document.getElementById('pi-chat-status').textContent).toBe('unavailable');
    expect(document.getElementById('pi-chat-thinking-label').disabled).toBe(true);
    expect(document.getElementById('pi-chat-thinking-label').style.display).toBe('none');
    expect(document.getElementById('pi-chat-model-label').disabled).toBe(true);
    expect(document.getElementById('pi-chat-model-label').style.display).toBe('none');
    expect(document.getElementById('pi-chat-model-label').textContent).toBe('Model');
    expect(document.getElementById('pi-chat-cancel').disabled).toBe(true);
  });

  it('shows the idle default status when chat is available', () => {
    const toolbar = new ChatToolbarState();
    render(ChatToolbar, { props: { chatAvailable: true, toolbar } });

    expect(document.getElementById('pi-chat-status').textContent).toBe('idle');
    expect(document.getElementById('pi-chat-cancel').style.display).toBe('none');
    expect(document.getElementById('pi-chat-queue').style.display).toBe('none');
    expect(document.getElementById('pi-chat-send').textContent).toBe('Send');
  });
});
