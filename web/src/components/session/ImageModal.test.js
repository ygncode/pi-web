import { afterEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup } from '@testing-library/svelte';
import ImageModal from './ImageModal.svelte';

afterEach(cleanup);

// The component installs document-level delegated listeners, so the "zoomable"
// images live outside the component (as they do in the real transcript/composer).
function addImage(className, srcValue, altValue = '') {
  const img = document.createElement('img');
  img.className = className;
  img.src = srcValue;
  if (altValue) img.alt = altValue;
  document.body.appendChild(img);
  return img;
}

describe('ImageModal', () => {
  it('opens on a transcript image click and closes on overlay click', async () => {
    render(ImageModal);
    const trigger = addImage('message-image', 'data:image/png;base64,AAA', 'shot');
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');

    trigger.click();
    await tick();
    expect(modal.classList.contains('open')).toBe(true);
    expect(modalImg.getAttribute('src')).toBe('data:image/png;base64,AAA');
    expect(modalImg.alt).toBe('shot');

    modal.click(); // backdrop / overlay dismiss
    await tick();
    expect(modal.classList.contains('open')).toBe(false);
    expect(modalImg.hasAttribute('src')).toBe(false);

    trigger.remove();
  });

  it('opens for a composer image preview and closes on Escape', async () => {
    render(ImageModal);
    const trigger = addImage('pi-chat-attachment-preview', 'data:image/png;base64,BBB');
    const modal = document.getElementById('image-modal');

    trigger.click();
    await tick();
    expect(modal.classList.contains('open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick();
    expect(modal.classList.contains('open')).toBe(false);

    trigger.remove();
  });
});
