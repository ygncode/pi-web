import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySessionPageBodyClasses, applyStoredSessionLayout } from './session-page-layout.js';

describe('session page layout helpers', () => {
  afterEach(() => {
    document.documentElement.className = '';
    document.body.className = '';
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
  });

  it('adds and removes the session page body classes', () => {
    const dispose = applySessionPageBodyClasses({ documentImpl: document });
    expect(document.documentElement.classList.contains('pi-session-page')).toBe(true);
    expect(document.body.classList.contains('pi-session-page')).toBe(true);

    dispose();

    expect(document.documentElement.classList.contains('pi-session-page')).toBe(false);
    expect(document.body.classList.contains('pi-session-page')).toBe(false);
  });

  it('applies stored sidebar and right-sidebar state', () => {
    const storage = new Map([
      ['pi-share:v1:sidebar-collapsed', 'true'],
      ['pi-share:v1:sidebar-width', '321'],
      ['pi-web:v1:right-sidebar-width', '456'],
    ]);
    const windowImpl = {
      matchMedia: vi.fn(() => ({ matches: true })),
    };

    applyStoredSessionLayout({
      documentImpl: document,
      windowImpl,
      storage: { getItem: (key) => storage.get(key) ?? null },
    });

    expect(document.body.classList.contains('sidebar-collapsed')).toBe(true);
    expect(document.body.classList.contains('right-sidebar-collapsed')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('321px');
    expect(document.documentElement.style.getPropertyValue('--right-sidebar-width')).toBe('456px');
  });
});
