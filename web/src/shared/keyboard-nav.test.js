import { describe, expect, it, vi } from 'vitest';
import { isComposerPopupOpen, isEditableTarget, setupKeyboardNav } from './keyboard-nav.js';

describe('isEditableTarget', () => {
  it('returns false for null/undefined', () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });

  it('returns true for INPUT', () => {
    const el = { tagName: 'INPUT' };
    expect(isEditableTarget(el)).toBe(true);
  });

  it('returns true for TEXTAREA', () => {
    const el = { tagName: 'TEXTAREA' };
    expect(isEditableTarget(el)).toBe(true);
  });

  it('returns true for SELECT', () => {
    const el = { tagName: 'SELECT' };
    expect(isEditableTarget(el)).toBe(true);
  });

  it('returns false for BUTTON', () => {
    const el = { tagName: 'BUTTON' };
    expect(isEditableTarget(el)).toBe(false);
  });

  it('returns false for DIV', () => {
    const el = { tagName: 'DIV' };
    expect(isEditableTarget(el)).toBe(false);
  });

  it('returns true for contentEditable elements', () => {
    const el = { tagName: 'DIV', isContentEditable: true };
    expect(isEditableTarget(el)).toBe(true);
  });

  it('returns true when inside a contenteditable ancestor', () => {
    const parent = document.createElement('div');
    parent.setAttribute('contenteditable', 'true');
    const child = document.createElement('span');
    parent.appendChild(child);
    expect(isEditableTarget(child)).toBe(true);
  });
});

describe('isComposerPopupOpen', () => {
  it('is true when a composer popup has a non-none display', () => {
    const doc = { querySelectorAll: () => [{ style: { display: 'block' } }] };
    expect(isComposerPopupOpen(doc)).toBe(true);
  });

  it('is false when popups are hidden or absent', () => {
    expect(isComposerPopupOpen({ querySelectorAll: () => [{ style: { display: 'none' } }] })).toBe(false);
    expect(isComposerPopupOpen({ querySelectorAll: () => [{ style: { display: '' } }] })).toBe(false);
    expect(isComposerPopupOpen({ querySelectorAll: () => [] })).toBe(false);
    expect(isComposerPopupOpen({})).toBe(false);
  });
});

