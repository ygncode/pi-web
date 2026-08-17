// Central registry of remappable keyboard actions.
//
// Before this module, every shortcut was an inline `e.key === '...'` check
// scattered across the nav, session, filter, and composer handlers. Those
// handlers now ask the registry whether an event matches a named action, so a
// single source of truth defines the default binding for each one — and a later
// change can layer user overrides on top without touching the handlers again.
//
// Scope: only the global / navigation / composer shortcuts live here. Structural
// modal keys (Escape-to-close, arrow navigation, Tab focus-traps) and the
// composer's Enter-to-submit stay hardcoded in their components — they are UI
// affordances, not preferences. The multi-key `g g` sequence also stays in
// keyboard-nav.js; the registry models single chords only.

// A combo is a `+`-joined string of optional modifiers followed by one key,
// e.g. `mod+k`, `mod+shift+l`, `shift+i`, `ctrl+i`, `j`.
//
//   mod   → the platform command key: metaKey OR ctrlKey (⌘ on macOS, Ctrl
//           elsewhere). This mirrors the existing `e.metaKey || e.ctrlKey` guards.
//   ctrl  → ctrlKey specifically, independent of ⌘. Used by the composer
//           model-selector, which historically checked only ctrlKey.
//   shift → shiftKey. alt → altKey.
//
// The final token is the key, matched case-insensitively against event.key
// (so `shift+i` matches the 'I' that Shift+i produces).

export const KEY_ACTIONS = [
  // General
  { id: 'open-palette', category: 'general', combo: 'mod+k' },
  { id: 'toggle-sidebar', category: 'general', combo: 'mod+b' },
  { id: 'new-session', category: 'general', combo: 'mod+t' },
  { id: 'toggle-theme', category: 'general', combo: 'mod+shift+l' },
  { id: 'toggle-scratchpad', category: 'general', combo: 'mod+shift+n' },
  { id: 'open-shortcuts-help', category: 'general', combo: 'mod+/' },
  { id: 'open-settings', category: 'general', combo: 'mod+,' },

  // Navigation. The calling handler already excludes editable targets and
  // command modifiers. These match the literal produced key (`j`, `k`, and the
  // shifted `G`/`I`) exactly as the original `e.key === …` checks did, so
  // Caps Lock and every other path behave identically.
  { id: 'scroll-down', category: 'navigation', combo: 'j', literalKey: true },
  { id: 'scroll-up', category: 'navigation', combo: 'k', literalKey: true },
  { id: 'scroll-bottom', category: 'navigation', combo: 'shift+g', literalKey: true },
  { id: 'focus-composer', category: 'navigation', combo: 'shift+i', literalKey: true },

  // Entry toggles. Their original handler matched the key alone with no
  // modifier guard, so these stay key-only (`plain`) to preserve that exactly.
  { id: 'toggle-thinking', category: 'toggles', combo: 't', plain: true },
  { id: 'toggle-tools', category: 'toggles', combo: 'o', plain: true },
  { id: 'toggle-tool-outputs', category: 'toggles', combo: 'p', plain: true },

  // Composer
  { id: 'cycle-thinking-level', category: 'composer', combo: 'shift+tab' },
  // Historically opened by Ctrl+I or Ctrl+L; both remain until the settings UI
  // lets users pick one.
  { id: 'open-model-selector', category: 'composer', combo: 'ctrl+i', aliases: ['ctrl+l'] },
];

const ACTIONS_BY_ID = new Map(KEY_ACTIONS.map((a) => [a.id, a]));

// Default combo for an action id (throws in tests via the map miss if unknown).
export function defaultCombo(actionId) {
  return ACTIONS_BY_ID.get(actionId)?.combo ?? null;
}

// Parse a combo string into required modifiers and a normalized key.
export function parseCombo(combo) {
  const tokens = String(combo).split('+');
  const key = tokens[tokens.length - 1].toLowerCase();
  const mods = new Set(tokens.slice(0, -1));
  return {
    key,
    mod: mods.has('mod'),
    ctrl: mods.has('ctrl'),
    shift: mods.has('shift'),
    alt: mods.has('alt'),
  };
}

// expectedEventKey returns the KeyboardEvent.key value a combo produces, for
// combos matched by their literal key: a shifted single letter arrives
// uppercased (`shift+g` → `G`), everything else unchanged (`j` → `j`).
export function expectedEventKey(combo) {
  const { key, shift } = parseCombo(combo);
  if (shift && /^[a-z]$/.test(key)) return key.toUpperCase();
  return key;
}

// comboMatchesEvent reports whether a modifier-bearing chord matches an event.
// Modifiers not named in the combo must be absent, so `mod+k` never fires for
// `mod+shift+k`. `mod` accepts meta or ctrl; `ctrl` requires ctrl specifically.
export function comboMatchesEvent(combo, event) {
  const want = parseCombo(combo);
  const hasCommand = Boolean(event.metaKey || event.ctrlKey);

  if (want.mod) {
    if (!hasCommand) return false;
  } else if (want.ctrl) {
    if (!event.ctrlKey) return false;
  } else if (hasCommand || event.altKey) {
    // Plain chords (no command modifier requested) must not carry ⌘/Ctrl/Alt.
    return false;
  }
  if (want.shift !== Boolean(event.shiftKey)) return false;
  if (want.alt !== Boolean(event.altKey)) return false;
  return String(event.key).toLowerCase() === want.key;
}

// matchesAction reports whether an event triggers the named action under its
// current binding. Plain-key actions (`plain: true`) compare only the key, so
// the caller's own editable/modifier guard stays authoritative — preserving the
// exact behavior of the pre-registry handlers.
export function matchesAction(actionId, event, bindings = {}) {
  const action = ACTIONS_BY_ID.get(actionId);
  if (!action) return false;
  const combo = bindings[actionId] || action.combo;
  if (action.literalKey) {
    return event.key === expectedEventKey(combo);
  }
  if (action.plain) {
    return String(event.key).toLowerCase() === parseCombo(combo).key;
  }
  if (comboMatchesEvent(combo, event)) return true;
  return (action.aliases || []).some((alias) => comboMatchesEvent(alias, event));
}
