import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import SchedulesPage from './SchedulesPage.svelte';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function backLink() {
  return document.querySelector('.session-header-back');
}

describe('SchedulesPage back button', () => {
  it('returns to the session that opened it', async () => {
    window.history.replaceState({ back: '/session?id=s.jsonl' }, '', '/schedules');
    const pushState = vi.spyOn(window.history, 'pushState');
    render(SchedulesPage);

    const link = backLink();
    expect(link.getAttribute('href')).toBe('/session?id=s.jsonl');
    expect(link.textContent).toContain('Back');

    await fireEvent.click(link);
    expect(pushState).toHaveBeenCalledWith({}, '', '/session?id=s.jsonl');
  });

  it('falls back to the index when opened directly', async () => {
    window.history.replaceState({}, '', '/schedules');
    render(SchedulesPage);

    const link = backLink();
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toContain('Sessions');
  });
});
