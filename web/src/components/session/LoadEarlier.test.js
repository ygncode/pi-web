import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import LoadEarlier from './LoadEarlier.svelte';

function makeModel() {
  return {
    entries: [{ id: 'new', type: 'message', message: { role: 'user', content: 'new' } }],
    total: 3,
    from: 2,
    truncated: true,
    leafId: 'new',
    reconcile: vi.fn(function (entries) { this.entries = entries; }),
  };
}

describe('LoadEarlier', () => {
  it('loads an earlier window and reconciles the model', async () => {
    const model = makeModel();
    const navigateTo = vi.fn();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ entries: [{ id: 'old' }] }), { status: 200 }));
    render(LoadEarlier, { props: { model, sessionId: 's.jsonl', fetchImpl, navigateTo, windowSize: 1 } });

    expect(screen.getByText('Showing latest 1 of 3 messages.')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Load 1 earlier' }));

    expect(fetchImpl).toHaveBeenCalledWith('/api/session?id=s.jsonl&from=1&count=1');
    await waitFor(() => expect(model.reconcile).toHaveBeenCalledWith([{ id: 'old' }, { id: 'new', type: 'message', message: { role: 'user', content: 'new' } }]));
    expect(navigateTo).toHaveBeenCalledWith('new', 'target', 'new');
    expect(model.from).toBe(1);
    expect(model.truncated).toBe(true);
  });

  it('hides when the model is not truncated', () => {
    const model = makeModel();
    model.truncated = false;
    render(LoadEarlier, { props: { model, sessionId: 's' } });
    expect(document.getElementById('load-earlier-banner')).toBeNull();
  });
});
