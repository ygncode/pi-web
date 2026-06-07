import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import ShareDialog from './ShareDialog.svelte';

// The component wires the hidden #share-btn relay (normally in SessionHeader).
function addShareBtn() {
  const btn = document.createElement('button');
  btn.id = 'share-btn';
  document.body.appendChild(btn);
  return btn;
}

afterEach(() => { cleanup(); document.getElementById('share-btn')?.remove(); vi.restoreAllMocks(); });
beforeEach(() => { document.body.innerHTML = ''; });

describe('ShareDialog', () => {
  it('starts hidden and shows the gist + preview URLs after a successful share', async () => {
    const btn = addShareBtn();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ gistUrl: 'https://gist.example/abc', previewUrl: 'https://preview.example/abc' }),
      { status: 200 },
    ))));
    render(ShareDialog, { props: { sessionId: 's.jsonl' } });
    await tick();
    expect(document.getElementById('share-overlay').style.display).toBe('none');

    await fireEvent.click(btn);
    expect(fetch).toHaveBeenCalledWith('/share?id=s.jsonl', { method: 'POST' });
    await waitFor(() => {
      expect(document.getElementById('share-overlay').style.display).toBe('');
    });
    expect(document.getElementById('share-gist-url').value).toBe('https://gist.example/abc');
    expect(document.getElementById('share-preview-url').value).toBe('https://preview.example/abc');
  });

  it('shows an error state when the share endpoint returns an error', async () => {
    const btn = addShareBtn();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ error: 'gh not found' }), { status: 200 },
    ))));
    render(ShareDialog, { props: { sessionId: 's.jsonl' } });
    await tick();

    await fireEvent.click(btn);
    await waitFor(() => {
      expect(document.getElementById('share-dialog').classList.contains('error')).toBe(true);
    });
    expect(document.getElementById('share-error-message').textContent).toContain('gh not found');
  });
});
