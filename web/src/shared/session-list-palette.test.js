import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupSessionListPalette as setupListSessionsPalette } from './session-list-palette.js';

function makeDom() {
  return new JSDOM(`<!doctype html><html><head><title>Test</title></head><body>
    <div class="command-palette-overlay" id="sessionPalette" aria-hidden="true">
      <div class="command-palette" role="dialog" aria-modal="true" aria-label="List sessions">
        <input type="text" id="session-palette-search" placeholder="Search sessions..." autocomplete="off">
        <div class="palette-results" data-palette-results></div>
      </div>
    </div>
  </body></html>`, { url: 'http://localhost/session?id=s.jsonl' });
}

describe('setupListSessionsPalette', () => {
  it('fetches sessions with project filter on open', async () => {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sessions: [
          { ID: 'a.jsonl', Name: 'Alpha', Project: '/home/user/proj', Model: 'gpt', ModelProvider: 'openai', LastActivity: '2026-01-01T00:00:00Z' },
          { ID: 'b.jsonl', Name: 'Beta', Project: '/home/user/proj', Model: 'claude', ModelProvider: 'anthropic', LastActivity: '2026-01-02T00:00:00Z' },
        ]
      }),
    }));

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      getCwd: () => '/home/user/proj',
    });

    await palette.open();

    expect(fetchImpl).toHaveBeenCalledWith('/api/sessions?project=%2Fhome%2Fuser%2Fproj');
  });

  it('renders session results in the palette', async () => {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sessions: [
          { ID: 'a.jsonl', Name: 'Alpha session', Project: '/proj', Model: 'gpt', ModelProvider: 'openai', LastActivity: '2026-01-01T00:00:00Z' },
        ]
      }),
    }));

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      getCwd: () => '/proj',
    });

    await palette.open();

    const results = dom.window.document.querySelector('[data-palette-results]');
    expect(results.children.length).toBe(1);
    expect(results.children[0].querySelector('.palette-result-title').textContent).toBe('Alpha session');
    expect(results.children[0].querySelector('.palette-result-meta').textContent).toContain('openai/gpt');
  });

  it('shows empty state when no sessions match', async () => {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sessions: [] }),
    }));

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      getCwd: () => '/empty',
    });

    await palette.open();

    const results = dom.window.document.querySelector('[data-palette-results]');
    expect(results.innerHTML).toContain('palette-empty');
  });

  it('opens and closes the overlay', async () => {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sessions: [] }),
    }));

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      getCwd: () => '/proj',
    });

    const overlay = dom.window.document.getElementById('sessionPalette');

    await palette.open();
    expect(overlay.classList.contains('open')).toBe(true);
    expect(overlay.getAttribute('aria-hidden')).toBe('false');

    palette.close();
    expect(overlay.classList.contains('open')).toBe(false);
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
  });

  it('filters results by search text', async () => {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sessions: [
          { ID: 'a.jsonl', Name: 'Alpha', Project: '/proj', Model: '', ModelProvider: '', LastActivity: '' },
          { ID: 'b.jsonl', Name: 'Beta session', Project: '/proj', Model: '', ModelProvider: '', LastActivity: '' },
          { ID: 'c.jsonl', Name: 'Gamma', Project: '/proj', Model: '', ModelProvider: '', LastActivity: '' },
        ]
      }),
    }));

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      getCwd: () => '/proj',
    });

    await palette.open();

    const searchInput = dom.window.document.getElementById('session-palette-search');
    searchInput.value = 'Beta';
    searchInput.dispatchEvent(new dom.window.Event('input'));

    // Wait for debounce (100ms)
    await new Promise((r) => dom.window.setTimeout(r, 150));

    const results = dom.window.document.querySelector('[data-palette-results]');
    expect(results.children.length).toBe(1);
    expect(results.children[0].querySelector('.palette-result-title').textContent).toBe('Beta session');
  });

  it('navigates to session on click', async () => {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sessions: [
          { ID: 'target.jsonl', Name: 'Target', Project: '/proj', Model: '', ModelProvider: '', LastActivity: '' },
        ]
      }),
    }));

    const navigate = vi.fn();

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      navigate,
      getCwd: () => '/proj',
    });

    await palette.open();

    const result = dom.window.document.querySelector('.palette-result');
    result.click();

    expect(navigate).toHaveBeenCalledWith('/session?id=target.jsonl');
  });

  it('closes on Escape key', async () => {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sessions: [] }),
    }));

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      getCwd: () => '/proj',
    });

    await palette.open();

    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dom.window.document.getElementById('sessionPalette').classList.contains('open')).toBe(false);
  });

  it('closes on overlay click', async () => {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sessions: [] }),
    }));

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      getCwd: () => '/proj',
    });

    await palette.open();

    const overlay = dom.window.document.getElementById('sessionPalette');
    overlay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('does not close when clicking inside dialog', async () => {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sessions: [] }),
    }));

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      getCwd: () => '/proj',
    });

    await palette.open();

    const dialog = dom.window.document.querySelector('.command-palette');
    dialog.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(dom.window.document.getElementById('sessionPalette').classList.contains('open')).toBe(true);
  });
});

