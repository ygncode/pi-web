// Reactive open-state for the session viewer's modals/sheets. Replaces the
// window.__piOpen* bridge: <SessionPage> binds the modal components to this
// state, and any consumer — Svelte component or plain-JS runtime module
// (session-globals, session-content-runtime, cat-gatekeeper) — imports the
// open* helpers directly instead of reaching through window. There is one
// session viewer at a time, so a module singleton is sufficient; resetSessionModals()
// clears it when <SessionPage> unmounts so SPA re-entry never shows a stale modal.
import { buildUserMessageList } from '../components/session/ForkModal.svelte';

export const sessionModals = $state({
  shortcuts: false,
  modelUsage: false,
  fork: { open: false, entries: [], onSelect: null },
  catSettings: { open: false, controller: null, onChange: () => {} },
  label: { open: false, entryId: '', currentLabel: '', onSave: null },
  diff: { open: false, sessionId: '' },
});

export function openShortcuts() {
  sessionModals.shortcuts = true;
}

export function openModelUsage() {
  sessionModals.modelUsage = true;
}

// Returns false (and does not open) when there are no user messages to fork
// from, so the command menu can surface a toast.
export function openFork({ entries = [], onSelect = null } = {}) {
  if (buildUserMessageList(entries).length === 0) return false;
  sessionModals.fork.entries = entries;
  sessionModals.fork.onSelect = onSelect;
  sessionModals.fork.open = true;
  return true;
}

export function openCatSettings({ controller = null, onChange = () => {} } = {}) {
  sessionModals.catSettings.controller = controller;
  sessionModals.catSettings.onChange = onChange;
  sessionModals.catSettings.open = true;
}

export function openLabel({ entryId = '', currentLabel = '', onSave = null } = {}) {
  sessionModals.label.entryId = entryId;
  sessionModals.label.currentLabel = currentLabel;
  sessionModals.label.onSave = onSave;
  sessionModals.label.open = true;
}

export function openDiff({ sessionId = '' } = {}) {
  sessionModals.diff.sessionId = sessionId;
  sessionModals.diff.open = true;
}

// The diff modal's open state is mirrored to a `?diff=open` query param so a
// page refresh restores the open sheet. SessionShell drives this — calling
// syncDiffUrlParam whenever sessionModals.diff.open flips, and restoring from
// the URL on mount before the sync effect runs (otherwise the effect would
// strip the param before we could read it).
export const DIFF_URL_PARAM = 'diff';
export const DIFF_URL_VALUE = 'open';

export function syncDiffUrlParam(open, { windowImpl } = {}) {
  const win = windowImpl ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win) return;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-shot read+mutate, fed to replaceState; not reactive state
  const url = new URL(win.location.href);
  const has = url.searchParams.get(DIFF_URL_PARAM) === DIFF_URL_VALUE;
  if (open === has) return;
  if (open) url.searchParams.set(DIFF_URL_PARAM, DIFF_URL_VALUE);
  else url.searchParams.delete(DIFF_URL_PARAM);
  // replaceState (not push) so back-button behavior is unchanged — closing the
  // modal must not require a second back press.
  win.history.replaceState(win.history.state, '', url);
}

export function hasDiffUrlParam({ windowImpl } = {}) {
  const win = windowImpl ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win) return false;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-shot read of location, not reactive state
  return new URL(win.location.href).searchParams.get(DIFF_URL_PARAM) === DIFF_URL_VALUE;
}

export function resetSessionModals() {
  sessionModals.shortcuts = false;
  sessionModals.modelUsage = false;
  sessionModals.fork.open = false;
  sessionModals.fork.entries = [];
  sessionModals.fork.onSelect = null;
  sessionModals.catSettings.open = false;
  sessionModals.catSettings.controller = null;
  sessionModals.catSettings.onChange = () => {};
  sessionModals.label.open = false;
  sessionModals.label.entryId = '';
  sessionModals.label.currentLabel = '';
  sessionModals.label.onSave = null;
  sessionModals.diff.open = false;
  sessionModals.diff.sessionId = '';
}
