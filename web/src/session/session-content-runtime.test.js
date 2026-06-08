import { afterEach, describe, expect, it, vi } from 'vitest';
import { wireSessionContentRuntime } from './session-content-runtime.js';
import { resetSessionModals } from './session-modals.svelte.js';
import { resetSessionRuntime } from './session-runtime.js';

describe('wireSessionContentRuntime', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    resetSessionModals();
    resetSessionRuntime();
    vi.restoreAllMocks();
  });

  it('removes delegated listeners and restores downloadSessionJson on dispose', () => {
    document.body.innerHTML = '<div id="messages"><button class="label-btn" data-entry-id="e1"></button></div>';
    const previousDownload = vi.fn();
    const add = vi.spyOn(document.getElementById('messages'), 'addEventListener');
    const remove = vi.spyOn(document.getElementById('messages'), 'removeEventListener');
    window.downloadSessionJson = previousDownload;

    const { dispose } = wireSessionContentRuntime({
      windowImpl: window,
      documentImpl: document,
      model: {
        entries: [],
        header: {},
        toolCallMap: new Map(),
        labelMap: new Map(),
      },
      sessionId: 's.jsonl',
      contentRuntime: { afterRender: null },
      applyLazyHighlighting: vi.fn(),
    });

    expect(add).toHaveBeenCalledWith('click', expect.any(Function));
    expect(window.downloadSessionJson).not.toBe(previousDownload);

    dispose();

    expect(remove).toHaveBeenCalledWith('click', add.mock.calls[0][1]);
    expect(window.downloadSessionJson).toBe(previousDownload);
  });
});
