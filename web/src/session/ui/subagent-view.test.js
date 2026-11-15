import { describe, expect, it, vi } from 'vitest';
import {
  subagentView,
  subagentSummary,
  plannedTasks,
  usageLine,
  recordToolProgress,
  liveProgress,
  _resetLiveProgress,
  TOOL_PROGRESS_EVENT,
} from './subagent-view.js';

const args = { tasks: [{ agent: 'scout', task: 'models' }, { agent: 'scout', task: 'providers' }] };

describe('subagent view', () => {
  it('plans from args before any progress', () => {
    expect(plannedTasks({ chain: [{ agent: 'scout' }, { agent: 'planner' }] }).mode).toBe('chain');
    const v = subagentView(args, null);
    expect(v.mode).toBe('parallel');
    expect(v.runs.map((r) => r.status)).toEqual(['pending', 'pending']);
    expect(subagentSummary(v)).toBe('paralelo · 0/2 concluídos');
  });

  it('uses compact live progress', () => {
    const v = subagentView(args, {
      mode: 'parallel',
      results: [
        { agent: 'scout', task: 'models', status: 'completed', output: 'achei', items: [] },
        { agent: 'scout', task: 'providers', status: 'running', items: [{ kind: 'tool', name: 'grep', text: '{}' }] },
      ],
    });
    expect(v.done).toBe(1);
    expect(v.runs[1].items[0].name).toBe('grep');
    expect(v.runs[0].output).toBe('achei');
  });

  it('derives output and status from final transcripts', () => {
    const v = subagentView(
      { chain: [{ agent: 'scout', task: 'a' }, { agent: 'planner', task: '{previous}' }] },
      {
        mode: 'chain',
        results: [
          { agent: 'scout', task: 'a', exitCode: 0, step: 1, messages: [{ role: 'assistant', content: [{ type: 'text', text: 'ctx' }] }] },
          { agent: 'planner', task: 'ctx', exitCode: 1, step: 2, messages: [], errorMessage: 'boom' },
        ],
      },
      { final: true },
    );
    expect(v.runs[0]).toMatchObject({ status: 'completed', output: 'ctx', step: 1 });
    expect(v.runs[1]).toMatchObject({ status: 'failed', error: 'boom', step: 2 });
    expect(subagentSummary(v)).toBe('cadeia · 1/2 concluídos · 1 falha');
  });

  it('formats usage', () => {
    expect(usageLine({ turns: 3, input: 12000, output: 800, cost: 0.0123 })).toBe('3 turnos ↑12.0k ↓800 $0.0123');
    expect(usageLine(null)).toBe('');
  });

  it('records live progress and dispatches an event', () => {
    _resetLiveProgress();
    const spy = vi.fn();
    window.addEventListener(TOOL_PROGRESS_EVENT, spy);
    recordToolProgress({ toolCallId: 'c1', details: { mode: 'single', results: [] } }, window);
    expect(liveProgress('c1')).toEqual({ mode: 'single', results: [] });
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener(TOOL_PROGRESS_EVENT, spy);
  });
});
