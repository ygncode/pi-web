/**
 * image-modal.js — click-to-zoom for inline images.
 *
 * Wires the page-level #image-modal overlay: clicking a transcript image
 * (.message-image) or a composer image attachment (.pi-chat-attachment-preview)
 * opens it full-size; clicking the overlay or pressing Escape closes it.
 *
 * DI-pure and side-effect-free on import so the static export bundle can reuse
 * it for transcript images (no live/SSE/chat deps).
 */

const ZOOMABLE_SELECTOR = '.message-image, .pi-chat-attachment-preview';

export function setupImageModal({ documentImpl = document } = {}) {
  const modal = documentImpl.getElementById('image-modal');
  const img = modal ? modal.querySelector('#modal-image') : null;
  if (!modal || !img) return { open() {}, close() {}, destroy() {} };

  function open(src, alt) {
    if (!src) return;
    img.src = src;
    img.alt = alt || '';
    modal.classList.add('open');
  }

  function close() {
    modal.classList.remove('open');
    img.removeAttribute('src');
  }

  function onClick(e) {
    const zoomable = e.target.closest?.(ZOOMABLE_SELECTOR);
    if (zoomable && zoomable !== img) {
      open(zoomable.currentSrc || zoomable.src, zoomable.alt);
      return;
    }
    // Click anywhere on the open overlay (backdrop or the image) dismisses it.
    if (modal.classList.contains('open') && (e.target === modal || e.target === img)) {
      close();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  }

  documentImpl.addEventListener('click', onClick);
  documentImpl.addEventListener('keydown', onKeyDown);

  return {
    open,
    close,
    destroy() {
      documentImpl.removeEventListener('click', onClick);
      documentImpl.removeEventListener('keydown', onKeyDown);
    },
  };
}
