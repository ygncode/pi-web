import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ToolCall from './ToolCall.svelte';

afterEach(cleanup);

function model({ entries = [], renderedTools = null } = {}) {
  return { entries, renderedTools };
}

describe('ToolCall', () => {
  it('renders a custom tool as escaped JSON when no pre-rendered HTML exists', () => {
    const call = { id: 'call-1', name: 'custom_tool', arguments: { value: '<x>' } };
    const { container } = render(ToolCall, { props: { call, model: model() } });
    expect(container.querySelector('.tool-name')?.textContent).toBe('custom_tool');
    // textContent decodes entities, so the raw chars appear (proving they were escaped in HTML).
    expect(container.querySelector('pre')?.textContent).toContain('"value": "<x>"');
  });

  it('renders pre-rendered custom-tool HTML', () => {
    const call = { id: 'call-1', name: 'custom_tool', arguments: {} };
    const { container } = render(ToolCall, {
      props: { call, model: model({ renderedTools: { 'call-1': { callHtml: '<span>custom rendered</span>' } } }) },
    });
    expect(container.textContent).toContain('custom rendered');
  });

  it('renders a bash command', () => {
    const call = { id: 'b', name: 'bash', arguments: { command: 'ls -la' } };
    const { container } = render(ToolCall, { props: { call, model: model() } });
    expect(container.querySelector('.tool-command')?.textContent).toContain('ls -la');
  });

  it('renders an ask_user_question card with clickable options', () => {
    const call = {
      id: 'q', name: 'ask_user_question',
      arguments: { questions: [{ question: 'Pick one', options: [{ label: 'A' }, { label: 'B' }] }] },
    };
    const { container } = render(ToolCall, { props: { call, model: model() } });
    expect(container.querySelector('.ask-question-card')).not.toBeNull();
    const opts = container.querySelectorAll('.ask-question-option-action');
    expect(opts.length).toBe(2);
    expect(opts[0].dataset.answer).toBe('A');
  });

  it('marks multi-select questions as needing submit', () => {
    const call = {
      id: 'q', name: 'pi_web_ask_user_question',
      arguments: { questions: [{ question: 'Pick many', multiSelect: true, options: [{ label: 'A' }] }] },
    };
    const { container } = render(ToolCall, { props: { call, model: model() } });
    expect(container.querySelector('.ask-question-card')?.dataset.needsSubmit).toBe('true');
    expect(container.querySelector('.ask-question-block')?.dataset.multiSelect).toBe('true');
  });
});
