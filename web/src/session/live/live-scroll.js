export function chatComposerHeight({ documentImpl = document } = {}) {
  const composer = documentImpl.getElementById('pi-chat-composer');
  return composer ? composer.getBoundingClientRect().height : 0;
}

export function isAtBottom({ documentImpl = document, windowImpl = window, threshold = 80 } = {}) {
  const de = documentImpl.documentElement;
  const body = documentImpl.body;
  const docHeight = Math.max(de.scrollHeight, body.scrollHeight);
  const scrolled = windowImpl.scrollY || windowImpl.pageYOffset || de.scrollTop || body.scrollTop;
  const viewport = windowImpl.innerHeight;
  let remaining = docHeight - scrolled - viewport;

  const content = documentImpl.getElementById('content');
  if (content && content.scrollHeight > content.clientHeight) {
    const contentRemaining = content.scrollHeight - content.scrollTop - content.clientHeight;
    remaining = Math.max(remaining, contentRemaining);
  }

  return remaining < threshold;
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
  button.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:200;padding:6px 14px;font-size:11px;font-family:inherit;background:var(--accent);color:var(--body-bg);border:none;border-radius:4px;cursor:pointer;opacity:0;transition:opacity 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
  documentImpl.body.appendChild(button);
  requestAnimationFrameImpl(() => { button.style.opacity = '1'; });
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

export function setFollowButtonText(button, pendingCount) {
  if (button) button.textContent = '↓ ' + pendingCount + ' new' + (pendingCount > 1 ? 's' : '');
}

export function removeFollowButton(button, { windowImpl = window } = {}) {
  if (!button) return;
  button.style.opacity = '0';
  windowImpl.setTimeout(() => {
    if (button.parentNode) button.parentNode.removeChild(button);
  }, 200);
}
