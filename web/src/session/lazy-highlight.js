// Lazily highlight code blocks that the entry renderer emitted as plain text
// with `data-highlight-pending` (so the initial paint isn't blocked on
// highlight.js). Called after the message pane renders + re-renders. Live-only.

export function applyLazyHighlighting(documentImpl) {
  import('highlight.js').then(({ default: hljs }) => {
    documentImpl.querySelectorAll('code[data-highlight-pending]').forEach((el) => {
      const lang = el.dataset.lang;
      const text = el.textContent;
      try {
        el.innerHTML = lang && hljs.getLanguage(lang)
          ? hljs.highlight(text, { language: lang }).value
          : hljs.highlightAuto(text).value;
      } catch { /* keep plain text */ }
      el.removeAttribute('data-highlight-pending');
      el.removeAttribute('data-lang');
    });
  });
}
