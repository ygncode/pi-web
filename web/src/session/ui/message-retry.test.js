import { describe, expect, it, vi } from 'vitest';
import { retrySource, stashRetry, takeRetry, retryMessage } from './message-footer.js';

const entries = [
  { type: 'model_change', id: 'm0', parentId: null },
  { type: 'message', id: 'u1', parentId: 'm0', message: { role: 'user', content: [{ type: 'text', text: 'faça X' }] } },
  { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'c' }] } },
  { type: 'message', id: 't1', parentId: 'a1', message: { role: 'toolResult', content: [] } },
  { type: 'message', id: 'a2', parentId: 't1', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } },
];

function memStore() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('retry', () => {
  it('finds the user prompt behind an answer, across tool rows', () => {
    expect(retrySource(entries[4], entries)).toEqual({ text: 'faça X', forkAt: 'm0' });
  });

  it('returns null when the prompt has nothing to fork from', () => {
    const e = [{ ...entries[1], parentId: null }, entries[2]];
    expect(retrySource(e[1], e)).toBeNull();
    expect(retrySource(null, entries)).toBeNull();
  });

  it('stashes a prompt once per session', () => {
    const s = memStore();
    stashRetry('n1', 'oi', s);
    expect(takeRetry('n1', s)).toBe('oi');
    expect(takeRetry('n1', s)).toBe('');
  });

  it('forks before the prompt, stashes it for the fork, and navigates', async () => {
    const s = memStore();
    const post = vi.fn().mockResolvedValue({ ok: true, id: 'new.jsonl' });
    const go = vi.fn();
    const id = await retryMessage('s1.jsonl', { text: 'faça X', forkAt: 'm0' }, { post, store: s, go });
    expect(id).toBe('new.jsonl');
    expect(post).toHaveBeenCalledWith('/api/fork-session?id=s1.jsonl', { entryId: 'm0' });
    expect(go).toHaveBeenCalledWith('/session?id=new.jsonl');
    expect(takeRetry('new.jsonl', s)).toBe('faça X');
  });

  it('fails without a fork id and stashes nothing', async () => {
    const s = memStore();
    const post = vi.fn().mockResolvedValue({ error: 'x' });
    await expect(retryMessage('s1', { text: 'a', forkAt: 'b' }, { post, store: s, go: vi.fn() })).rejects.toThrow('x');
  });
});
