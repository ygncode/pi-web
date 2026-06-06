import { describe, expect, it, vi } from 'vitest';
import { createSessionNavigator } from './session-navigation.js';

describe('session navigator', () => {
  it('renders header and path messages and wires copy and label buttons', () => {
    document.body.innerHTML = '<div id="header-container"></div><div id="messages"></div><div id="content"></div>';
    const copyToClipboard = vi.fn();
    const attachHeaderHandlers = vi.fn();
    const renderTree = vi.fn();
    const onLabel = vi.fn();
    const nav = createSessionNavigator({
      getPath: () => [{ id: 'a' }, { id: 'b' }],
      renderTree,
      renderHeader: () => '<h1>Header</h1>',
      attachHeaderHandlers,
      renderEntry: (entry) => `<div id="entry-${entry.id}"><button class="copy-link-btn" data-entry-id="${entry.id}">copy</button><button class="label-btn" data-entry-id="${entry.id}">label</button></div>`,
      buildShareUrl: (id) => `share:${id}`,
      copyToClipboard,
      applyToggleStateToNode: vi.fn(),
      onLabel
    });
    nav.navigateTo('b', 'none');
    expect(renderTree).toHaveBeenCalled();
    expect(attachHeaderHandlers).toHaveBeenCalled();
    expect(document.querySelectorAll('#messages > div')).toHaveLength(2);
    document.querySelector('.copy-link-btn[data-entry-id="a"]').click();
    expect(copyToClipboard).toHaveBeenCalledWith('share:a', expect.any(HTMLButtonElement));
    document.querySelector('.label-btn[data-entry-id="b"]').click();
    expect(onLabel).toHaveBeenCalledWith('b', expect.any(HTMLButtonElement));
  });

  it('caches rendered entries as cloned nodes', () => {
    document.body.innerHTML = '<div id="header-container"></div><div id="messages"></div><div id="content"></div>';
    const renderEntry = vi.fn((entry) => `<div id="entry-${entry.id}">${entry.id}</div>`);
    const nav = createSessionNavigator({
      getPath: () => [{ id: 'a' }], renderTree: vi.fn(), renderHeader: () => '', renderEntry,
      buildShareUrl: vi.fn(), copyToClipboard: vi.fn(), applyToggleStateToNode: vi.fn()
    });
    nav.navigateTo('a', 'none');
    nav.navigateTo('a', 'none');
    expect(renderEntry).toHaveBeenCalledTimes(1);
  });
});
