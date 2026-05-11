import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderModelList, setupModelSelector } from './model-selector.js';

const models = [
  { provider: 'openai', id: 'gpt-5', name: 'GPT 5' },
  { provider: 'anthropic', modelId: 'sonnet', scoped: true }
];

describe('model selector', () => {
  it('renders grouped model list', () => {
    const html = renderModelList(models, { selectedModel: models[1], escapeHtml: (x) => x });
    expect(html).toContain('model-provider">anthropic');
    expect(html).toContain('model-item selected');
    expect(html).toContain('model-scope-badge');
  });

  it('loads models, detects current model, and switches models', async () => {
    const dom = new JSDOM(`<body>
      <button id="pi-chat-model-label"></button>
      <div id="pi-chat-model-popup" style="display:none"></div>
      <input id="pi-chat-model-search" />
      <div id="pi-chat-model-list"></div>
    </body>`);
    const chatApi = {
      listModels: vi.fn(() => Promise.resolve(new Response(JSON.stringify({ models }), { status: 200 }))),
      setModel: vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    };
    const setModelLabel = vi.fn();
    const setKnownModelLabel = vi.fn();
    const setCurrentModelForThinking = vi.fn();
    const setWorkerModelUpdate = vi.fn();
    const setChatStatus = vi.fn();

    const ok = await setupModelSelector({
      documentImpl: dom.window.document,
      sessionId: 's',
      entries: [{ type: 'model_change', provider: 'openai', modelId: 'gpt-5' }],
      chatApi,
      escapeHtml: (x) => x,
      setModelLabel,
      setKnownModelLabel,
      getKnownModelLabel: () => '',
      setCurrentModelForThinking,
      setWorkerModelUpdate,
      setChatStatus
    });

    expect(ok).toBe(true);
    expect(setWorkerModelUpdate).toHaveBeenCalled();
    expect(setCurrentModelForThinking).toHaveBeenCalledWith(models[0]);
    expect(setModelLabel).toHaveBeenCalledWith('GPT 5 @ openai');

    dom.window.document.getElementById('pi-chat-model-label').click();
    dom.window.document.querySelector('[data-model-id="sonnet"]').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chatApi.setModel).toHaveBeenCalledWith('s', { provider: 'anthropic', modelId: 'sonnet' });
    expect(setChatStatus).toHaveBeenCalledWith('switched', 'ok');
  });
});
