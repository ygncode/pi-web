import { describe, expect, it, vi } from 'vitest';
import { createSessionNavigator } from './session-navigation.js';

// The navigator is now nav-state + scroll only: <SessionContent> renders the
// message DOM reactively from the model, so these tests cover state updates and
// scrolling, not DOM building. setTimeoutImpl runs the immediate (delay 0)
// callback synchronously but defers the 2s highlight-removal timer.
const runImmediate = (fn, delay) => { if (!delay) fn(); };

describe('session navigator (nav + scroll)', () => {
  it('updates the active leaf/target and refreshes the tree', () => {
    document.body.innerHTML = '<div id="content"></div>';
    const onNavigate = vi.fn();
    const renderTree = vi.fn();
    const nav = createSessionNavigator({ onNavigate, renderTree, setTimeoutImpl: runImmediate });
    nav.navigateTo('leaf', 'none', 'target-1');
    expect(onNavigate).toHaveBeenCalledWith('leaf', 'target-1');
    expect(renderTree).toHaveBeenCalled();
  });

  it('defaults the scroll target to the leaf when none is given', () => {
    document.body.innerHTML = '<div id="content"></div>';
    const onNavigate = vi.fn();
    const nav = createSessionNavigator({ onNavigate, setTimeoutImpl: runImmediate });
    nav.navigateTo('leaf', 'none');
    expect(onNavigate).toHaveBeenCalledWith('leaf', 'leaf');
  });

  it('scrolls to the bottom in bottom mode', () => {
    document.body.innerHTML = '<div id="content"></div>';
    const content = document.getElementById('content');
    Object.defineProperty(content, 'scrollHeight', { value: 500, configurable: true });
    const nav = createSessionNavigator({ setTimeoutImpl: runImmediate });
    nav.navigateTo('leaf', 'bottom');
    expect(content.scrollTop).toBe(500);
  });

  it('scrolls a target entry into view and highlights it when requested', () => {
    document.body.innerHTML = '<div id="content"></div><div id="entry-b"></div>';
    const target = document.getElementById('entry-b');
    target.scrollIntoView = vi.fn();
    const nav = createSessionNavigator({ setTimeoutImpl: runImmediate });
    nav.navigateTo('a', 'target', 'b');
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    // Highlight is added immediately; the 2s removal timer is deferred by the fake.
    expect(target.classList.contains('highlight')).toBe(true);
  });

  it('does not scroll in none mode', () => {
    document.body.innerHTML = '<div id="content"></div><div id="entry-b"></div>';
    const target = document.getElementById('entry-b');
    target.scrollIntoView = vi.fn();
    const nav = createSessionNavigator({ setTimeoutImpl: runImmediate });
    nav.navigateTo('b', 'none');
    expect(target.scrollIntoView).not.toHaveBeenCalled();
  });
});
