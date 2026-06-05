import { describe, expect, it } from 'vitest';
import { buildSessionPageState, firstMessageStub, loadSessionPageState, newestLeaf } from './session-page-data.js';

const btoaImpl = (value) => Buffer.from(value, 'binary').toString('base64');
const decodePayload = (encoded) => JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));

describe('session-page-data', () => {
  it('finds the newest entry id', () => {
    expect(newestLeaf([{ id: 'a' }, {}, { id: 'b' }])).toBe('b');
    expect(newestLeaf([{}, null])).toBe('');
  });

  it('renders an escaped first-message stub', () => {
    const html = firstMessageStub([
      { type: 'message', message: { role: 'user', content: '<hello> & bye' } },
    ]);
    expect(html).toContain('&lt;hello&gt; &amp; bye');
    expect(html).not.toContain('<hello>');
  });

  it('builds state and encoded payload from API data', () => {
    const state = buildSessionPageState({
      sessionId: 's.jsonl',
      scratchpad: 'notes',
      btoaImpl,
      data: {
        name: 'Title',
        header: { cwd: '/tmp/project' },
        entries: [{ id: 'a' }, { id: 'b' }],
        total: 5,
        from: 3,
        chatAvailable: false,
        model: 'sonnet',
        modelProvider: 'anthropic',
      },
    });

    expect(state.title).toBe('Title');
    expect(state.cwd).toBe('/tmp/project');
    expect(state.scratchpad).toBe('notes');
    expect(state.chatAvailable).toBe(false);
    expect(state.chatDisabledReason).toContain('chat is disabled');
    expect(state.modelLabel).toBe('sonnet @ anthropic');
    expect(decodePayload(state.payloadBase64)).toMatchObject({
      name: 'Title',
      leafId: 'b',
      total: 5,
      from: 3,
      truncated: true,
    });
  });

  it('loads session and scratchpad data via fetch', async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      if (url.startsWith('/api/session')) {
        return {
          ok: true,
          json: async () => ({ name: 'Loaded', header: { cwd: '/tmp/space path' }, entries: [] }),
        };
      }
      if (url.startsWith('/api/scratchpad')) {
        return { ok: true, json: async () => ({ content: 'pad' }) };
      }
      throw new Error('unexpected url');
    };

    const state = await loadSessionPageState({ locationSearch: '?id=s.jsonl', fetchImpl, btoaImpl });

    expect(state.title).toBe('Loaded');
    expect(state.scratchpad).toBe('pad');
    expect(seen).toEqual([
      '/api/session?id=s.jsonl',
      '/api/scratchpad?project=%2Ftmp%2Fspace%20path',
    ]);
  });
});
