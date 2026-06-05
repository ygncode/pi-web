import { runIndexPage } from './index.js';

if (typeof window !== 'undefined' && typeof document !== 'undefined' && (document.getElementById('session-palette-search') || document.getElementById('search') || document.querySelector('[data-sessions-content]'))) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => runIndexPage());
  } else {
    runIndexPage();
  }
}
