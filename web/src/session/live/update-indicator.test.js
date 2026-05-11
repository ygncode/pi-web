import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { closeSidebarForUpdateIndicator, showUpdateIndicator } from './update-indicator.js';

describe('update indicator', () => {
  it('closes sidebar classes', () => {
    const dom = new JSDOM('<body class="sidebar-open"><aside id="sidebar" class="open"></aside><div id="sidebar-overlay" class="open"></div><button id="hamburger" style="display:none"></button></body>');
    closeSidebarForUpdateIndicator({ documentImpl: dom.window.document });
    expect(dom.window.document.body.classList.contains('sidebar-open')).toBe(false);
    expect(dom.window.document.getElementById('sidebar').classList.contains('open')).toBe(false);
    expect(dom.window.document.getElementById('hamburger').style.display).toBe('');
  });

  it('shows, clicks, and removes indicator', () => {
    const dom = new JSDOM('<body></body>');
    const state = { indicator: null };
    const closeSidebar = vi.fn();
    const scrollToBottom = vi.fn();
    const indicator = showUpdateIndicator(state, {
      documentImpl: dom.window.document,
      requestAnimationFrameImpl: (cb) => cb(),
      setTimeoutImpl: (cb) => cb(),
      closeSidebar,
      scrollToBottom
    });
    expect(indicator.textContent).toBe('updated - tap to view');
    indicator.click();
    expect(closeSidebar).toHaveBeenCalled();
    expect(scrollToBottom).toHaveBeenCalledWith(true);
    expect(state.indicator).toBe(null);
  });
});
