import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import SessionContent from './SessionContent.svelte';
import { SessionDataModel } from '../../session/data/session-data.svelte.js';

const entries = [
  { id: 'root', timestamp: '2026-01-01T00:00:00Z', type: 'message', message: { role: 'user', content: 'hi' } },
  { id: 'mid', parentId: 'root', timestamp: '2026-01-01T00:01:00Z', type: 'message', message: { role: 'assistant', content: 'mid' } },
  { id: 'leaf', parentId: 'mid', timestamp: '2026-01-01T00:02:00Z', type: 'message', message: { role: 'user', content: 'leaf' } },
  { id: 'other', parentId: 'root', timestamp: '2026-01-01T00:03:00Z', type: 'message', message: { role: 'assistant', content: 'other branch' } },
];

const renderEntry = (entry) => `<div id="entry-${entry.id}" class="msg">${entry.id}</div>`;

function mount(extra = {}) {
  const model = new SessionDataModel({ entries, header: {}, leafId: 'leaf', ...extra });
  return { model, ...render(SessionContent, { props: { model, renderEntry } }) };
}

describe('SessionContent', () => {
  it('renders the active root→leaf path in order (not off-path branches)', () => {
    const { container } = mount();
    const ids = [...container.querySelectorAll('#messages-list > div')].map((d) => d.id);
    expect(ids).toEqual(['entry-root', 'entry-mid', 'entry-leaf']);
    // 'other' is on a different branch → not rendered
    expect(container.querySelector('#entry-other')).not.toBeInTheDocument();
  });

  it('reactively re-renders the path when the active leaf changes', async () => {
    const { container, model } = mount();
    model.navigateTo('other');
    await Promise.resolve();
    const ids = [...container.querySelectorAll('#messages-list > div')].map((d) => d.id);
    expect(ids).toEqual(['entry-root', 'entry-other']);
  });

  it('reactively appends a new entry that extends the active path (live reload)', async () => {
    const { container, model } = mount();
    const newEntry = { id: 'leaf2', parentId: 'leaf', timestamp: '2026-01-01T00:04:00Z', type: 'message', message: { role: 'assistant', content: 'new' } };
    // Mimic session.js's live reconcile: in-place entries splice + byId refill.
    model.entries.push(newEntry);
    model.byId.set('leaf2', newEntry);
    model.navigateTo('leaf2');
    await Promise.resolve();
    expect(container.querySelector('#entry-leaf2')).toBeInTheDocument();
  });

  it('runs afterRender(container) when the path changes', async () => {
    const afterRender = vi.fn();
    const model = new SessionDataModel({ entries, header: {}, leafId: 'leaf' });
    render(SessionContent, { props: { model, renderEntry, afterRender } });
    await Promise.resolve();
    expect(afterRender).toHaveBeenCalled();
    expect(afterRender.mock.calls[0][0].id).toBe('messages-list');
  });
});
