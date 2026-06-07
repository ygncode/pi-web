import { describe, expect, it, vi } from 'vitest';
import { setupModelSelector } from './ChatComposer.svelte';

function createDom() {
  const div = document.createElement('div');
  div.innerHTML = `
    <button id="pi-chat-model-label">Model</button>
    <div id="pi-chat-model-popup" style="display:none">
      <input id="pi-chat-model-search" />
      <div id="pi-chat-model-list"></div>
    </div>
    <textarea id="pi-chat-message"></textarea>
  `;
  document.body.appendChild(div);
  return div;
}

function cleanupDom(el) {
  el.remove();
}

describe('setupModelSelector', () => {
  it('returns { open, close } API', () => {
    const el = createDom();
    const chatApi = {
      listModels: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) }),
    };
    const api = setupModelSelector({ documentImpl: document, sessionId: 's', chatApi });
    expect(api).toHaveProperty('open');
    expect(api).toHaveProperty('close');
    cleanupDom(el);
  });

  describe('open', () => {
    it('shows the popup and focuses the search input', () => {
      const el = createDom();
      const chatApi = {
        listModels: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) }),
      };
      const api = setupModelSelector({ documentImpl: document, sessionId: 's', chatApi });
      const popup = document.getElementById('pi-chat-model-popup');
      const search = document.getElementById('pi-chat-model-search');
      search.focus = vi.fn();

      api.open();

      expect(popup.style.display).toBe('flex');
      expect(search.focus).toHaveBeenCalled();
      cleanupDom(el);
    });

    it('clears the search input on open', () => {
      const el = createDom();
      const chatApi = {
        listModels: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) }),
      };
      const api = setupModelSelector({ documentImpl: document, sessionId: 's', chatApi });
      const search = document.getElementById('pi-chat-model-search');
      search.value = 'stale text';

      api.open();

      expect(search.value).toBe('');
      cleanupDom(el);
    });
  });

  describe('close', () => {
    it('hides the popup', () => {
      const el = createDom();
      const chatApi = {
        listModels: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) }),
      };
      const api = setupModelSelector({ documentImpl: document, sessionId: 's', chatApi });
      const popup = document.getElementById('pi-chat-model-popup');

      api.open();
      expect(popup.style.display).toBe('flex');

      api.close();
      expect(popup.style.display).toBe('none');
      cleanupDom(el);
    });

    it('re-focuses the chat textarea when close(true) is called', () => {
      const el = createDom();
      const chatApi = {
        listModels: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) }),
      };
      const api = setupModelSelector({ documentImpl: document, sessionId: 's', chatApi });
      const textarea = document.getElementById('pi-chat-message');
      textarea.focus = vi.fn();

      api.open();
      api.close(true);

      expect(textarea.focus).toHaveBeenCalled();
      cleanupDom(el);
    });

    it('does not focus the textarea when close(false) is called', () => {
      const el = createDom();
      const chatApi = {
        listModels: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) }),
      };
      const api = setupModelSelector({ documentImpl: document, sessionId: 's', chatApi });
      const textarea = document.getElementById('pi-chat-message');
      textarea.focus = vi.fn();

      api.open();
      api.close(false);

      expect(textarea.focus).not.toHaveBeenCalled();
      cleanupDom(el);
    });
  });
});
