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
}
