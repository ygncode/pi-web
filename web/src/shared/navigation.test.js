import { describe, it, expect, vi } from 'vitest';
import { navigate, handleNavClick } from './navigation.js';

function makeWindow() {
  return { history: { pushState: vi.fn() } };
}

function makeEvent(overrides = {}) {
  return {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe('navigate', () => {
  it('pushes the url onto history', () => {
    const windowImpl = makeWindow();
    navigate('/session?id=abc', { windowImpl });
    expect(windowImpl.history.pushState).toHaveBeenCalledWith({}, '', '/session?id=abc');
  });

  it('ignores empty urls', () => {
    const windowImpl = makeWindow();
    navigate('', { windowImpl });
    expect(windowImpl.history.pushState).not.toHaveBeenCalled();
  });
});

describe('handleNavClick', () => {
  it('intercepts a plain left click and navigates', () => {
    const windowImpl = makeWindow();
    const event = makeEvent();
    handleNavClick(event, '/session?id=abc', { windowImpl });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(windowImpl.history.pushState).toHaveBeenCalledWith({}, '', '/session?id=abc');
  });

  it.each([
    ['metaKey', { metaKey: true }],
    ['ctrlKey', { ctrlKey: true }],
    ['shiftKey', { shiftKey: true }],
    ['altKey', { altKey: true }],
    ['middle click', { button: 1 }],
    ['already handled', { defaultPrevented: true }],
  ])('defers to the browser for %s', (_label, overrides) => {
    const windowImpl = makeWindow();
    const event = makeEvent(overrides);
    handleNavClick(event, '/session?id=abc', { windowImpl });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(windowImpl.history.pushState).not.toHaveBeenCalled();
  });

  it('does nothing without a url', () => {
    const windowImpl = makeWindow();
    const event = makeEvent();
    handleNavClick(event, '', { windowImpl });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(windowImpl.history.pushState).not.toHaveBeenCalled();
  });
});
