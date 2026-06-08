import { describe, expect, it, vi } from 'vitest';
import { createLiveSessionRuntime, hydrateSessionModel } from './session-page-model.js';
import { resetSessionRuntimeContext } from '../session-runtime-context.js';

function encodeJSON(value) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
}

describe('session page model helpers', () => {
  it('hydrates the reactive model from the encoded payload and creates runtime hooks', () => {
    const payloadBase64 = encodeJSON({
      header: { cwd: '/tmp/project' },
      entries: [{ id: 'root' }, { id: 'leaf' }],
      leafId: 'leaf',
    });
    const sessionModel = {
      load: vi.fn(function load(data) { Object.assign(this, data); }),
      reconcile: vi.fn((entries) => entries),
    };

    hydrateSessionModel({
      sessionModel,
      payloadBase64,
      locationSearch: '?leafId=root&targetId=leaf',
      windowImpl: window,
    });

    expect(sessionModel.load).toHaveBeenCalledOnce();
    expect(sessionModel.header.cwd).toBe('/tmp/project');
    expect(sessionModel.leafId).toBe('root');
    expect(sessionModel.urlTargetId).toBe('leaf');

    const runtime = createLiveSessionRuntime({
      sessionModel,
      contentRuntime: { afterRender: null },
      windowImpl: window,
      documentImpl: document,
    });

    runtime.navigateTo('leaf', 'none');
    runtime.reconcileEntries([{ id: 'next' }]);

    expect(sessionModel.currentLeafId).toBe('leaf');
    expect(sessionModel.currentTargetId).toBe('leaf');
    expect(sessionModel.reconcile).toHaveBeenCalledWith([{ id: 'next' }]);

    resetSessionRuntimeContext({ windowImpl: window });
  });
});
