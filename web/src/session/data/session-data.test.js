import { describe, expect, it } from 'vitest';
import { buildSessionLookups, createSessionDataModel, decodeBase64JSON, getSessionSearchParams } from './session-data.js';

function b64(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

describe('session data helpers', () => {
  it('decodes base64 encoded UTF-8 JSON', () => {
    expect(decodeBase64JSON(b64({ text: 'hello π' }), { atobImpl: (s) => Buffer.from(s, 'base64').toString('binary') })).toEqual({ text: 'hello π' });
  });

  it('builds entry, tool call, and label lookups', () => {
    const entries = [
      { id: 'u1', type: 'message', message: { role: 'user', content: 'hi' } },
      { id: 'a1', type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'tc1', name: 'read', arguments: { path: 'x' } }] } },
      { id: 'l1', type: 'label', targetId: 'a1', label: 'Important' }
    ];
    const lookups = buildSessionLookups(entries);
    expect(lookups.byId.get('u1')).toBe(entries[0]);
    expect(lookups.toolCallMap.get('tc1')).toEqual({ name: 'read', arguments: { path: 'x' } });
    expect(lookups.labelMap.get('a1')).toBe('Important');
  });

  it('applies label clear entries when building label lookups', () => {
    const entries = [
      { id: 'a1', type: 'message', message: { role: 'assistant', content: 'done' } },
      { id: 'l1', type: 'label', targetId: 'a1', label: 'Important' },
      { id: 'l2', type: 'label', targetId: 'a1' }
    ];
    const lookups = buildSessionLookups(entries);
    expect(lookups.labelMap.has('a1')).toBe(false);
  });

  it('prefers deep linked leaf id over default leaf id', () => {
    const model = createSessionDataModel({ leafId: 'default', entries: [] }, new URLSearchParams('leafId=linked&targetId=t1'));
    expect(model.defaultLeafId).toBe('default');
    expect(model.leafId).toBe('linked');
    expect(model.urlTargetId).toBe('t1');
  });

  it('reads injected iframe params before window location params', () => {
    const doc = document.implementation.createHTMLDocument('test');
    const meta = doc.createElement('meta');
    meta.setAttribute('name', 'pi-url-params');
    meta.setAttribute('content', 'leafId=injected');
    doc.head.appendChild(meta);
    const params = getSessionSearchParams({ documentImpl: doc, windowImpl: { location: { search: '?leafId=window' } } });
    expect(params.get('leafId')).toBe('injected');
  });
});
