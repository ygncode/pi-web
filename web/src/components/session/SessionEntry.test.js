import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import SessionEntry from './SessionEntry.svelte';

afterEach(cleanup);

function model(entries = []) {
  return { entries, renderedTools: null };
}

describe('SessionEntry', () => {
  it('renders a user message with its text under an entry anchor', () => {
    const entry = { id: 'u', type: 'message', message: { role: 'user', content: 'hello' } };
    const { container } = render(SessionEntry, { props: { entry, model: model([entry]) } });
    const node = container.querySelector('#entry-u');
    expect(node).not.toBeNull();
    expect(node).toHaveClass('user-message');
    expect(node.textContent).toContain('hello');
  });

  it('renders an assistant message', () => {
    const entry = { id: 'a', type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] } };
    const { container } = render(SessionEntry, { props: { entry, model: model([entry]) } });
    const node = container.querySelector('#entry-a');
    expect(node).toHaveClass('assistant-message');
    expect(node.textContent).toContain('hi');
  });

  it('renders nothing for tool-result entries', () => {
    const entry = { id: 'r', type: 'message', message: { role: 'toolResult', toolCallId: 'c', content: [] } };
    const { container } = render(SessionEntry, { props: { entry, model: model([entry]) } });
    expect(container.querySelector('#entry-r')).toBeNull();
  });

  it('renders a model change but omits implicit ones', () => {
    const entry = { id: 'm', type: 'model_change', provider: 'p', modelId: 'x' };
    const { container } = render(SessionEntry, { props: { entry, model: model([entry]) } });
    expect(container.querySelector('#entry-m.model-change')?.textContent).toContain('p/x');

    cleanup();
    const implicit = { id: 'm2', type: 'model_change', provider: 'p', modelId: 'x', implicit: true };
    const { container: c2 } = render(SessionEntry, { props: { entry: implicit, model: model([implicit]) } });
    expect(c2.querySelector('#entry-m2')).toBeNull();
  });
});
