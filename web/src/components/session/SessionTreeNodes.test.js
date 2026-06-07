import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SessionTreeNodes from './SessionTreeNodes.svelte';
import { SessionDataModel } from '../../session/data/session-data.svelte.js';

// root → (old) and root → mid → leaf
const entries = [
  { id: 'root', timestamp: '2026-01-01T00:00:00Z', type: 'message', message: { role: 'user', content: 'hello world' } },
  { id: 'old', parentId: 'root', timestamp: '2026-01-01T00:01:00Z', type: 'message', message: { role: 'assistant', content: 'old branch reply' } },
  { id: 'mid', parentId: 'root', timestamp: '2026-01-01T00:02:00Z', type: 'message', message: { role: 'assistant', content: 'mid reply' } },
  { id: 'leaf', parentId: 'mid', timestamp: '2026-01-01T00:03:00Z', type: 'message', message: { role: 'user', content: 'tell me about widgets' } },
];

function mount(extra = {}) {
  const model = new SessionDataModel({ entries, header: {}, leafId: 'leaf', ...extra });
  const utils = render(SessionTreeNodes, { props: { model } });
  return { model, ...utils };
}

describe('SessionTreeNodes', () => {
  it('renders one .tree-node per visible node with the active path marked', () => {
    const { container } = mount();
    const ids = [...container.querySelectorAll('.tree-node')].map((n) => n.dataset.id);
    expect(ids).toEqual(expect.arrayContaining(['root', 'old', 'mid', 'leaf']));
    // active path root→mid→leaf carries in-path; 'old' is off-path
    expect(container.querySelector('[data-id="leaf"]')).toHaveClass('in-path');
    expect(container.querySelector('[data-id="old"]')).not.toHaveClass('in-path');
  });

  it('renders the status line as "<filtered> / <total> entries"', () => {
    const { container, model } = mount();
    expect(container.querySelector('#tree-status').textContent).toBe(
      `${model.filteredNodes.length} / ${model.flatNodes.length} entries`,
    );
  });

  it('navigates to the newest leaf under a clicked node and sets it as target', async () => {
    const { container, model } = mount();
    await userEvent.click(container.querySelector('[data-id="root"]'));
    // newest leaf under root is 'leaf'; clicked node 'root' becomes the target
    expect(model.currentLeafId).toBe('leaf');
    expect(model.currentTargetId).toBe('root');
  });

  it('reactively grows the sidebar when entries are appended (live reload)', async () => {
    const { container, model } = mount();
    expect(container.querySelector('[data-id="leaf2"]')).not.toBeInTheDocument();
    // mimic session.js's in-place splice on the reactive entries array
    model.entries.push({
      id: 'leaf2', parentId: 'leaf', timestamp: '2026-01-01T00:04:00Z',
      type: 'message', message: { role: 'assistant', content: 'appended' },
    });
    await Promise.resolve();
    expect(container.querySelector('[data-id="leaf2"]')).toBeInTheDocument();
  });

  it('reactively re-renders the node list when the search filter changes', async () => {
    const { container, model } = mount();
    const before = container.querySelectorAll('.tree-node').length;
    model.searchQuery = 'widgets';
    await Promise.resolve();
    const after = container.querySelectorAll('.tree-node').length;
    expect(after).toBeLessThan(before);
    expect(container.querySelector('[data-id="leaf"]')).toBeInTheDocument();
  });
});
