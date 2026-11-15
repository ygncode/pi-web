import { describe, expect, it } from 'vitest';
import { displayName, isOthersView, shortName, viewCookieString, viewLabel } from './people.js';

const data = {
  me: { login: 'ana@symetrix.com', short: 'ana', name: 'Ana' },
  people: [
    { login: 'ana@symetrix.com', short: 'ana', me: true, sessions: 2 },
    { login: 'bruno@symetrix.com', short: 'bruno', sessions: 1 },
  ],
};

describe('people helpers', () => {
  it('derives short and display names', () => {
    expect(shortName('Bruno@Symetrix.com')).toBe('bruno');
    expect(displayName({ login: 'bruno@symetrix.com' })).toBe('Bruno');
    expect(displayName({ login: 'x@y', name: 'Xavier Y' })).toBe('Xavier Y');
  });

  it('labels the current view', () => {
    expect(viewLabel('me', data)).toBe('Minhas conversas');
    expect(viewLabel('ana@symetrix.com', data)).toBe('Minhas conversas');
    expect(viewLabel('all', data)).toBe('Todas as pessoas');
    expect(viewLabel('_unassigned', data)).toBe('Sem dono');
    expect(viewLabel('bruno@symetrix.com', data)).toBe('Conversas de Bruno');
  });

  it('detects when browsing someone else', () => {
    expect(isOthersView('me', data)).toBe(false);
    expect(isOthersView('ana@symetrix.com', data)).toBe(false);
    expect(isOthersView('bruno@symetrix.com', data)).toBe(true);
    expect(isOthersView('all', data)).toBe(true);
  });

  it('builds a long-lived root-path cookie', () => {
    const c = viewCookieString('bruno@symetrix.com');
    expect(c).toContain('pi_view_owner=bruno%40symetrix.com');
    expect(c).toContain('Path=/');
    expect(c).toContain('SameSite=Lax');
  });
});
