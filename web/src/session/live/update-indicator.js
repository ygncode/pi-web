export function closeSidebarForUpdateIndicator({ documentImpl = document } = {}) {
  documentImpl.getElementById('sidebar')?.classList.remove('open');
  documentImpl.getElementById('sidebar-overlay')?.classList.remove('open');
  documentImpl.body.classList.remove('sidebar-open');
  const hamburger = documentImpl.getElementById('hamburger');
  if (hamburger) hamburger.style.display = '';
}

export function showUpdateIndicator(state, {
  documentImpl = document,
  requestAnimationFrameImpl = requestAnimationFrame,
  setTimeoutImpl = setTimeout,
  closeSidebar = () => closeSidebarForUpdateIndicator({ documentImpl }),
  scrollToBottom = () => {}
} = {}) {
  if (state.indicator) return state.indicator;
  const indicator = documentImpl.createElement('div');
  state.indicator = indicator;
  indicator.textContent = 'updated - tap to view';
  indicator.style.cssText = 'position:fixed;top:8px;right:8px;z-index:200;padding:2px 8px;font-size:10px;font-family:inherit;background:var(--accent);color:var(--body-bg);border-radius:3px;opacity:0;transition:opacity 0.3s;cursor:pointer;';
  indicator.addEventListener('click', () => {
    closeSidebar();
    scrollToBottom(true);
  });
  documentImpl.body.appendChild(indicator);
  requestAnimationFrameImpl(() => { indicator.style.opacity = '1'; });
  setTimeoutImpl(() => {
    indicator.style.opacity = '0';
    setTimeoutImpl(() => {
      if (state.indicator && state.indicator.parentNode) state.indicator.parentNode.removeChild(state.indicator);
      state.indicator = null;
    }, 300);
  }, 1200);
  return indicator;
}
