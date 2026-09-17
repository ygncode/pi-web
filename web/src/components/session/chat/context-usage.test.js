import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildContextWindows,
  collectContextUsage,
  createContextUsageController,
  getModelContextLimit,
  updateContextUsage,
} from './context-usage.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function renderDom() {
  document.body.innerHTML = `
    <div id="pi-chat-context-usage" style="display:none">
      <svg><path class="pi-context-fill" stroke-dasharray="0, 100"></path></svg>
      <span class="pi-context-text">0%</span>
    </div>
    <div id="pi-chat-context-popover" style="display:none">
      <span class="pi-popover-used"></span>
      <span class="pi-popover-limit"></span>
      <div class="pi-popover-progress-bar"></div>
      <span id="pi-popover-val-input"></span>
      <span id="pi-popover-val-cache-read"></span>
      <span id="pi-popover-val-cache-write"></span>
      <span id="pi-popover-val-output"></span>
      <span id="pi-popover-val-total"></span>
    </div>
  `;
}

describe('context usage helpers', () => {
  it('builds model/provider context-window lookups', () => {
    const windows = buildContextWindows([
      { id: 'DEEPSEEK-V4-PRO', provider: 'DEEPSEEK', contextWindow: 1234567 },
    ]);
    expect(windows['deepseek-v4-pro']).toBe(1234567);
    expect(windows['deepseek/deepseek-v4-pro']).toBe(1234567);
    expect(getModelContextLimit('DEEPSEEK-V4-PRO', 'DEEPSEEK', windows)).toBe(1234567);
  });

  it('uses fallback model limits', () => {
    expect(getModelContextLimit('gemini-1.5-flash')).toBe(1000000);
    expect(getModelContextLimit('claude-sonnet-4')).toBe(200000);
    expect(getModelContextLimit('llama-2-7b')).toBe(4096);
    expect(getModelContextLimit('unknown-model')).toBe(128000);
  });

  it('collects cumulative I/O but uses the last assistant for context pressure', () => {
    const usage = collectContextUsage([
      {
        type: 'message',
        message: {
          role: 'assistant',
          usage: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 1000 },
        },
      },
      { type: 'message', message: { role: 'user', content: 'follow-up' } },
      {
        type: 'message',
        message: {
          role: 'assistant',
          usage: { input: 500, output: 300, cacheRead: 1000, cacheWrite: 0 },
        },
      },
    ]);

    expect(usage.inputTokens).toBe(1500);
    expect(usage.outputTokens).toBe(800);
    expect(usage.cacheReadTokens).toBe(1000);
    expect(usage.cacheWriteTokens).toBe(1000);
    expect(usage.totalIOTokens).toBe(4300);
    expect(usage.contextTokens).toBe(1800);
  });

  it('ignores a streaming assistant entry that has no measured usage yet', () => {
    const usage = collectContextUsage([
      {
        type: 'message',
        message: { role: 'assistant', usage: { input: 5000, output: 200 } },
      },
      { type: 'message', message: { role: 'user', content: 'follow-up' } },
      {
        type: 'message',
        message: { role: 'assistant', usage: { input: 0, output: 0, cacheRead: 0 } },
      },
    ]);

    expect(usage.contextTokens).toBe(5200);
  });
});

