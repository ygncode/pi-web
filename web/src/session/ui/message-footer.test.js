import { describe, expect, it } from 'vitest';
import { finalText, turnFiles, permalink } from './message-footer.js';

const user = { type: 'message', id: 'u1', message: { role: 'user', content: 'faça' } };
const call = {
  type: 'message',
  id: 'a1',
  message: {
    role: 'assistant',
    stopReason: 'toolUse',
    content: [
      { type: 'thinking', thinking: 'pensando' },
      {
        type: 'toolCall',
        id: 'c1',
        name: 'write',
        arguments: { path: '/r/app.py', content: 'a\nb\nc' },
      },
      {
        type: 'toolCall',
        id: 'c2',
        name: 'edit',
        arguments: { path: '/r/README.md', edits: [{ oldText: 'x\ny', newText: 'z' }] },
      },
      { type: 'toolCall', id: 'c3', name: 'bash', arguments: { command: 'ls' } },
    ],
  },
};
const r1 = { type: 'message', id: 'r1', message: { role: 'toolResult', toolCallId: 'c1' } };
const r2 = { type: 'message', id: 'r2', message: { role: 'toolResult', toolCallId: 'c2' } };
const final = {
  type: 'message',
  id: 'a2',
  timestamp: '2026-11-14T16:00:00.000Z',
  message: {
    role: 'assistant',
    stopReason: 'stop',
    content: [
      { type: 'thinking', thinking: 'segredo' },
      { type: 'text', text: '## Pronto\n\n**ok**' },
      { type: 'text', text: 'fim' },
    ],
  },
};

describe('message footer helpers', () => {
  it('copies only the final markdown text', () => {
    expect(finalText(final.message)).toBe('## Pronto\n\n**ok**\n\nfim');
    expect(finalText(call.message)).toBe('');
    expect(
      finalText({ role: 'assistant', stopReason: 'error', content: [{ type: 'text', text: 'x' }] }),
    ).toBe('');
  });

  it('summarises files changed in the turn', () => {
    const entries = [user, call, r1, r2, final];
    const t = turnFiles(final, entries);
    expect(t.files.map((f) => f.name)).toEqual(['app.py', 'README.md']);
    expect(t.files[0]).toMatchObject({
      ext: 'PY',
      op: 'write',
      added: 3,
      removed: 0,
      anchor: 'entry-r1',
    });
    expect(t.files[1]).toMatchObject({ op: 'edit', added: 1, removed: 2 });
    expect([t.added, t.removed]).toEqual([4, 2]);
  });

  it('stops at the previous user message', () => {
    const older = { ...final, id: 'a0' };
    const t = turnFiles(final, [older, call, r1, user, final]);
    expect(t.files).toEqual([]);
  });

  it('builds a session permalink', () => {
    const loc = { origin: 'http://h:1', search: '?id=s%201.jsonl' };
    expect(permalink('e9', loc)).toBe('http://h:1/session?id=s%201.jsonl#entry-e9');
  });
});
