import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createFollowButton, removeFollowButton, scrollToBottom, setFollowButtonText } from './live-scroll.js';

describe('live scroll helpers', () => {
  it('creates, labels, and removes follow button', () => {
    const dom = new JSDOM('<body></body>');
    const btn = createFollowButton({ documentImpl: dom.window.document, requestAnimationFrameImpl: (cb) => cb() });
    setFollowButtonText(btn, 2);
    expect(btn.textContent).toBe('↓ 2 news');
    expect(dom.window.document.body.contains(btn)).toBe(true);
    removeFollowButton(btn, { windowImpl: { setTimeout: (cb) => cb() } });
    expect(dom.window.document.body.contains(btn)).toBe(false);
  });

  it('scrolls window to bottom', () => {
    const dom = new JSDOM('<body><main id="content"></main></body>');
    const scrollTo = vi.fn();
    Object.defineProperty(dom.window.document.documentElement, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(dom.window.document.body, 'scrollHeight', { value: 1200, configurable: true });
    scrollToBottom(true, { documentImpl: dom.window.document, windowImpl: { scrollTo } });
    expect(scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'smooth' });
  });
});
