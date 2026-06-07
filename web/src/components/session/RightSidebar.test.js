import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup } from '@testing-library/svelte';
import RightSidebar from './RightSidebar.svelte';
import { sessionRuntime, resetSessionRuntime } from '../../session/session-runtime.js';

afterEach(() => {
  cleanup();
  document.body.className = '';
  document.documentElement.removeAttribute('style');
  localStorage.clear();
  resetSessionRuntime();
});

beforeEach(() => {
  document.body.className = '';
  localStorage.clear();
});

describe('RightSidebar tabs', () => {
  it('switches panes and aria state on tab click', async () => {
    render(RightSidebar);
    document.querySelector('[data-pane="artifacts"]').click();
    await tick();

    expect(document.querySelector('[data-pane="artifacts"]').classList.contains('active')).toBe(true);
    expect(document.querySelector('[data-pane="artifacts"]').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-pane="scratchpad"]').getAttribute('aria-selected')).toBe('false');
    expect(document.getElementById('right-pane-artifacts').hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('right-pane-scratchpad').hasAttribute('hidden')).toBe(true);
  });

  it('persists the active tab and restores it on the next mount', async () => {
    render(RightSidebar);
    document.querySelector('[data-pane="artifacts"]').click();
    await tick();
    expect(localStorage.getItem('pi-web:v1:right-sidebar-tab')).toBe('artifacts');
    cleanup();

    render(RightSidebar);
    await tick();
    expect(document.getElementById('right-pane-artifacts').hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-pane="artifacts"]').classList.contains('active')).toBe(true);
  });

  it('marks the active tab on the sidebar for tab-scoped chrome', async () => {
    render(RightSidebar);
    expect(document.getElementById('right-sidebar').dataset.activeTab).toBe('scratchpad');
    document.querySelector('[data-pane="artifacts"]').click();
    await tick();
    expect(document.getElementById('right-sidebar').dataset.activeTab).toBe('artifacts');
  });

  it('ignores activation for an unknown pane name via the window bridge', () => {
    render(RightSidebar);
    sessionRuntime.rightSidebar.activateTab('nonexistent');
    expect(document.querySelector('[data-pane="scratchpad"]').classList.contains('active')).toBe(true);
  });
});

describe('RightSidebar visibility controls', () => {
  it('exposes toggle/open/collapse on the window bridge that drive body classes', () => {
    document.body.classList.add('right-sidebar-collapsed');
    render(RightSidebar);

    sessionRuntime.rightSidebar.open();
    expect(document.body.classList.contains('right-sidebar-collapsed')).toBe(false);

    sessionRuntime.rightSidebar.collapse();
    expect(document.body.classList.contains('right-sidebar-collapsed')).toBe(true);

    sessionRuntime.rightSidebar.toggle();
    expect(document.body.classList.contains('right-sidebar-collapsed')).toBe(false);
  });

  it('close button hides the sidebar and exits expand mode', async () => {
    document.body.classList.add('right-sidebar-expanded');
    render(RightSidebar);
    document.getElementById('close-right-sidebar').click();
    await tick();
    expect(document.body.classList.contains('right-sidebar-collapsed')).toBe(true);
    expect(document.body.classList.contains('right-sidebar-expanded')).toBe(false);
  });
});

describe('RightSidebar scratchpad', () => {
  it('debounce-saves edits to /api/scratchpad', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    render(RightSidebar, { props: { projectPath: '/proj' } });
    const textarea = document.getElementById('scratchpad-textarea');
    textarea.value = 'hello notes';
    textarea.dispatchEvent(new Event('input'));

    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchMock).toHaveBeenCalledWith('/api/scratchpad', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ project: '/proj', content: 'hello notes' });

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
