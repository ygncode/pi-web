import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupShareButton, showShareError, showShareResult } from './share-overlay.js';

describe('share overlay', () => {
  it('renders share result and copy buttons', () => {
    const dom = new JSDOM('<body></body>');
    const state = { shareOverlay: null };
    const navigatorImpl = { clipboard: { writeText: vi.fn(() => Promise.resolve()) } };
    showShareResult('gist', 'preview', state, { documentImpl: dom.window.document, escapeHtml: (x) => x, navigatorImpl });
    expect(dom.window.document.querySelector('h3').textContent).toBe('Session Shared');
    dom.window.document.getElementById('share-copy-gist').click();
    expect(navigatorImpl.clipboard.writeText).toHaveBeenCalledWith('gist');
    dom.window.document.getElementById('share-close').click();
    expect(state.shareOverlay).toBe(null);
  });

  it('renders share error', () => {
    const dom = new JSDOM('<body></body>');
    const state = { shareOverlay: null };
    showShareError('bad', state, { documentImpl: dom.window.document, escapeHtml: (x) => x });
    expect(dom.window.document.querySelector('h3').textContent).toBe('Share Failed');
    expect(dom.window.document.querySelector('p').textContent).toBe('bad');
  });

  it('sets up share button request flow', async () => {
    const dom = new JSDOM('<body><button id="share-btn">↗ Share</button></body>');
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ gistUrl: 'g', previewUrl: 'p' }), { status: 200 })));
    const state = { shareOverlay: null };
    setupShareButton({ documentImpl: dom.window.document, fetchImpl, sessionId: 's id', state, escapeHtml: (x) => x, navigatorImpl: {} });
    dom.window.document.getElementById('share-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchImpl).toHaveBeenCalledWith('/share?id=s%20id', { method: 'POST' });
    expect(dom.window.document.querySelector('h3').textContent).toBe('Session Shared');
  });
});