describe('setupKeyboardNav', () => {
  function createMockWindow() {
    return {
      scrollBy: vi.fn(),
      scrollTo: vi.fn(),
      history: { pushState: vi.fn() },
    };
  }

  function createMockDocument(activeElement = null, queryResult = null, contentElement = null) {
    const listeners = [];
    const doc = {
      activeElement,
      documentElement: { scrollHeight: 5000 },
      querySelector: vi.fn(() => queryResult),
      getElementById: vi.fn((id) => {
        if (id === 'content') return contentElement;
        return null;
      }),
      addEventListener(type, handler, options) {
        listeners.push({ type, handler, options });
      },
      _dispatch(type, init) {
        const e = {
          key: init.key || '',
          metaKey: init.metaKey || false,
          ctrlKey: init.ctrlKey || false,
          altKey: init.altKey || false,
          shiftKey: init.shiftKey || false,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          stopImmediatePropagation: vi.fn(),
        };
        for (const l of listeners) {
          if (l.type === type) l.handler(e);
        }
        return e;
      },
    };
    return doc;
  }

  function createFakeTimers() {
    let pending = null;
    return {
      setTimeout: (fn, ms) => { pending = fn; return 1; },
      clearTimeout: () => { pending = null; },
      firePending() { if (pending) { const fn = pending; pending = null; fn(); } },
    };
  }

  it('blurs active editable element on Escape (capture phase)', () => {
    const blur = vi.fn();
    const active = { tagName: 'INPUT', blur };
    const doc = createMockDocument(active);
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    const e = doc._dispatch('keydown', { key: 'Escape' });

    expect(blur).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
  });

  it('does not blur (lets Escape bubble) when a composer popup is open', () => {
    const blur = vi.fn();
    const active = { tagName: 'TEXTAREA', blur };
    const doc = createMockDocument(active);
    // A visible @mention popup means the composer owns Escape.
    doc.querySelectorAll = vi.fn(() => [{ style: { display: 'block' } }]);
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    const e = doc._dispatch('keydown', { key: 'Escape' });

    expect(blur).not.toHaveBeenCalled();
    expect(e.stopPropagation).not.toHaveBeenCalled();
  });

  it('still blurs when the composer popup is hidden', () => {
    const blur = vi.fn();
    const active = { tagName: 'TEXTAREA', blur };
    const doc = createMockDocument(active);
    doc.querySelectorAll = vi.fn(() => [{ style: { display: 'none' } }]);
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'Escape' });

    expect(blur).toHaveBeenCalled();
  });

  it('does not blur non-editable element on Escape', () => {
    const blur = vi.fn();
    const active = { tagName: 'DIV', blur };
    const doc = createMockDocument(active);
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    const e = doc._dispatch('keydown', { key: 'Escape' });

    expect(blur).not.toHaveBeenCalled();
  });

  it('registers Escape handler in capture phase', () => {
    const doc = createMockDocument();
    const calls = [];
    const orig = doc.addEventListener;
    doc.addEventListener = (type, handler, options) => {
      calls.push({ type, options });
      orig(type, handler, options);
    };

    setupKeyboardNav({ windowImpl: createMockWindow(), documentImpl: doc });
    const escapeCall = calls.find(c => c.type === 'keydown' && c.options?.capture);
    expect(escapeCall).toBeTruthy();
  });

  it('navigates to /settings on Cmd+, (and Ctrl+,)', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });

    const e1 = doc._dispatch('keydown', { key: ',', metaKey: true });
    expect(win.history.pushState).toHaveBeenCalledWith({}, '', '/settings');
    expect(e1.preventDefault).toHaveBeenCalled();

    win.history.pushState.mockClear();
    doc._dispatch('keydown', { key: ',', ctrlKey: true });
    expect(win.history.pushState).toHaveBeenCalledWith({}, '', '/settings');
  });

  it('does not navigate to /settings on Cmd+Shift+,', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: ',', metaKey: true, shiftKey: true });

    expect(win.history.pushState).not.toHaveBeenCalled();
  });

  it('scrolls down on j', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'j' });

    expect(win.scrollBy).toHaveBeenCalledWith({ top: 300, behavior: 'instant' });
  });

  it('scrolls up on k', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'k' });

    expect(win.scrollBy).toHaveBeenCalledWith({ top: -300, behavior: 'instant' });
  });

  it('scrolls to top on double-tap gg', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'g' });
    doc._dispatch('keydown', { key: 'g' });

    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('does not scroll to top on single g', () => {
    const doc = createMockDocument();
    const win = createMockWindow();
    const timers = createFakeTimers();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc, setTimeoutImpl: timers.setTimeout, clearTimeoutImpl: timers.clearTimeout });
    doc._dispatch('keydown', { key: 'g' });

    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it('resets gg after timeout', () => {
    const doc = createMockDocument();
    const win = createMockWindow();
    const timers = createFakeTimers();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc, setTimeoutImpl: timers.setTimeout, clearTimeoutImpl: timers.clearTimeout });

    // First g press
    doc._dispatch('keydown', { key: 'g' });
    expect(win.scrollTo).not.toHaveBeenCalled();

    // Timeout fires
    timers.firePending();

    // Second g press after timeout — should be treated as new first press
    doc._dispatch('keydown', { key: 'g' });
    expect(win.scrollTo).not.toHaveBeenCalled();

    // Quick second g — now it should scroll
    doc._dispatch('keydown', { key: 'g' });
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('scrolls to bottom on G (shift+g)', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'G' });

    expect(win.scrollTo).toHaveBeenCalledWith({
      top: 5000,
      behavior: 'instant',
    });
  });

  it('does not scroll j/k/G/I when editable element is focused', () => {
    const active = { tagName: 'INPUT' };
    const doc = createMockDocument(active);
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'j' });
    doc._dispatch('keydown', { key: 'k' });
    doc._dispatch('keydown', { key: 'G' });
    doc._dispatch('keydown', { key: 'I' });

    expect(win.scrollBy).not.toHaveBeenCalled();
    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it('does not scroll j/k/G/I when meta key is held', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'j', metaKey: true });
    doc._dispatch('keydown', { key: 'k', ctrlKey: true });
    doc._dispatch('keydown', { key: 'G', ctrlKey: true });
    doc._dispatch('keydown', { key: 'I', ctrlKey: true });

    expect(win.scrollBy).not.toHaveBeenCalled();
    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it('does not scroll j/k/G/I when alt key is held', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'j', altKey: true });
    doc._dispatch('keydown', { key: 'k', altKey: true });
    doc._dispatch('keydown', { key: 'G', altKey: true });
    doc._dispatch('keydown', { key: 'I', altKey: true });

    expect(win.scrollBy).not.toHaveBeenCalled();
    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it('does not scroll on other keys', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'a' });
    doc._dispatch('keydown', { key: 'Enter' });

    expect(win.scrollBy).not.toHaveBeenCalled();
    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it('scroll preventDefaults on j/k/g/G/I', () => {
    const doc = createMockDocument();
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    const e1 = doc._dispatch('keydown', { key: 'j' });
    const e2 = doc._dispatch('keydown', { key: 'k' });
    const e3 = doc._dispatch('keydown', { key: 'g' });
    const e4 = doc._dispatch('keydown', { key: 'G' });
    const e5 = doc._dispatch('keydown', { key: 'I' });

    expect(e1.preventDefault).toHaveBeenCalled();
    expect(e2.preventDefault).toHaveBeenCalled();
    expect(e3.preventDefault).toHaveBeenCalled();
    expect(e4.preventDefault).toHaveBeenCalled();
    expect(e5.preventDefault).toHaveBeenCalled();
  });

  it('focuses element on I (shift+i)', () => {
    const focus = vi.fn();
    const el = { focus };
    const doc = createMockDocument(null, el);
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc });
    doc._dispatch('keydown', { key: 'I' });

    expect(doc.querySelector).toHaveBeenCalledWith('#pi-chat-message');
    expect(focus).toHaveBeenCalled();
  });

  it('uses custom focusSelector', () => {
    const focus = vi.fn();
    const el = { focus };
    const doc = createMockDocument(null, el);
    const win = createMockWindow();

    setupKeyboardNav({ windowImpl: win, documentImpl: doc, focusSelector: '#search' });
    doc._dispatch('keydown', { key: 'I' });

    expect(doc.querySelector).toHaveBeenCalledWith('#search');
    expect(focus).toHaveBeenCalled();
  });

  describe('when #content is present', () => {
    function createMockContent() {
      return {
        scrollBy: vi.fn(),
        scrollTo: vi.fn(),
        scrollHeight: 8000,
      };
    }

    it('scrolls down #content on j', () => {
      const content = createMockContent();
      const doc = createMockDocument(null, null, content);
      const win = createMockWindow();

      setupKeyboardNav({ windowImpl: win, documentImpl: doc });
      doc._dispatch('keydown', { key: 'j' });

      expect(content.scrollBy).toHaveBeenCalledWith({ top: 300, behavior: 'instant' });
      expect(win.scrollBy).not.toHaveBeenCalled();
    });

    it('scrolls up #content on k', () => {
      const content = createMockContent();
      const doc = createMockDocument(null, null, content);
      const win = createMockWindow();

      setupKeyboardNav({ windowImpl: win, documentImpl: doc });
      doc._dispatch('keydown', { key: 'k' });

      expect(content.scrollBy).toHaveBeenCalledWith({ top: -300, behavior: 'instant' });
      expect(win.scrollBy).not.toHaveBeenCalled();
    });

    it('scrolls #content to top on double-tap gg', () => {
      const content = createMockContent();
      const doc = createMockDocument(null, null, content);
      const win = createMockWindow();

      setupKeyboardNav({ windowImpl: win, documentImpl: doc });
      doc._dispatch('keydown', { key: 'g' });
      doc._dispatch('keydown', { key: 'g' });

      expect(content.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
      expect(win.scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls #content to bottom on G', () => {
      const content = createMockContent();
      const doc = createMockDocument(null, null, content);
      const win = createMockWindow();

      setupKeyboardNav({ windowImpl: win, documentImpl: doc });
      doc._dispatch('keydown', { key: 'G' });

      expect(content.scrollTo).toHaveBeenCalledWith({ top: 8000, behavior: 'instant' });
      expect(win.scrollTo).not.toHaveBeenCalled();
    });
  });
});
