import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SessionInfoHeader from './SessionInfoHeader.svelte';
import { SessionDataModel } from '../../session/data/session-data.svelte.js';

function mount(overrides = {}) {
  const model = new SessionDataModel({
    header: { id: 'sid-123', timestamp: '2026-01-01T00:00:00Z' },
    entries: [
      { id: 'u', type: 'message', message: { role: 'user' }, timestamp: '2026-01-01T00:00:00Z' },
      { id: 'a', parentId: 'u', type: 'message', timestamp: '2026-01-01T00:00:01Z',
        message: { role: 'assistant', model: 'm', usage: { input: 1200 }, content: [{ type: 'toolCall' }] } },
    ],
    ...overrides,
  });
  return { model, ...render(SessionInfoHeader, { props: { model } }) };
}

describe('SessionInfoHeader', () => {
  it('renders session id, stats and the toggle/download buttons', () => {
    const { container } = mount();
    expect(screen.getByText('Session: sid-123')).toBeInTheDocument();
    expect(container.querySelector('[data-action="toggle-thinking"]')).toBeInTheDocument();
    expect(container.querySelector('[data-action="toggle-tools"]')).toBeInTheDocument();
    expect(container.querySelector('[data-action="toggle-tool-output"]')).toBeInTheDocument();
    expect(container.querySelector('.download-json-btn')).toBeInTheDocument();
    // messages summary reflects the entries
    expect(container.textContent).toContain('1 user, 1 assistant');
    expect(container.textContent).toContain('↑1.2k');
  });

  it('renders an expandable system prompt and toggles on click', async () => {
    const { container } = mount({ systemPrompt: Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n') });
    const block = container.querySelector('.system-prompt.expandable');
    expect(block).toBeInTheDocument();
    expect(block).not.toHaveClass('expanded');
    expect(container.textContent).toContain('more lines, click to expand');
    await userEvent.click(block);
    expect(block).toHaveClass('expanded');
  });

  it('renders tools and expands params on click', async () => {
    const { container } = mount({
      tools: [{ name: 'read', description: 'Read file', parameters: { required: ['path'], properties: { path: { type: 'string', description: 'the path' } } } }],
    });
    const item = container.querySelector('.tool-item');
    expect(item).toBeInTheDocument();
    expect(container.querySelector('.tool-item-name').textContent).toBe('read');
    expect(container.querySelector('.tool-param-required')).toBeInTheDocument();
    await userEvent.click(item);
    expect(item).toHaveClass('params-expanded');
  });

  it('escapes session id and prompt text (no raw HTML injection)', () => {
    const { container } = mount({ header: { id: '<sid>' }, systemPrompt: '<b>x</b>' });
    expect(container.querySelector('h1').textContent).toBe('Session: <sid>');
    expect(container.querySelector('h1').innerHTML).toContain('&lt;sid&gt;');
  });
});
