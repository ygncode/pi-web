import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MessageFooter from './MessageFooter.svelte';

const entry = {
  type: 'message',
  id: 'a2',
  timestamp: '2026-11-14T16:00:00.000Z',
  message: {
    role: 'assistant',
    stopReason: 'stop',
    content: [
      { type: 'thinking', thinking: 'segredo' },
      { type: 'text', text: '**ok**' },
    ],
  },
};

describe('MessageFooter', () => {
  it('copies the final markdown and shows Copiado', async () => {
    const user = userEvent.setup();
    const copy = vi.fn().mockResolvedValue(true);
    const { getByLabelText, findByText } = render(MessageFooter, { props: { entry, copy } });
    await user.click(getByLabelText('Copiar resposta'));
    expect(copy).toHaveBeenCalledWith('**ok**');
    expect(await findByText('Copiado')).toBeTruthy();
  });

  it('rates a message and toggles it off', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/session?id=s1.jsonl');
    const rate = vi.fn().mockResolvedValue({ ok: true });
    const ratings = vi.fn().mockResolvedValue({});
    const { getByLabelText } = render(MessageFooter, {
      props: { entry, live: true, rate, ratings },
    });
    await waitFor(() => expect(ratings).toHaveBeenCalledWith('s1.jsonl'));
    const up = getByLabelText('Boa resposta');
    await user.click(up);
    expect(rate).toHaveBeenLastCalledWith('s1.jsonl', 'a2', 1);
    expect(up.getAttribute('aria-pressed')).toBe('true');
    await user.click(up);
    expect(rate).toHaveBeenLastCalledWith('s1.jsonl', 'a2', 0);
  });

  it('is hidden for unfinished or tool-only messages', () => {
    const { container } = render(MessageFooter, {
      props: { entry: { ...entry, message: { ...entry.message, stopReason: 'toolUse' } } },
    });
    expect(container.querySelector('.msg-footer')).toBeNull();
  });
});

describe('MessageFooter retry', () => {
  it('shows Refazer for a live answer with a prompt and calls retry', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/session?id=s9.jsonl');
    const model = {
      entries: [
        { type: 'model_change', id: 'm0', parentId: null },
        { type: 'message', id: 'u1', parentId: 'm0', message: { role: 'user', content: 'oi' } },
        { ...entry, parentId: 'u1' },
      ],
    };
    const retry = vi.fn().mockResolvedValue('x');
    const ratings = vi.fn().mockResolvedValue({});
    const { getByLabelText } = render(MessageFooter, {
      props: { entry: model.entries[2], model, live: true, retry, ratings },
    });
    await user.click(getByLabelText('Refazer resposta'));
    expect(retry).toHaveBeenCalledWith('s9.jsonl', { text: 'oi', forkAt: 'm0' });
  });

  it('hides Refazer in exports (not live)', () => {
    const { queryByLabelText } = render(MessageFooter, { props: { entry } });
    expect(queryByLabelText('Refazer resposta')).toBeNull();
  });
});
