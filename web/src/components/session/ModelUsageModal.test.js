import { afterEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup } from '@testing-library/svelte';
import ModelUsageModal from './ModelUsageModal.svelte';

afterEach(cleanup);

const mockEntries = [
  {
    type: 'message',
    message: {
      role: 'assistant', model: 'claude-sonnet-4-20250514', provider: 'anthropic',
      usage: { input: 5000, output: 2000, cacheRead: 1000, cacheWrite: 500, cost: { input: 0.015, output: 0.006, cacheRead: 0.001, cacheWrite: 0.001 } },
      content: [{ type: 'toolCall' }, { type: 'toolCall' }],
    },
  },
  {
    type: 'message',
    message: {
      role: 'assistant', model: 'claude-sonnet-4-20250514', provider: 'anthropic',
      usage: { input: 3000, output: 1000, cacheRead: 500, cacheWrite: 200, cost: { input: 0.009, output: 0.003, cacheRead: 0.0005, cacheWrite: 0.0002 } },
      content: [],
    },
  },
  {
    type: 'message',
    message: {
      role: 'assistant', model: 'deepseek-v4-pro', provider: 'deepseek',
      usage: { input: 1000, output: 500, cost: { input: 0.001, output: 0.0005 } },
      content: [{ type: 'toolCall' }],
    },
  },
];

async function open(entries) {
  const r = render(ModelUsageModal, { props: { open: true, model: { entries } } });
  await tick();
  return r;
}

describe('ModelUsageModal', () => {
  it('renders computed cost, token, model, and tool-call stats', async () => {
    await open(mockEntries);
    const text = document.querySelector('.pi-sheet-body').textContent;
    expect(text).toContain('Total cost');
    expect(text).toContain('$0.037');
    expect(text).toContain('Input');
    expect(text).toContain('Output');
    expect(text).toContain('9.0k');
    expect(text).toContain('3.5k');
    expect(text).toContain('Claude Sonnet 4');
    expect(text).toContain('Deepseek V4 Pro');
    expect(text).toContain('Tool calls');
  });

  it('uses the raw model name as the title attribute', async () => {
    await open(mockEntries);
    const titles = [...document.querySelectorAll('.mu-model-name')].map((el) => el.getAttribute('title'));
    expect(titles).toContain('anthropic/claude-sonnet-4-20250514');
    expect(titles).toContain('deepseek/deepseek-v4-pro');
  });

  it('filters out zero-value token rows', async () => {
    await open([
      { type: 'message', message: { role: 'assistant', model: 'm', provider: 'p', usage: { input: 1000 }, content: [] } },
    ]);
    const text = document.querySelector('.pi-sheet-body').textContent;
    expect(text).toContain('Input');
    expect(text).not.toContain('Output');
    expect(text).not.toContain('Cache read');
  });

  it('escapes model names (no raw script element)', async () => {
    await open([
      { type: 'message', message: { role: 'assistant', model: 'evil/<script>alert(1)</script>', usage: { input: 100 }, content: [] } },
    ]);
    const body = document.querySelector('.pi-sheet-body');
    // The model name is rendered as text (Svelte auto-escapes), so no real
    // <script> element is created; the payload survives only as inert text.
    expect(body.querySelector('script')).toBeNull();
    const name = body.querySelector('.mu-model-name');
    expect(name.textContent).toContain('Alert(1)');
    expect(name.querySelector('script')).toBeNull();
  });

  it('does not throw on malformed entries', async () => {
    await expect(open([
      { type: 'message' },
      { type: 'message', message: {} },
      { type: 'message', message: { role: 'assistant', model: 'x', content: 'not-array' } },
    ])).resolves.toBeTruthy();
  });
});