describe('updateContextUsage', () => {
  it('updates the capsule and popover values', () => {
    renderDom();

    updateContextUsage({
      documentImpl: document,
      knownModelLabel: 'gpt-4o @ openai',
      entries: [
        {
          type: 'message',
          message: {
            role: 'assistant',
            usage: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 1000 },
          },
        },
        {
          type: 'message',
          message: {
            role: 'assistant',
            usage: { input: 500, output: 300, cacheRead: 1000, cacheWrite: 0 },
          },
        },
      ],
    });

    const el = document.getElementById('pi-chat-context-usage');
    expect(el.style.display).toBe('inline-flex');
    expect(el.querySelector('.pi-context-text').textContent).toBe('1%');
    expect(el.querySelector('.pi-context-fill').getAttribute('stroke-dasharray')).toBe('1, 100');
    expect(document.getElementById('pi-popover-val-total').textContent).toBe('4.3k');
    expect(document.querySelector('.pi-popover-used').textContent).toBe('1.8k');
    expect(document.querySelector('.pi-popover-limit').textContent).toBe('128k');
  });

  it('repositions the popover when visible', () => {
    renderDom();
    document.getElementById('pi-chat-context-popover').style.display = 'block';
    const positionPopover = vi.fn();

    updateContextUsage({
      documentImpl: document,
      entries: [{ type: 'message', message: { role: 'assistant', usage: { totalTokens: 90000 } } }],
      positionPopover,
    });

    expect(positionPopover).toHaveBeenCalledTimes(1);
  });

  it('loads dynamic limits in the controller', async () => {
    renderDom();
    const controller = createContextUsageController({
      documentImpl: document,
      entries: [
        { type: 'message', message: { role: 'assistant', usage: { input: 1000, output: 500 } } },
      ],
      getKnownModelLabel: () => 'DEEPSEEK-V4-PRO @ DEEPSEEK',
      chatApi: {
        listModels: () =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ id: 'DEEPSEEK-V4-PRO', provider: 'DEEPSEEK', contextWindow: 1234567 }],
              }),
          }),
      },
    });

    controller.update();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.pi-popover-limit').textContent).toBe('1.2M');
  });

  it('holds the last value while streaming entries arrive without usage', () => {
    renderDom();
    const entries = [
      {
        type: 'message',
        message: { role: 'assistant', usage: { input: 60000, output: 4000 } },
      },
    ];
    const controller = createContextUsageController({
      documentImpl: document,
      entries,
      getKnownModelLabel: () => 'gpt-4o @ openai',
    });

    controller.update();
    const el = document.getElementById('pi-chat-context-usage');
    expect(el.querySelector('.pi-context-text').textContent).toBe('50%');

    // A half-written assistant entry (and then a tool result) must not drop the
    // indicator to 0% or hide it.
    entries.push({ type: 'message', message: { role: 'assistant', usage: {} } });
    controller.update();
    expect(el.querySelector('.pi-context-text').textContent).toBe('50%');
    expect(el.style.display).toBe('inline-flex');

    entries.push({ type: 'message', message: { role: 'toolResult', content: 'ok' } });
    controller.update();
    expect(el.querySelector('.pi-context-text').textContent).toBe('50%');
    expect(el.style.display).toBe('inline-flex');

    entries[1].message.usage = { input: 70000, output: 6000 };
    controller.update();
    expect(el.querySelector('.pi-context-text').textContent).toBe('59%');
  });

  it('keeps the last limit when the model label is momentarily unknown', () => {
    renderDom();
    const entries = [
      { type: 'message', message: { role: 'assistant', usage: { totalTokens: 100000 } } },
    ];
    let label = 'claude-sonnet-4 @ anthropic';
    const controller = createContextUsageController({
      documentImpl: document,
      entries,
      getKnownModelLabel: () => label,
    });

    controller.update();
    const text = document.querySelector('.pi-context-text');
    expect(text.textContent).toBe('50%');

    label = '';
    controller.update();
    expect(text.textContent).toBe('50%');
  });

  it('waits for the model registry before the first paint', async () => {
    renderDom();
    let resolveModels;
    const controller = createContextUsageController({
      documentImpl: document,
      entries: [
        { type: 'message', message: { role: 'assistant', usage: { totalTokens: 100000 } } },
      ],
      getKnownModelLabel: () => 'DEEPSEEK-V4-PRO @ DEEPSEEK',
      chatApi: {
        listModels: () => new Promise((resolve) => (resolveModels = resolve)),
      },
    });

    controller.update();
    const el = document.getElementById('pi-chat-context-usage');
    expect(el.style.display).toBe('none');

    resolveModels({
      ok: true,
      json: () =>
        Promise.resolve({
          models: [{ id: 'DEEPSEEK-V4-PRO', provider: 'DEEPSEEK', contextWindow: 1000000 }],
        }),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.style.display).toBe('inline-flex');
    expect(el.querySelector('.pi-context-text').textContent).toBe('10%');
  });

  it('still paints when the model registry fetch fails', async () => {
    renderDom();
    createContextUsageController({
      documentImpl: document,
      entries: [{ type: 'message', message: { role: 'assistant', usage: { totalTokens: 64000 } } }],
      getKnownModelLabel: () => 'gpt-4o @ openai',
      chatApi: { listModels: () => Promise.reject(new Error('offline')) },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const el = document.getElementById('pi-chat-context-usage');
    expect(el.style.display).toBe('inline-flex');
    expect(el.querySelector('.pi-context-text').textContent).toBe('50%');
  });
});
