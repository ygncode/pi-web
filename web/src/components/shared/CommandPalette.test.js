import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CommandPalette, { filterPaletteSessions, normalizePaletteSession } from './CommandPalette.svelte';

describe('CommandPalette', () => {
  it('normalizes and filters sessions', () => {
    const session = normalizePaletteSession({ ID: 'abc', Name: 'Fix bug', Project: '/repo' });
    expect(session.href).toBe('/session?id=abc');
    expect(filterPaletteSessions([session], 'fix')).toHaveLength(1);
    expect(filterPaletteSessions([session], 'missing')).toHaveLength(0);
  });

  it('opens through the window bridge and navigates a selected session', async () => {
    const seen = [];
    render(CommandPalette, {
      props: {
        loadSessions: async () => [{ id: 's1', name: 'Session one', model: 'm' }],
        navigate: (url) => seen.push(url),
      },
    });
    await window.__piOpenSessionPalette();
    await screen.findByText('Session one');
    await fireEvent.click(screen.getByText('Session one'));
    expect(seen).toEqual(['/session?id=s1']);
  });
});
