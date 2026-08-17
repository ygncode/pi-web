import { matchesAction } from '../../../shared/keybindings.js';

export function setupTextareaControls({
  windowImpl = window,
  textarea,
  shell,
  form,
  isMobileTextInputMode = () => false,
  getSlashSelector = () => null,
  getMentionSelector = () => null,
  getThinkingSelector = () => null,
  getModelSelector = () => null,
  updateSendEnabled = () => {},
  updateComposerHeight = () => {},
} = {}) {
  function autoResize() {
    if (!textarea || (shell && shell.classList.contains('expanded'))) return;
    textarea.style.height = 'auto';
    const cs = windowImpl.getComputedStyle(textarea);
    const max = parseFloat(cs.maxHeight) || 200;
    const min = parseFloat(cs.minHeight) || 48;
    const next = Math.max(min, Math.min(textarea.scrollHeight, max));
    textarea.style.height = next + 'px';
    updateComposerHeight();
  }

  const onInput = () => {
    autoResize();
    updateSendEnabled();
  };

  const onKeydown = (event) => {
    if (getSlashSelector()?.handleKeydown?.(event)) return;
    if (getMentionSelector()?.handleKeydown?.(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      if (isMobileTextInputMode()) return;
      event.preventDefault();
      form?.requestSubmit?.();
    }
    if (matchesAction('cycle-thinking-level', event)) {
      event.preventDefault();
      getThinkingSelector()?.cycle?.();
    }
    if (matchesAction('open-model-selector', event)) {
      event.preventDefault();
      getModelSelector()?.open?.();
    }
  };

  if (textarea) {
    textarea.addEventListener('input', onInput);
    textarea.addEventListener('keydown', onKeydown);
    autoResize();
  }
  updateSendEnabled();

  return {
    autoResize,
    dispose: () => {
      textarea?.removeEventListener('input', onInput);
      textarea?.removeEventListener('keydown', onKeydown);
    },
  };
}
