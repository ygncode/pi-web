import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSessionPageState,
  firstMessageStub,
  loadSessionPageState,
  newestLeaf,
} from './session-page-data.js';
import { prefetchSession, resetSessionPrefetch } from './session-prefetch.js';

afterEach(() => resetSessionPrefetch());

const btoaImpl = (value) => Buffer.from(value, 'binary').toString('base64');
const decodePayload = (encoded) => JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));

describe('session-page-data', () => {
  it('finds the newest entry id', () => {
    expect(newestLeaf([{ id: 'a' }, {}, { id: 'b' }])).toBe('b');
    expect(newestLeaf([{}, null])).toBe('');
  });

  it('skips the session-header line so a brand-new session does not pick metadata as the leaf', () => {
    expect(newestLeaf([{ type: 'session', id: 'sess-1' }])).toBe('');
    expect(newestLeaf([{ type: 'session', id: 'sess-1' }, { id: 'a' }])).toBe('a');
    expect(newestLeaf([{ id: 'a' }, { type: 'label', id: 'l1' }])).toBe('a');
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
        header: { cwd: '/tmp/project', id: '019-session-uuid' },
        entries: [{ id: 'a' }, { id: 'b' }],
        total: 5,
        from: 3,
        chatAvailable: false,
        model: 'sonnet',
        modelProvider: 'anthropic',
      },
    });

    expect(state.title).toBe('Title');
    expect(state.sessionUUID).toBe('019-session-uuid');
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

  it('only fetches the session on the network path; the scratchpad is the sidebar’s job', async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      if (url.startsWith('/api/session')) {
        return {
          ok: true,
          json: async () => ({ name: 'Loaded', header: { cwd: '/tmp/space path' }, entries: [] }),
        };
      }
      throw new Error(`unexpected url: ${url}`);
    };

    const state = await loadSessionPageState({
      locationSearch: '?id=s.jsonl',
      fetchImpl,
      btoaImpl,
    });

    expect(state.title).toBe('Loaded');
    expect(state.scratchpad).toBe('');
    expect(seen).toEqual(['/api/session?id=s.jsonl&paginate=1']);
  });

  it('uses the embedded bootstrap payload without fetching', async () => {
    const b64utf8 = (value) => Buffer.from(value, 'utf8').toString('base64');
    const bootstrap = b64utf8(
      JSON.stringify({
        id: 's.jsonl',
        data: {
          name: 'Embedded',
          header: { cwd: '/tmp/x' },
          entries: [],
          model: 'haiku',
          modelProvider: 'anthropic',
          chatAvailable: true,
        },
        scratchpad: 'notes',
      }),
    );
    const documentImpl = {
      getElementById: (id) => (id === 'pi-session-bootstrap' ? { textContent: bootstrap } : null),
    };
    let fetched = false;
    const fetchImpl = async () => {
      fetched = true;
      throw new Error('should not fetch when bootstrap is present');
    };

    const state = await loadSessionPageState({
      locationSearch: '?id=s.jsonl',
      fetchImpl,
      btoaImpl,
      documentImpl,
    });

    expect(fetched).toBe(false);
    expect(state.title).toBe('Embedded');
    expect(state.scratchpad).toBe('notes');
    expect(state.modelLabel).toBe('haiku @ anthropic');
  });

  it('reuses a prefetched /api/session payload instead of fetching again', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({ name: 'Prefetched', header: { cwd: '/p' }, entries: [] }),
      };
    };

    prefetchSession('s.jsonl', { fetchImpl });
    const state = await loadSessionPageState({
      locationSearch: '?id=s.jsonl',
      fetchImpl,
      btoaImpl,
    });

    expect(state.title).toBe('Prefetched');
    // Only one /api/session call total, the one started by prefetchSession.
    expect(calls).toEqual(['/api/session?id=s.jsonl&paginate=1']);
  });

  it('falls back to a fresh fetch when the prefetch rejects', async () => {
    let attempt = 0;
    const fetchImpl = async () => {
      attempt++;
      if (attempt === 1) return { ok: false, status: 500 };
      return {
        ok: true,
        json: async () => ({ name: 'Recovered', header: {}, entries: [] }),
      };
    };

    prefetchSession('s.jsonl', { fetchImpl });
    const state = await loadSessionPageState({
      locationSearch: '?id=s.jsonl',
      fetchImpl,
      btoaImpl,
    });

    expect(state.title).toBe('Recovered');
    expect(attempt).toBe(2);
  });

  it('falls back to fetch when the bootstrap is for a different session', async () => {
    const b64utf8 = (value) => Buffer.from(value, 'utf8').toString('base64');
    const bootstrap = b64utf8(
      JSON.stringify({ id: 'other.jsonl', data: { name: 'Other', entries: [] } }),
    );
    const documentImpl = {
      getElementById: (id) => (id === 'pi-session-bootstrap' ? { textContent: bootstrap } : null),
    };
    let fetched = false;
    const fetchImpl = async (url) => {
      fetched = true;
      if (url.startsWith('/api/session')) {
        return { ok: true, json: async () => ({ name: 'Fetched', header: {}, entries: [] }) };
      }
      return { ok: true, json: async () => ({ content: '' }) };
    };

    const state = await loadSessionPageState({
      locationSearch: '?id=s.jsonl',
      fetchImpl,
      btoaImpl,
      documentImpl,
    });

    expect(fetched).toBe(true);
    expect(state.title).toBe('Fetched');
  });
});
