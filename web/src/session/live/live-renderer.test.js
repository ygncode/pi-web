import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import { createLiveRenderer } from './live-renderer.js';

describe('live renderer', () => {
  it('renders user and assistant entries', () => {
    const dom = new JSDOM('<body></body>');
    const renderer = createLiveRenderer({ documentImpl: dom.window.document, markedImpl: marked });
    expect(renderer.renderEntry({ id: 'u', type: 'message', message: { role: 'user', content: 'hello' } }, [])).toContain('user-message');
    expect(renderer.renderEntry({ id: 'a', type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] } }, [])).toContain('assistant-message');
  });

  it('caches tool results for assistant tool calls', () => {
    const dom = new JSDOM('<body></body>');
    const renderer = createLiveRenderer({ documentImpl: dom.window.document, markedImpl: marked });
    const entries = [
      { id: 'r', type: 'message', message: { role: 'toolResult', toolCallId: 'c1', content: [{ type: 'text', text: 'ok' }] } },
      { id: 'a', type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'c1', name: 'bash', arguments: { command: 'echo ok' } }] } }
    ];
    const html = renderer.renderEntry(entries[1], entries);
    expect(html).toContain('$ echo ok');
    expect(html).toContain('ok');
  });
});
