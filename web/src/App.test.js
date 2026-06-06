import { describe, expect, it, beforeEach, afterEach } from 'vitest';
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
});
