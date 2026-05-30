import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createFollowButton, removeFollowButton, scrollToBottom, setFollowButtonText, isAtBottom } from './live-scroll.js';

describe('live scroll helpers', () => {
  it('creates, labels, and removes follow button', () => {
    const dom = new JSDOM('<body><main id="content"></main></body>');
    const btn = createFollowButton({ documentImpl: dom.window.document, requestAnimationFrameImpl: (cb) => cb() });
    setFollowButtonText(btn, 2);
    expect(btn.textContent).toBe('↓');
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

  it('detects isAtBottom for window scroll and content scroll', () => {
    // Scenario 1: Window scrollable (Desktop)
    const domWindow = new JSDOM('<body><main id="content"></main></body>');
    const docWindow = domWindow.window.document;
    Object.defineProperty(docWindow.documentElement, 'scrollHeight', { value: 2000, configurable: true });
    Object.defineProperty(docWindow.body, 'scrollHeight', { value: 2000, configurable: true });
    
    // Scrolled to bottom
    const winAtBottom = {
      scrollY: 1000,
      innerHeight: 1000
    };
    expect(isAtBottom({ documentImpl: docWindow, windowImpl: winAtBottom, threshold: 80 })).toBe(true);
    
    // Scrolled up
    const winScrolledUp = {
      scrollY: 500,
      innerHeight: 1000
    };
    expect(isAtBottom({ documentImpl: docWindow, windowImpl: winScrolledUp, threshold: 80 })).toBe(false);
    
    // Scenario 2: Content scrollable (Mobile)
    const domContent = new JSDOM('<body><main id="content"></main></body>');
    const docContent = domContent.window.document;
    const contentEl = docContent.getElementById('content');
    Object.defineProperty(docContent.documentElement, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(docContent.body, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(contentEl, 'scrollHeight', { value: 5000, configurable: true });
    Object.defineProperty(contentEl, 'clientHeight', { value: 800, configurable: true });
    
    const winMobile = {
      scrollY: 0,
      innerHeight: 1000
    };
    
    // Content scrolled to bottom
    contentEl.scrollTop = 4200;
    expect(isAtBottom({ documentImpl: docContent, windowImpl: winMobile, threshold: 80 })).toBe(true);
    
    // Content scrolled up
    contentEl.scrollTop = 1000;
    expect(isAtBottom({ documentImpl: docContent, windowImpl: winMobile, threshold: 80 })).toBe(false);
  });
});
