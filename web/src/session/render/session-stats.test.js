import { describe, expect, it } from 'vitest';
import { computeSessionStats, formatTokens, summarizeSessionStats } from './session-stats.js';

describe('session stats', () => {
  it('computes message/tool/model stats', () => {
    const stats = computeSessionStats([
      { type: 'message', message: { role: 'user' } },
      { type: 'message', message: { role: 'assistant', provider: 'p', model: 'm', usage: { input: 1000 }, content: [{ type: 'toolCall' }] } },
      { type: 'message', message: { role: 'toolResult' } },
      { type: 'model_change', provider: 'q', modelId: 'n' },
      { type: 'compaction' },
    ]);
    expect(stats.userMessages).toBe(1);
    expect(stats.assistantMessages).toBe(1);
    expect(stats.toolResults).toBe(1);
    expect(stats.compactions).toBe(1);
    expect(stats.toolCalls).toBe(1);
    expect(stats.models).toEqual(['p/m', 'q/n']);
    expect(stats.tokens.input).toBe(1000);
  });

  it('formats token counts', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1500)).toBe('1.5k');
    expect(formatTokens(25000)).toBe('25k');
    expect(formatTokens(2_000_000)).toBe('2.0M');
  });

  it('summarizes stats into header strings', () => {
    const summary = summarizeSessionStats(computeSessionStats([
      { type: 'message', message: { role: 'user' } },
      { type: 'message', message: { role: 'assistant', model: 'm', usage: { input: 1200, output: 500, cost: { input: 0.01 } } } },
    ]));
    expect(summary.messagesText).toBe('1 user, 1 assistant');
    expect(summary.tokensText).toBe('↑1.2k ↓500');
    expect(summary.modelsText).toBe('m');
    expect(summary.costText).toBe('$0.010');
  });

  it('falls back to placeholders for an empty session', () => {
    const summary = summarizeSessionStats(computeSessionStats([]));
    expect(summary.messagesText).toBe('0');
    expect(summary.tokensText).toBe('0');
    expect(summary.modelsText).toBe('unknown');
  });
});
