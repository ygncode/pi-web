import { describe, it, expect } from 'vitest';
import {
  KEY_ACTIONS,
  defaultCombo,
  parseCombo,
  comboMatchesEvent,
  expectedEventKey,
  matchesAction,
} from './keybindings.js';

const ev = (key, mods = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('parseCombo', () => {
  it('splits modifiers and key', () => {
    expect(parseCombo('mod+shift+l')).toEqual({
      key: 'l',
      mod: true,
      ctrl: false,
      shift: true,
      alt: false,
    });
  });

  it('treats a lone key as no modifiers', () => {
    expect(parseCombo('j')).toMatchObject({ key: 'j', mod: false, shift: false });
  });
});

describe('expectedEventKey', () => {
  it('uppercases a shifted single letter', () => {
    expect(expectedEventKey('shift+g')).toBe('G');
    expect(expectedEventKey('shift+i')).toBe('I');
  });

  it('leaves bare keys unchanged', () => {
    expect(expectedEventKey('j')).toBe('j');
  });
});

describe('comboMatchesEvent', () => {
  it('mod accepts either meta or ctrl', () => {
    expect(comboMatchesEvent('mod+k', ev('k', { metaKey: true }))).toBe(true);
    expect(comboMatchesEvent('mod+k', ev('k', { ctrlKey: true }))).toBe(true);
  });

  it('requires the command modifier for mod chords', () => {
    expect(comboMatchesEvent('mod+k', ev('k'))).toBe(false);
  });

  it('rejects extra modifiers not named in the combo', () => {
    expect(comboMatchesEvent('mod+k', ev('k', { metaKey: true, shiftKey: true }))).toBe(false);
  });

  it('distinguishes ctrl-only from mod', () => {
    expect(comboMatchesEvent('ctrl+i', ev('i', { ctrlKey: true }))).toBe(true);
    // ⌘I (meta, not ctrl) must not trigger a ctrl-only chord.
    expect(comboMatchesEvent('ctrl+i', ev('i', { metaKey: true }))).toBe(false);
  });

  it('matches shift chords against the shifted key value', () => {
    expect(comboMatchesEvent('shift+i', ev('I', { shiftKey: true }))).toBe(true);
    expect(comboMatchesEvent('mod+shift+l', ev('L', { metaKey: true, shiftKey: true }))).toBe(true);
    // A bare shift chord must not fire when the command modifier is held.
    expect(comboMatchesEvent('shift+i', ev('I', { shiftKey: true, ctrlKey: true }))).toBe(false);
  });

  it('rejects plain chords carrying a command modifier', () => {
    expect(comboMatchesEvent('shift+i', ev('I', { shiftKey: true }))).toBe(true);
    expect(comboMatchesEvent('shift+i', ev('I', { shiftKey: true, metaKey: true }))).toBe(false);
  });

  it('is case-insensitive on the key', () => {
    expect(comboMatchesEvent('mod+k', ev('K', { metaKey: true }))).toBe(true);
  });
});

describe('matchesAction', () => {
  it('matches every default binding', () => {
    expect(matchesAction('open-palette', ev('k', { metaKey: true }))).toBe(true);
    expect(matchesAction('toggle-theme', ev('l', { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(matchesAction('open-settings', ev(',', { metaKey: true }))).toBe(true);
    expect(matchesAction('cycle-thinking-level', ev('Tab', { shiftKey: true }))).toBe(true);
  });

  it('honors alias bindings (Ctrl+L still opens the model selector)', () => {
    expect(matchesAction('open-model-selector', ev('i', { ctrlKey: true }))).toBe(true);
    expect(matchesAction('open-model-selector', ev('l', { ctrlKey: true }))).toBe(true);
  });

  it('matches plain-key toggles on the key alone', () => {
    // Their handler owns the editable/modifier guard, so plain keys match
    // regardless of modifiers — preserving the prior t/o/p behavior.
    expect(matchesAction('toggle-thinking', ev('t'))).toBe(true);
    expect(matchesAction('toggle-thinking', ev('T', { shiftKey: true }))).toBe(true);
  });

  it('enforces shift on nav chords', () => {
    expect(matchesAction('scroll-down', ev('j'))).toBe(true);
    expect(matchesAction('scroll-down', ev('k'))).toBe(false);
    // focus-composer is shift+i: bare 'i' must not trigger it.
    expect(matchesAction('focus-composer', ev('I', { shiftKey: true }))).toBe(true);
    expect(matchesAction('focus-composer', ev('i'))).toBe(false);
    expect(matchesAction('scroll-bottom', ev('G', { shiftKey: true }))).toBe(true);
  });

  it('applies an override binding when provided', () => {
    const bindings = { 'open-palette': 'mod+p' };
    expect(matchesAction('open-palette', ev('p', { metaKey: true }), bindings)).toBe(true);
    expect(matchesAction('open-palette', ev('k', { metaKey: true }), bindings)).toBe(false);
  });

  it('returns false for an unknown action', () => {
    expect(matchesAction('nope', ev('k', { metaKey: true }))).toBe(false);
  });
});

describe('registry integrity', () => {
  it('exposes a unique id and category for every action', () => {
    const ids = KEY_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of KEY_ACTIONS) {
      expect(a.category).toBeTruthy();
      expect(defaultCombo(a.id)).toBe(a.combo);
    }
  });
});
