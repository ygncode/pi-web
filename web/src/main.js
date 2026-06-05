import { mount } from 'svelte';
import App from './App.svelte';

function defaultTarget() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('spa-root') || document.getElementById('app');
}

export function mountApp({ target = defaultTarget(), props = {} } = {}) {
  if (!target) return null;
  return mount(App, { target, props });
}

const appTarget = typeof document !== 'undefined' ? defaultTarget() : null;
if (appTarget && !appTarget.dataset.piWebSvelteMounted) {
  appTarget.dataset.piWebSvelteMounted = 'true';
  mountApp({ target: appTarget });
}
