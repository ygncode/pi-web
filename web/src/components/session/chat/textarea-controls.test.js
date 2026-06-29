import { describe, expect, it, vi } from 'vitest';
import { setupTextareaControls } from './textarea-controls.js';

function createParts() {
  const textarea = document.createElement('textarea');
  const shell = document.createElement('div');
  const form = document.createElement('form');
  form.requestSubmit = vi.fn();
  Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 120 });
  return { textarea, shell, form };
}

describe('setupTextareaControls', () => {
  it('auto-resizes and updates send state on input', () => {
    const parts = createParts();
    const updateSendEnabled = vi.fn();
    const updateComposerHeight = vi.fn();
    setupTextareaControls({
      ...parts,
      updateSendEnabled,
      updateComposerHeight,
      windowImpl: {
        getComputedStyle: () => ({ maxHeight: '200px', minHeight: '48px' }),
      },
    });

    parts.textarea.dispatchEvent(new Event('input'));

    expect(parts.textarea.style.height).toBe('120px');
    expect(updateSendEnabled).toHaveBeenCalled();
    expect(updateComposerHeight).toHaveBeenCalled();
  });

  it('submits on desktop Enter but not mobile Enter', () => {
    const desktop = createParts();
    setupTextareaControls({ ...desktop, isMobileTextInputMode: () => false });
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    desktop.textarea.dispatchEvent(enter);
    expect(desktop.form.requestSubmit).toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(true);

    const mobile = createParts();
    setupTextareaControls({ ...mobile, isMobileTextInputMode: () => true });
    const mobileEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    mobile.textarea.dispatchEvent(mobileEnter);
    expect(mobile.form.requestSubmit).not.toHaveBeenCalled();
    expect(mobileEnter.defaultPrevented).toBe(false);
  });

  it('delegates palette keys before submit handling', () => {
    const parts = createParts();
    const slash = { handleKeydown: vi.fn(() => true) };
    setupTextareaControls({ ...parts, getSlashSelector: () => slash });

    parts.textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    expect(slash.handleKeydown).toHaveBeenCalled();
    expect(parts.form.requestSubmit).not.toHaveBeenCalled();
  });

  it('handles thinking, model, and compact shortcuts', () => {
    const parts = createParts();
    const thinking = { cycle: vi.fn() };
    const model = { open: vi.fn() };
    const compact = { trigger: vi.fn() };
    setupTextareaControls({
      ...parts,
      getThinkingSelector: () => thinking,
      getModelSelector: () => model,
      getCompact: () => compact,
    });

    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    parts.textarea.dispatchEvent(tab);
    expect(thinking.cycle).toHaveBeenCalled();
    expect(tab.defaultPrevented).toBe(true);

    // Ctrl+I opens the model selector.
    const ctrlI = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    parts.textarea.dispatchEvent(ctrlI);
    expect(model.open).toHaveBeenCalled();
    expect(ctrlI.defaultPrevented).toBe(true);

    // Cmd/Ctrl+L triggers compaction (not the model selector).
    const ctrlL = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    parts.textarea.dispatchEvent(ctrlL);
    expect(compact.trigger).toHaveBeenCalled();
    expect(ctrlL.defaultPrevented).toBe(true);
    expect(model.open).toHaveBeenCalledTimes(1); // Ctrl+L did not also open the model selector
  });
});
