export function chatComposerHeight({ documentImpl = document } = {}) {
  const composer = documentImpl.getElementById('pi-chat-composer');
  return composer ? composer.getBoundingClientRect().height : 0;
}

export function isAtBottom({ documentImpl = document, windowImpl = window, threshold = 80 } = {}) {
  const de = documentImpl.documentElement;
  const body = documentImpl.body;
  const content = documentImpl.getElementById('content');

  // If the window has scrollable height, the main window is the active scroll container (Desktop).
  // Otherwise, #content is the active scroll container (Mobile).
  const isWindowScrollable = de.scrollHeight > windowImpl.innerHeight;

  if (isWindowScrollable) {
    const docHeight = Math.max(de.scrollHeight, body.scrollHeight);
    const scrolled = windowImpl.scrollY || windowImpl.pageYOffset || de.scrollTop || body.scrollTop;
    const viewport = windowImpl.innerHeight;
    const remaining = docHeight - scrolled - viewport;
    return remaining < threshold;
  }

  if (content && content.scrollHeight > content.clientHeight) {
    const contentRemaining = content.scrollHeight - content.scrollTop - content.clientHeight;
    return contentRemaining < threshold;
  }

  // Fallback to window measurements if content is not scrollable/present
  const docHeight = Math.max(de.scrollHeight, body.scrollHeight);
  const scrolled = windowImpl.scrollY || windowImpl.pageYOffset || de.scrollTop || body.scrollTop;
  const viewport = windowImpl.innerHeight;
  return (docHeight - scrolled - viewport) < threshold;
}

export function scrollToBottom(smooth, { documentImpl = document, windowImpl = window } = {}) {
  const content = documentImpl.getElementById('content');
  if (content && content.scrollHeight > content.clientHeight) {
    content.scrollTo({ top: content.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }
  windowImpl.scrollTo({ top: Math.max(documentImpl.documentElement.scrollHeight, documentImpl.body.scrollHeight), behavior: smooth ? 'smooth' : 'auto' });
}

export function scrollElementAboveComposer(el, smooth, { documentImpl = document, windowImpl = window } = {}) {
  if (!el) {
    scrollToBottom(smooth, { documentImpl, windowImpl });
    return;
  }
  const gap = chatComposerHeight({ documentImpl }) + 24;
  const content = documentImpl.getElementById('content');
  if (content && content.contains(el)) {
    const contentRect = content.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.bottom - (contentRect.bottom - gap);
    if (delta > 0) {
      content.scrollTo({ top: content.scrollTop + delta, behavior: smooth ? 'smooth' : 'auto' });
    }
  }
  const rect = el.getBoundingClientRect();
  const viewportDelta = rect.bottom - (windowImpl.innerHeight - gap);
  if (viewportDelta > 0) {
    windowImpl.scrollTo({ top: (windowImpl.scrollY || windowImpl.pageYOffset) + viewportDelta, behavior: smooth ? 'smooth' : 'auto' });
  }
}

export function createFollowButton({ documentImpl = document, requestAnimationFrameImpl = requestAnimationFrame, onClick } = {}) {
  const button = documentImpl.createElement('button');
  button.className = 'follow-button';
  button.setAttribute('aria-label', 'Scroll to bottom');
  button.innerHTML = '<span style="font-size: 16px; font-weight: bold; line-height: 1;">↓</span>';
  documentImpl.body.appendChild(button);
  requestAnimationFrameImpl(() => { button.classList.add('visible'); });
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

export function setFollowButtonText(button, pendingCount) {
  if (button) button.innerHTML = '<span style="font-size: 16px; font-weight: bold; line-height: 1;">↓</span>';
}

export function removeFollowButton(button, { windowImpl = window } = {}) {
  if (!button) return;
  button.classList.remove('visible');
  windowImpl.setTimeout(() => {
    if (button.parentNode) button.parentNode.removeChild(button);
  }, 200);
}
