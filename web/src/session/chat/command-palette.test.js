import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupCommandPalette } from './command-palette.js';

function makeEnv() {
  const dom = new JSDOM('<body><form><textarea id="chat"></textarea></form></body>', { url: 'https://example.test' });
  const chatInput = dom.window.document.getElementById('chat');
  const commands = [
    { name: '/compact', description: 'Compact conversation history' },
    { name: '/clear', description: 'Clear conversation' },
    { name: '/model', description: 'Switch model' },
  ];
  const fetchImpl = vi.fn(() => {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ commands }),
    });
  });
  return { dom, chatInput, commands, fetchImpl };
}

describe('command palette', () => {
  it('returns null without chatInput', () => {
    const result = setupCommandPalette({});
    expect(result).toBeNull();
  });

  it('fetches commands eagerly on setup', async () => {
    const { dom, chatInput, fetchImpl } = makeEnv();
    setupCommandPalette({ chatInput, documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl, sessionId: 'test-session' });
    // Commands are loaded eagerly
    await new Promise(r => setTimeout(r, 50));
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('shows palette when typing / and filters on subsequent input', async () => {
    const { dom, chatInput, fetchImpl } = makeEnv();
    setupCommandPalette({ chatInput, documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl, sessionId: 's1' });
    // Wait for eager load
    await new Promise(r => setTimeout(r, 50));
    // Type / to show palette
    chatInput.value = '/';
    chatInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
    // Palette is appended to body, query from document
    const palette = dom.window.document.querySelector('.pi-command-suggestions');
    expect(palette).toBeTruthy();
    // Filter by typing /com
    chatInput.value = '/com';
    chatInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));
    const items = palette.querySelectorAll('.pi-command-suggestion-item');
    // /compact matches "com"
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('/compact');
  });

  it('hides palette when input does not start with /', async () => {
    const { dom, chatInput, fetchImpl } = makeEnv();
    setupCommandPalette({ chatInput, documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl, sessionId: 's1' });
    await new Promise(r => setTimeout(r, 50));
    chatInput.value = '/';
    chatInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
    const palette = dom.window.document.querySelector('.pi-command-suggestions');
    expect(palette).toBeTruthy();
    chatInput.value = 'hello';
    chatInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(palette.style.display).toBe('none');
  });

  it('selects command on click and fills chat input', async () => {
    const { dom, chatInput, fetchImpl } = makeEnv();
    setupCommandPalette({ chatInput, documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl, sessionId: 's1' });
    await new Promise(r => setTimeout(r, 50));
    chatInput.value = '/';
    chatInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
    const item = dom.window.document.querySelector('.pi-command-suggestion-item');
    expect(item).toBeTruthy();
    // Use mousedown instead of click (palette uses mousedown to prevent blur)
    item.dispatchEvent(new dom.window.Event('mousedown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));
    expect(chatInput.value).toBe('/compact ');
  });
});