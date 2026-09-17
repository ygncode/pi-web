import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SessionHeader from './SessionHeader.svelte';
import { sessionModals, resetSessionModals } from '../../session/session-modals.svelte.js';

afterEach(() => {
  vi.restoreAllMocks();
  resetSessionModals();
});

describe('SessionHeader', () => {
  it('navigates to /schedules from the header control', async () => {
    const user = userEvent.setup();
    const pushState = vi.spyOn(window.history, 'pushState');
    render(SessionHeader, {
      props: { title: 'How', cwd: '/tmp', sessionId: 's.jsonl', sessionUUID: 'uuid' },
    });

    const link = document.querySelector('[data-schedules-btn]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/schedules');
    expect(link.textContent).toContain('Schedules');

    const right = document.querySelector('.session-header-right');
    expect(right?.children[0]).toBe(link);
    expect(right?.children[1]?.id).toBe('new-session-header-btn');

    await user.click(link);
    expect(pushState).toHaveBeenCalledWith({ back: '/' }, '', '/schedules');
  });

  it('opens the manage-projects sheet from the header control', async () => {
    const user = userEvent.setup();
    render(SessionHeader, {
      props: { title: 'How', cwd: '/tmp', sessionId: 's.jsonl', sessionUUID: 'uuid' },
    });

    const button = document.querySelector('[data-manage-projects-btn]');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Manage Projects');
    expect(button.previousElementSibling?.id).toBe('tree-toggle');

    expect(sessionModals.projects).toBe(false);
    await user.click(button);
    expect(sessionModals.projects).toBe(true);
  });
});
