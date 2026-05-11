import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { appendEntry, createSeenEntrySet, refreshEntriesAffectedByToolResult, upsertEntry } from './live-entries.js';

function env(dom) {
  return {
    documentImpl: dom.window.document,
    windowImpl: { setTimeout: (cb) => cb() },
    renderEntry: (entry) => `<div id="entry-${entry.id}">${entry.id}</div>`,
    applyToggleStateToNode: (node) => node.setAttribute('data-toggles', 'applied')
  };
}

describe('live entry DOM helpers', () => {
  it('creates seen set from DOM', () => {
    const dom = new JSDOM('<div id="entry-a"></div><div id="entry-b"></div>');
    expect(Array.from(createSeenEntrySet({ documentImpl: dom.window.document })).sort()).toEqual(['a', 'b']);
  });

  it('appends and upserts entries', () => {
    const dom = new JSDOM('<div id="messages"></div>');
    const state = { seen: new Set(), liveRendered: new Set() };
    expect(appendEntry({ id: 'a' }, [{ id: 'a' }], state, env(dom))).toBe(true);
    expect(dom.window.document.getElementById('entry-a').getAttribute('data-toggles')).toBe('applied');
    expect(state.liveRendered.has('a')).toBe(true);

    upsertEntry({ id: 'a' }, [{ id: 'a' }], state, env(dom));
    expect(dom.window.document.getElementById('entry-a').textContent).toBe('a');
  });

  it('refreshes assistant entries that use a tool result', () => {
    const dom = new JSDOM('<div id="messages"><div id="entry-assistant">old</div></div>');
    const state = { seen: new Set(['assistant']), liveRendered: new Set() };
    const entries = [
      { id: 'assistant', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'call-1' }] } },
      { id: 'result', message: { role: 'toolResult', toolCallId: 'call-1' } }
    ];
    refreshEntriesAffectedByToolResult(entries[1], entries, state, env(dom));
    expect(dom.window.document.getElementById('entry-assistant').textContent).toBe('assistant');
  });
});
