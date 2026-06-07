import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { flushSync, unmount } from 'svelte';
import { mountApp } from './main.js';

let mounted;

beforeEach(() => {
  document.body.innerHTML = '';
  mounted = null;
});

afterEach(() => {
  if (mounted) unmount(mounted);
});

describe('App', () => {
  it('does not mount when no #app target exists', () => {
    expect(mountApp()).toBeNull();
  });

  it('routes / to the Svelte sessions page', () => {
    document.body.innerHTML = '<div id="app"></div>';

    mounted = mountApp({ props: { path: '/' } });

    expect(document.querySelector('.header h1')?.textContent).toContain('Sessions');
    expect(document.querySelector('[data-sessions-content]')).toBeTruthy();
  });

  it('routes /session to the Svelte session page', () => {
    document.body.innerHTML = '<div id="app"></div>';

    mounted = mountApp({ props: { path: '/session' } });
    // SessionPage marks the document on mount; the loading indicator itself is
    // delayed (no flash) so the class is the reliable "mounted" signal.
    flushSync();

    expect(document.documentElement.classList.contains('pi-session-page')).toBe(true);
  });

  it('routes /settings to the Svelte settings page', () => {
    document.body.innerHTML = '<div id="app"></div>';

    mounted = mountApp({ props: { path: '/settings' } });

    expect(document.querySelector('.settings-page h1')?.textContent).toBe('Settings');
    expect(document.querySelector('[data-setting="pi-web-theme"]')).toBeTruthy();
  });

  it('routes /login to the Svelte login page', () => {
    document.body.innerHTML = '<div id="app"></div>';

    mounted = mountApp({ props: { path: '/login' } });

    expect(document.querySelector('#login-title')?.textContent).toBe('Login');
    expect(document.querySelector('input[name="token"]')).toBeTruthy();
  });

  it('mounts the fallback probe for unmigrated SPA routes', () => {
    document.body.innerHTML = '<div id="app"></div>';

    mounted = mountApp({ props: { path: '/future-route' } });

    expect(document.querySelector('[aria-label="Svelte app probe"]')?.textContent).toContain('Svelte ready for pi-web');
  });

  it('swaps views on pushState navigation', () => {
    document.body.innerHTML = '<div id="app"></div>';
    mounted = mountApp({ props: { path: '/' } });
    flushSync(); // let onMount attach the history listeners
    expect(document.querySelector('[data-sessions-content]')).toBeTruthy();

    window.history.pushState({}, '', '/settings');
    flushSync();

    expect(document.querySelector('.settings-page h1')?.textContent).toBe('Settings');
  });

  it('swaps views on browser back/forward (popstate)', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.history.pushState({}, '', '/');
    mounted = mountApp({ props: { path: '/' } });
    flushSync(); // let onMount attach the history listeners

    window.history.pushState({}, '', '/settings');
    flushSync();
    expect(document.querySelector('.settings-page')).toBeTruthy();

    const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    window.history.back();
    await popped;
    flushSync();

    expect(document.querySelector('[data-sessions-content]')).toBeTruthy();
  });

  it('does not swap when pushState keeps the same pathname', () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.history.pushState({}, '', '/settings');
    mounted = mountApp({ props: { path: '/settings' } });
    flushSync(); // let onMount attach the history listeners
    expect(document.querySelector('.settings-page')).toBeTruthy();

    // Mirrors FullScreenSheet's mobile back-button trap: a pushState that keeps
    // the pathname must not tear down and remount the current page.
    window.history.pushState({}, '', '/settings?sheet=1');
    flushSync();

    expect(document.querySelector('.settings-page')).toBeTruthy();
  });

  // SessionPage fetches /api/session?id=<id> as it mounts, so a fetch for the new
  // id is a reliable "it remounted and loaded the new session" signal.
  it('remounts SessionPage on session→session navigation (?id change)', () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('stub')));
    const origFetch = window.fetch;
    window.fetch = fetchSpy;
    try {
      document.body.innerHTML = '<div id="app"></div>';
      window.history.pushState({}, '', '/session?id=A');
      mounted = mountApp({ props: { path: '/session', search: '?id=A' } });
      flushSync();
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('id=A'))).toBe(true);

      fetchSpy.mockClear();
      window.history.pushState({}, '', '/session?id=B');
      flushSync();
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('id=B'))).toBe(true);
    } finally {
      window.fetch = origFetch;
    }
  });

  it('does not remount SessionPage when the id is unchanged', () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('stub')));
    const origFetch = window.fetch;
    window.fetch = fetchSpy;
    try {
      document.body.innerHTML = '<div id="app"></div>';
      window.history.pushState({}, '', '/session?id=A');
      mounted = mountApp({ props: { path: '/session', search: '?id=A' } });
      flushSync();

      // A within-session URL change (non-id query param) must not tear down and
      // reload the live session view.
      fetchSpy.mockClear();
      window.history.pushState({}, '', '/session?id=A&panel=tree');
      flushSync();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      window.fetch = origFetch;
    }
  });
});
