import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import CommandMenu from './CommandMenu.svelte';
import { sessionModals, resetSessionModals } from '../../session/session-modals.svelte.js';

// The menu button (#command-menu-btn) + title live in SessionHeader; the menu
// reads them by id, so the test provides them in the document.
beforeEach(() => {
  document.body.innerHTML = '';
  const btn = document.createElement('button');
  btn.id = 'command-menu-btn';
  document.body.appendChild(btn);
  const title = document.createElement('span');
  title.id = 'session-header-title';
  title.textContent = 'Old';
  document.body.appendChild(title);
  window.matchMedia = vi.fn(() => ({ matches: false }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); resetSessionModals(); });

describe('CommandMenu', () => {
  it('renames via the API and updates the page title', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ name: 'New Name' }), { status: 200 }))));
    window.prompt = vi.fn(() => ' New Name ');
    render(CommandMenu, { props: { sessionId: 'session.jsonl' } });
    await tick();

    await fireEvent.click(document.querySelector('[data-action="rename"]'));
    await waitFor(() => expect(document.getElementById('session-header-title').textContent).toBe('New Name'));
    expect(fetch).toHaveBeenCalledWith('/api/rename-session?id=session.jsonl', expect.objectContaining({ method: 'POST' }));
    expect(document.title).toBe('New Name');
  });

  it('keeps the old title when the rename API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: 'bad' }), { status: 500 }))));
    window.prompt = vi.fn(() => 'New Name');
    render(CommandMenu, { props: { sessionId: 'session.jsonl' } });
    await tick();

    await fireEvent.click(document.querySelector('[data-action="rename"]'));
    await waitFor(() => expect(document.getElementById('command-menu-toast')?.textContent).toBe('Rename failed'));
    expect(document.getElementById('session-header-title').textContent).toBe('Old');
  });

  it('opens model usage via the modal store + the session-list palette via its window bridge', async () => {
    window.__piOpenSessionPalette = vi.fn();
    render(CommandMenu, { props: { sessionId: 's' } });
    await tick();

    await fireEvent.click(document.querySelector('[data-action="model-usage"]'));
    await fireEvent.click(document.querySelector('[data-action="list-sessions"]'));
    expect(sessionModals.modelUsage).toBe(true);
    expect(window.__piOpenSessionPalette).toHaveBeenCalled();
    delete window.__piOpenSessionPalette;
  });
});
