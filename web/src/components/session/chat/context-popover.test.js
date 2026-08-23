import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupContextPopover } from './context-popover.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function renderDom() {
  document.body.innerHTML = `
    <div class="pi-chat-shell">
      <button id="pi-chat-context-usage">usage</button>
      <div id="pi-chat-context-popover" style="display:none">
        <button class="pi-popover-close"></button>
        <button id="pi-context-compact"></button>
        <div class="pi-popover-arrow"></div>
      </div>
    </div>
  `;
  const shell = document.querySelector('.pi-chat-shell');
  const usage = document.getElementById('pi-chat-context-usage');
  shell.getBoundingClientRect = () => ({
    left: 10,
    right: 310,
    top: 0,
    bottom: 400,
    width: 300,
    height: 400,
  });
  usage.getBoundingClientRect = () => ({
    left: 150,
    right: 170,
    top: 300,
    bottom: 320,
    width: 20,
    height: 20,
  });
}

describe('setupContextPopover', () => {
  it('toggles the popover and refreshes context usage before positioning', () => {
    renderDom();
    const updateContextUsage = vi.fn();
    setupContextPopover({ documentImpl: document, windowImpl: window, updateContextUsage });

    document.getElementById('pi-chat-context-usage').click();

    const popover = document.getElementById('pi-chat-context-popover');
    expect(popover.style.display).toBe('block');
    expect(updateContextUsage).toHaveBeenCalledTimes(1);
    expect(popover.style.left).toBe('50px');
    expect(popover.style.bottom).toBe('108px');
    expect(popover.querySelector('.pi-popover-arrow').style.left).toBe('100px');

    document.getElementById('pi-chat-context-usage').click();
    expect(popover.style.display).toBe('none');
  });

  it('closes from the close button and outside clicks', () => {
    renderDom();
    setupContextPopover({ documentImpl: document, windowImpl: window });
    const popover = document.getElementById('pi-chat-context-popover');
    document.getElementById('pi-chat-context-usage').click();

    popover.querySelector('.pi-popover-close').click();
    expect(popover.style.display).toBe('none');

    document.getElementById('pi-chat-context-usage').click();
    document.body.click();
    expect(popover.style.display).toBe('none');
  });

  it('runs compaction once and closes after success', async () => {
    renderDom();
    const onCompact = vi.fn(() => Promise.resolve(true));
    setupContextPopover({ documentImpl: document, windowImpl: window, onCompact });
    const popover = document.getElementById('pi-chat-context-popover');
    const button = document.getElementById('pi-context-compact');
    document.getElementById('pi-chat-context-usage').click();

    button.click();
    expect(button.disabled).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onCompact).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
    expect(popover.style.display).toBe('none');
  });

  it('keeps the popover open when compaction fails', async () => {
    renderDom();
    setupContextPopover({
      documentImpl: document,
      windowImpl: window,
      onCompact: () => Promise.resolve(false),
    });
    const popover = document.getElementById('pi-chat-context-popover');
    document.getElementById('pi-chat-context-usage').click();

    document.getElementById('pi-context-compact').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(popover.style.display).toBe('block');
  });

  it('repositions while visible on resize', () => {
    renderDom();
    setupContextPopover({ documentImpl: document, windowImpl: window });
    const popover = document.getElementById('pi-chat-context-popover');
    document.getElementById('pi-chat-context-usage').click();
    popover.style.left = '0px';

    window.dispatchEvent(new Event('resize'));

    expect(popover.style.left).toBe('50px');
  });
});
