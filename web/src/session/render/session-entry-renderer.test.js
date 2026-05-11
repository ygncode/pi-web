import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import hljs from 'highlight.js';
import { createSessionEntryRenderer } from './session-entry-renderer.js';

function renderer(extra = {}) {
  const dom = new JSDOM('<body></body>', { url: 'https://example.test/session?id=s' });
  return createSessionEntryRenderer({
    entries: [],
    header: { id: 'sid' },
    toolCallMap: new Map(),
    currentLeafIdRef: () => 'leaf',
    escapeHtml: (text) => String(text).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    shortenPath: (path) => path,
    formatToolCall: (name) => `[${name}]`,
    safeMarkedParse: (text) => `<p>${text}</p>`,
    hljs,
    documentImpl: dom.window.document,
    windowImpl: dom.window,
    navigatorImpl: {},
    URLImpl: dom.window.URL,
    BlobImpl: dom.window.Blob,
    ...extra
  });
}

describe('session entry renderer', () => {
  it('renders basic message entries', () => {
    const r = renderer();
    expect(r.renderEntry({ id: 'u', type: 'message', message: { role: 'user', content: 'hello' } })).toContain('user-message');
    expect(r.renderEntry({ id: 'a', type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] } })).toContain('assistant-message');
  });

  it('renders custom tool calls without pre-rendered tool data', () => {
    const r = renderer();
    const html = r.renderEntry({
      id: 'a',
      type: 'message',
      message: {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'call-1', name: 'custom_tool', arguments: { value: '<x>' } }]
      }
    });
    expect(html).toContain('custom_tool');
    expect(html).toContain('&lt;x&gt;');
  });

  it('renders custom tool calls with pre-rendered tool data', () => {
    const r = renderer({ renderedTools: { 'call-1': { callHtml: '<span>custom rendered</span>' } } });
    const html = r.renderEntry({
      id: 'a',
      type: 'message',
      message: {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'call-1', name: 'custom_tool', arguments: {} }]
      }
    });
    expect(html).toContain('custom rendered');
  });

  it('builds share urls with current leaf id', () => {
    const r = renderer();
    expect(r.buildShareUrl('target')).toContain('leafId=leaf');
    expect(r.buildShareUrl('target')).toContain('targetId=target');
  });

  it('copies with clipboard feedback', async () => {
    const dom = new JSDOM('<body><button>copy</button></body>');
    const writeText = vi.fn(() => Promise.resolve());
    const r = renderer({ documentImpl: dom.window.document, windowImpl: dom.window, navigatorImpl: { clipboard: { writeText } } });
    const button = dom.window.document.querySelector('button');
    await r.copyToClipboard('x', button);
    expect(writeText).toHaveBeenCalledWith('x');
    expect(button.classList.contains('copied')).toBe(true);
  });
});
