import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSessionRuntime,
  resetSessionRuntimeContext,
  setSessionRuntime,
} from './session-runtime-context.js';

describe('session runtime context', () => {
  afterEach(() => {
    resetSessionRuntimeContext({ windowImpl: window });
  });

  it('stores an explicit runtime and derives navigateTo from the navigator', () => {
    const navigateTo = vi.fn();
    const model = { entries: [] };
    const runtime = setSessionRuntime({ model, navigator: { navigateTo } }, { windowImpl: null });

    expect(runtime.navigateTo).toBe(navigateTo);
    expect(getSessionRuntime().model).toBe(model);
  });

  it('installs and clears temporary window compatibility shims', () => {
    const model = { entries: [] };
    const navigateTo = vi.fn();
    const reconcileEntries = vi.fn();
    const contentRuntime = { afterRender: null };

    setSessionRuntime({
      model,
      navigateTo,
      navigator: { navigateTo },
      reconcileEntries,
      contentRuntime,
    }, { windowImpl: window });

    expect(window.__piSessionDataModel).toBe(model);
    expect(window.navigateTo).toBe(navigateTo);
    expect(window.__piReconcileEntries).toBe(reconcileEntries);
    expect(window.__piContentRuntime).toBe(contentRuntime);

    resetSessionRuntimeContext({ windowImpl: window });

    expect(getSessionRuntime().model).toBeUndefined();
    expect(window.__piSessionDataModel).toBeUndefined();
    expect(window.navigateTo).toBeUndefined();
    expect(window.__piReconcileEntries).toBeUndefined();
    expect(window.__piContentRuntime).toBeUndefined();
  });
});
