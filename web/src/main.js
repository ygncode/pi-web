import { mount } from 'svelte';
import App from './App.svelte';

function defaultTarget() {
  return typeof document !== 'undefined' ? document.getElementById('app') : null;
}

export function mountApp({ target = defaultTarget(), props = {} } = {}) {
  if (!target) return null;
  return mount(App, { target, props });
}

const appTarget = typeof document !== 'undefined' ? document.getElementById('app') : null;
if (appTarget && !appTarget.dataset.piWebSvelteMounted) {
  appTarget.dataset.piWebSvelteMounted = 'true';
  mountApp({ target: appTarget });
}
