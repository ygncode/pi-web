import { applyLazyHighlighting, runSessionApp } from './session.js';

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById('session-data')) {
  runSessionApp();
  applyLazyHighlighting(document);
}
