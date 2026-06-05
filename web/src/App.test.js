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

    mounted = mountApp({ props: { name: 'migration' } });

    expect(document.querySelector('[aria-label="Svelte app probe"]')?.textContent).toContain('Svelte ready for migration');
  });
});
