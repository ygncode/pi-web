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

  it('submits on Enter everywhere and inserts a newline on Ctrl/Cmd+Enter', () => {
    const desktop = createParts();
    setupTextareaControls(desktop);
    desktop.textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(desktop.form.requestSubmit).toHaveBeenCalledTimes(1);

    const mobile = createParts();
    setupTextareaControls(mobile);
    mobile.textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(mobile.form.requestSubmit).toHaveBeenCalledTimes(1);

    const ctrl = createParts();
    setupTextareaControls(ctrl);
    ctrl.textarea.value = 'ab';
    ctrl.textarea.setSelectionRange(1, 1);
    ctrl.textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(ctrl.form.requestSubmit).not.toHaveBeenCalled();
    expect(ctrl.textarea.value).toBe('a\nb');
    expect(ctrl.textarea.selectionStart).toBe(2);

    const cmd = createParts();
    setupTextareaControls(cmd);
    cmd.textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }),
    );
    expect(cmd.form.requestSubmit).not.toHaveBeenCalled();
    expect(cmd.textarea.value).toBe('\n');
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

  it('handles thinking and model shortcuts', () => {
    const parts = createParts();
    const thinking = { cycle: vi.fn() };
    const model = { open: vi.fn() };
    setupTextareaControls({
      ...parts,
      getThinkingSelector: () => thinking,
      getModelSelector: () => model,
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

    const ctrlL = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    parts.textarea.dispatchEvent(ctrlL);
    expect(model.open).toHaveBeenCalled();
    expect(ctrlL.defaultPrevented).toBe(true);
  });
});
