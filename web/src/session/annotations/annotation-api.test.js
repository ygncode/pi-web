import { describe, expect, it, vi } from 'vitest';
import { createAnnotationApi } from './annotation-api.js';

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('annotation api', () => {
  it('lists annotations for a session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ annotations: [{ id: 'a1' }] }));
    const api = createAnnotationApi({ sessionId: 's 1.jsonl', fetchImpl });
    const out = await api.list();
    expect(out).toEqual([{ id: 'a1' }]);
    expect(fetchImpl).toHaveBeenCalledWith('/api/annotations?session=s%201.jsonl');
  });

  it('returns [] when the payload has no array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    const api = createAnnotationApi({ sessionId: 's1', fetchImpl });
    expect(await api.list()).toEqual([]);
  });

  it('creates an annotation via POST', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ annotation: { id: 'a9' } }));
    const api = createAnnotationApi({ sessionId: 's1', fetchImpl });
    const created = await api.create({ anchorId: 'entry-e1', startOffset: 0, endOffset: 2, text: 'x' });
    expect(created).toEqual({ id: 'a9' });
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/annotations?session=s1');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toMatchObject({ anchorId: 'entry-e1', text: 'x' });
  });

  it('deletes an annotation via DELETE', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const api = createAnnotationApi({ sessionId: 's1', fetchImpl });
    await api.remove('a1');
    expect(fetchImpl).toHaveBeenCalledWith('/api/annotations?session=s1&id=a1', { method: 'DELETE' });
  });

  it('throws on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const api = createAnnotationApi({ sessionId: 's1', fetchImpl });
    await expect(api.list()).rejects.toThrow(/HTTP 500/);
  });
});
