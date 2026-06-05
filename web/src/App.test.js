import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { unmount } from 'svelte';
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

  it('mounts the Svelte probe component into #app', () => {
    document.body.innerHTML = '<div id="app"></div>';

    mounted = mountApp();

    expect(document.querySelector('[aria-label="Svelte app probe"]')?.textContent).toContain('Svelte ready for pi-web');
  });

  it('routes /settings to the Svelte settings page', () => {
    document.body.innerHTML = '<div id="app"></div>';

    mounted = mountApp({ props: { path: '/settings' } });

    expect(document.querySelector('.settings-page h1')?.textContent).toBe('Settings');
    expect(document.querySelector('[data-setting="pi-web-theme"]')).toBeTruthy();
  });
});
