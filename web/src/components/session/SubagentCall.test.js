import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import SubagentCall from './SubagentCall.svelte';
import { recordToolProgress, _resetLiveProgress } from '../../session/ui/subagent-view.js';

const call = { id: 'c9', name: 'subagent', arguments: { tasks: [{ agent: 'scout', task: 'a' }, { agent: 'reviewer', task: 'b' }] } };

describe('SubagentCall', () => {
  it('renders planned tasks then live progress', async () => {
    _resetLiveProgress();
    const { container, getByText } = render(SubagentCall, { props: { call } });
    expect(container.querySelectorAll('.subagent-run').length).toBe(2);
    expect(getByText('reviewer')).toBeTruthy();
    recordToolProgress({
      toolCallId: 'c9',
      details: { mode: 'parallel', results: [{ agent: 'scout', task: 'a', status: 'running', items: [{ kind: 'tool', name: 'grep', text: 'x' }] }, { agent: 'reviewer', task: 'b', status: 'pending' }] },
    });
    await waitFor(() => expect(container.querySelector('[data-status="running"]')).toBeTruthy());
    expect(getByText('grep')).toBeTruthy();
  });

  it('renders the final result with output toggle', async () => {
    const result = {
      details: {
        mode: 'parallel',
        results: [
          { agent: 'scout', task: 'a', exitCode: 0, model: 'router/glm-5.3', messages: [{ role: 'assistant', content: [{ type: 'text', text: 'feito' }] }] },
          { agent: 'reviewer', task: 'b', exitCode: 0, messages: [{ role: 'assistant', content: [{ type: 'text', text: 'ok' }] }] },
        ],
      },
    };
    const { container, getAllByText, getByText } = render(SubagentCall, { props: { call, result } });
    expect(container.querySelectorAll('[data-status="completed"]').length).toBe(2);
    expect(getByText('router/glm-5.3')).toBeTruthy();
    getAllByText('ver saída')[0].click();
    await waitFor(() => expect(getByText('feito')).toBeTruthy());
  });
});
