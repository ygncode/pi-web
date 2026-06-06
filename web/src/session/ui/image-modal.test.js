import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupImageModal } from './image-modal.js';

describe('image modal', () => {
  it('no-ops when the modal element is absent', () => {
    const dom = new JSDOM('<body></body>');
    expect(() => setupImageModal({ documentImpl: dom.window.document })).not.toThrow();
  });

  it('opens on a transcript image click and closes on overlay click', () => {
    const dom = new JSDOM(
      '<body><img class="message-image" src="data:image/png;base64,AAA" alt="shot">'
      + '<div id="image-modal"><img id="modal-image" src="" alt=""></div></body>'
    );
    const doc = dom.window.document;
    setupImageModal({ documentImpl: doc });
    const modal = doc.getElementById('image-modal');
    const modalImg = doc.getElementById('modal-image');

    doc.querySelector('.message-image').click();
    expect(modal.classList.contains('open')).toBe(true);
    expect(modalImg.getAttribute('src')).toBe('data:image/png;base64,AAA');
    expect(modalImg.alt).toBe('shot');

    modal.click(); // backdrop / overlay dismiss
    expect(modal.classList.contains('open')).toBe(false);
    expect(modalImg.hasAttribute('src')).toBe(false);
  });

  it('opens for a composer image preview and closes on Escape', () => {
    const dom = new JSDOM(
      '<body><img class="pi-chat-attachment-preview" src="data:image/png;base64,BBB">'
      + '<div id="image-modal"><img id="modal-image"></div></body>'
    );
    const doc = dom.window.document;
    setupImageModal({ documentImpl: doc });
    const modal = doc.getElementById('image-modal');

    doc.querySelector('.pi-chat-attachment-preview').click();
    expect(modal.classList.contains('open')).toBe(true);

    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal.classList.contains('open')).toBe(false);
  });
});
