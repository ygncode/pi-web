import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildShareUrl, copyToClipboard } from './session-entry-actions.js';

function dom(url = 'https://example.test/session?id=s') {
  return new JSDOM('<body></body>', { url });
}

describe('session-entry-actions', () => {
  it('builds share urls with the current leaf id + target', () => {
    const { window } = dom();
    const url = buildShareUrl('target', {
      documentImpl: window.document,
      windowImpl: window,
      getCurrentLeafId: () => 'leaf',
      URLImpl: window.URL,
    });
    expect(url).toContain('leafId=leaf');
    expect(url).toContain('targetId=target');
  });

  it('preserves the session id query param in the share url', () => {
    const { window } = dom();
    const url = buildShareUrl('target', {
      documentImpl: window.document,
      windowImpl: window,
      getCurrentLeafId: () => 'leaf',
      URLImpl: window.URL,
    });
    expect(url).toContain('id=s');
    expect(url).toContain('leafId=leaf');
    expect(url).toContain('targetId=target');
  });

  it('copies with clipboard feedback', async () => {
    const { window } = dom('https://example.test/');
    window.document.body.innerHTML = '<button>copy</button>';
    const writeText = vi.fn(() => Promise.resolve());
    const button = window.document.querySelector('button');
    await copyToClipboard('x', button, {
      documentImpl: window.document,
      navigatorImpl: { clipboard: { writeText } },
    });
    expect(writeText).toHaveBeenCalledWith('x');
    expect(button.classList.contains('copied')).toBe(true);
  });
});