describe('palette keyboard navigation', () => {
  function sessions(count) {
    return Array.from({ length: count }, (_, i) => ({
      ID: `s${i}.jsonl`,
      Name: `Session ${i}`,
      Project: '/proj',
      Model: `model-${i}`,
      ModelProvider: 'openai',
      // Reverse order so newest appears first (sort is descending by LastActivity)
      LastActivity: `2026-01-${String(count - i).padStart(2, '0')}T00:00:00Z`,
    }));
  }

  function selectedResult(dom) {
    return dom.window.document.querySelector('.palette-result--selected');
  }

  function resultButtons(dom) {
    return Array.from(dom.window.document.querySelectorAll('.palette-result'));
  }

  async function openPaletteWith(count, opts = {}) {
    const dom = makeDom();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sessions: sessions(count) }),
    }));
    const navigate = vi.fn();

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      navigate,
      getCwd: () => '/proj',
      ...opts,
    });

    await palette.open();
    return { dom, palette, navigate };
  }

  function key(dom, name) {
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: name }));
  }

  it('ArrowDown from input selects first item', async () => {
    const { dom } = await openPaletteWith(5);

    key(dom, 'ArrowDown');

    const sel = selectedResult(dom);
    expect(sel).not.toBeNull();
    expect(sel.querySelector('.palette-result-title').textContent).toBe('Session 0');
  });

  it('ArrowDown moves through items sequentially', async () => {
    const { dom } = await openPaletteWith(5);

    key(dom, 'ArrowDown');
    key(dom, 'ArrowDown');

    const sel = selectedResult(dom);
    expect(sel.querySelector('.palette-result-title').textContent).toBe('Session 1');

    // first item no longer selected
    const buttons = resultButtons(dom);
    expect(buttons[0].classList.contains('palette-result--selected')).toBe(false);
    expect(buttons[1].classList.contains('palette-result--selected')).toBe(true);
  });

  it('ArrowDown stops at last rendered item', async () => {
    const { dom } = await openPaletteWith(5);

    // move to last item (index 4)
    for (let i = 0; i < 5; i++) key(dom, 'ArrowDown');

    expect(selectedResult(dom).querySelector('.palette-result-title').textContent).toBe('Session 4');

    // one more ArrowDown should keep the same selection
    key(dom, 'ArrowDown');
    expect(selectedResult(dom).querySelector('.palette-result-title').textContent).toBe('Session 4');
  });

  it('ArrowDown respects limit — cannot navigate past rendered buttons', async () => {
    const { dom } = await openPaletteWith(12);

    const buttons = resultButtons(dom);
    expect(buttons.length).toBe(8); // default limit

    // move to last rendered item (index 7)
    for (let i = 0; i < 8; i++) key(dom, 'ArrowDown');

    expect(selectedResult(dom).querySelector('.palette-result-title').textContent).toBe('Session 7');

    // one more ArrowDown stays on the same item
    key(dom, 'ArrowDown');
    expect(selectedResult(dom).querySelector('.palette-result-title').textContent).toBe('Session 7');
  });

  it('ArrowUp from first item returns to search input', async () => {
    const { dom } = await openPaletteWith(5);

    // select first, then go back up
    key(dom, 'ArrowDown');
    key(dom, 'ArrowUp');

    expect(selectedResult(dom)).toBeNull();
  });

  it('ArrowUp from input selects last rendered item', async () => {
    const { dom } = await openPaletteWith(5);

    key(dom, 'ArrowUp');

    const sel = selectedResult(dom);
    expect(sel).not.toBeNull();
    expect(sel.querySelector('.palette-result-title').textContent).toBe('Session 4');
  });

  it('ArrowUp from input selects last rendered item respecting limit', async () => {
    const { dom } = await openPaletteWith(12);

    key(dom, 'ArrowUp');

    // should select index 7 (last rendered), not index 11
    expect(selectedResult(dom).querySelector('.palette-result-title').textContent).toBe('Session 7');
  });

  it('ArrowUp moves up through items', async () => {
    const { dom } = await openPaletteWith(5);

    // go to item 2, then back to 1
    key(dom, 'ArrowDown');
    key(dom, 'ArrowDown');
    key(dom, 'ArrowDown');
    key(dom, 'ArrowUp');

    expect(selectedResult(dom).querySelector('.palette-result-title').textContent).toBe('Session 1');
  });

  it('Enter on selected item navigates and closes', async () => {
    const { dom, navigate } = await openPaletteWith(5);

    // select item 2
    key(dom, 'ArrowDown');
    key(dom, 'ArrowDown');
    key(dom, 'ArrowDown');
    key(dom, 'Enter');

    expect(navigate).toHaveBeenCalledWith('/session?id=s2.jsonl');
    expect(dom.window.document.getElementById('sessionPalette').classList.contains('open')).toBe(false);
  });

  it('Enter with no selection navigates to first item', async () => {
    const { dom, navigate } = await openPaletteWith(5);

    key(dom, 'Enter');

    expect(navigate).toHaveBeenCalledWith('/session?id=s0.jsonl');
  });

  it('Enter does nothing when there are no results', async () => {
    const { dom, navigate } = await openPaletteWith(0);

    key(dom, 'Enter');

    expect(navigate).not.toHaveBeenCalled();
  });

  it('selection resets when search text changes', async () => {
    const { dom } = await openPaletteWith(5);

    // select item 2
    key(dom, 'ArrowDown');
    key(dom, 'ArrowDown');
    expect(selectedResult(dom).querySelector('.palette-result-title').textContent).toBe('Session 1');

    // type to filter
    const searchInput = dom.window.document.getElementById('session-palette-search');
    searchInput.value = 'Session 4';
    searchInput.dispatchEvent(new dom.window.Event('input'));

    // selection should be cleared immediately, before the debounce fires
    expect(selectedResult(dom)).toBeNull();

    // wait for debounce
    await new Promise((r) => dom.window.setTimeout(r, 150));

    // selection should still be cleared
    expect(selectedResult(dom)).toBeNull();

    // filtered results should show only Session 4
    const buttons = resultButtons(dom);
    expect(buttons.length).toBe(1);
    expect(buttons[0].querySelector('.palette-result-title').textContent).toBe('Session 4');
  });

  it('Enter immediately after filtering opens the first fresh result', async () => {
    const { dom, navigate } = await openPaletteWith(5);

    key(dom, 'ArrowDown');
    key(dom, 'ArrowDown');
    expect(selectedResult(dom).querySelector('.palette-result-title').textContent).toBe('Session 1');

    const searchInput = dom.window.document.getElementById('session-palette-search');
    searchInput.value = 'Session 4';
    searchInput.dispatchEvent(new dom.window.Event('input'));
    key(dom, 'Enter');

    expect(navigate).toHaveBeenCalledWith('/session?id=s4.jsonl');
  });

  it('does not steal Enter from focused palette action buttons', async () => {
    const dom = makeDom();
    const action = dom.window.document.createElement('button');
    action.type = 'button';
    action.className = 'palette-action';
    action.dataset.newSessionBtn = '';
    action.textContent = 'New session';
    dom.window.document.querySelector('.command-palette').appendChild(action);

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sessions: sessions(3) }),
    }));
    const navigate = vi.fn();
    const onNewSession = vi.fn();

    const palette = setupListSessionsPalette({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      fetchImpl,
      navigate,
      getCwd: () => '/proj',
      onNewSession,
    });

    await palette.open();
    key(dom, 'ArrowDown');
    action.focus();

    const event = new dom.window.KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    dom.window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keyboard handler is cleaned up on close', async () => {
    const { dom, palette } = await openPaletteWith(3);

    palette.close();

    // dispatching ArrowDown should not throw or have any effect
    expect(() => key(dom, 'ArrowDown')).not.toThrow();
    expect(selectedResult(dom)).toBeNull();
  });

  it('handles ArrowDown gracefully with no sessions', async () => {
    const { dom } = await openPaletteWith(0);

    // should not throw
    expect(() => key(dom, 'ArrowDown')).not.toThrow();
    expect(selectedResult(dom)).toBeNull();
  });

  it('handles ArrowUp gracefully with no sessions', async () => {
    const { dom } = await openPaletteWith(0);

    expect(() => key(dom, 'ArrowUp')).not.toThrow();
    expect(selectedResult(dom)).toBeNull();
  });
});
