// Navigation + scroll only. The message pane (#messages) is rendered reactively
// by the Svelte <SessionContent> component from the shared SessionDataModel, so
// the navigator no longer builds DOM, caches nodes, or wires per-entry buttons.
// It just moves the active leaf/target (which the reactive model reads to
// recompute the path) and scrolls to the requested entry once Svelte has
// flushed. Copy/fork/label buttons are handled by a single delegated click
// listener in session.js. See docs/dev/svelte-migration-plan.md (sub-step B).
export function createSessionNavigator({
  documentImpl = document,
  renderTree = () => {},
  onNavigate = () => {},
  setTimeoutImpl = (fn, delay = 0) => setTimeout(fn, delay),
} = {}) {
  function navigateTo(targetId, scrollMode = 'target', scrollToEntryId = null) {
    // Updating the model's active leaf/target re-derives the path; <SessionContent>
    // re-renders #messages reactively. renderTree keeps the sidebar view state in
    // sync (filter/active highlight).
    onNavigate(targetId, scrollToEntryId || targetId);
    renderTree();

    // Scroll after Svelte flushes the reactive render (microtask) so the target
    // entry element exists. A macrotask (setTimeout 0) runs after that flush.
    setTimeoutImpl(() => {
      const content = documentImpl.getElementById('content');
      if (!content) return;
      if (scrollMode === 'bottom') {
        content.scrollTop = content.scrollHeight;
      } else if (scrollMode === 'target') {
        const scrollTargetId = scrollToEntryId || targetId;
        const targetEl = documentImpl.getElementById(`entry-${scrollTargetId}`);
        if (targetEl) {
          targetEl.scrollIntoView?.({ block: 'center' });
          if (scrollToEntryId) {
            targetEl.classList.add('highlight');
            setTimeoutImpl(() => targetEl.classList.remove('highlight'), 2000);
          }
        }
      }
      // scrollMode === 'none' → leave the scroll position untouched.
    });
  }

  return { navigateTo };
}
