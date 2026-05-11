import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderThinkingLevelList, setupThinkingLevelSelector } from './thinking-selector.js';

describe('thinking selector', () => {
  it('renders unsupported and selected levels', () => {
    const html = renderThinkingLevelList({ selectedLevel: 'medium', currentModel: { reasoning: false } });
    expect(html).toContain('thinking-medium selected');
    expect(html).toContain('medium (unsupported)');
  });

  it('sets detected level and handles level clicks', async () => {
    const dom = new JSDOM(`<body>
      <button id="pi-chat-thinking-label"></button>
      <div id="pi-chat-thinking-popup" style="display:none"></div>
      <div id="pi-chat-thinking-list"></div>
    </body>`);
    Object.defineProperty(dom.window, 'innerWidth', { value: 800, configurable: true });
    Object.defineProperty(dom.window, 'innerHeight', { value: 600, configurable: true });
    const setKnownThinkingLevel = vi.fn();
    const setThinkingLabel = vi.fn();
    const setChatStatus = vi.fn();
    const chatApi = { setThinkingLevel: vi.fn(() => Promise.resolve(new Response(JSON.stringify({ thinkingLevel: 'high' }), { status: 200 }))) };

    setupThinkingLevelSelector({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      sessionId: 's',
      entries: [{ type: 'thinking_level_change', thinkingLevel: 'medium' }],
      getCurrentModel: () => ({ reasoning: true }),
      getKnownThinkingLevel: () => 'medium',
      setKnownThinkingLevel,
      setThinkingLabel,
      setChatStatus,
      chatApi
    });

    expect(setKnownThinkingLevel).toHaveBeenCalledWith('medium');
    dom.window.document.getElementById('pi-chat-thinking-label').click();
    dom.window.document.querySelector('[data-level="high"]').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chatApi.setThinkingLevel).toHaveBeenCalledWith('s', 'high');
    expect(setKnownThinkingLevel).toHaveBeenCalledWith('high');
    expect(setThinkingLabel).toHaveBeenCalledWith('high');
    expect(setChatStatus).toHaveBeenCalledWith('thinking: high', 'ok');
  });
});
