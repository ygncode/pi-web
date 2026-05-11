import { describe, expect, it } from 'vitest';
import { computeSessionStats, renderSessionHeader } from './session-header-renderer.js';

describe('session header renderer', () => {
  const escapeHtml = (text) => String(text).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const formatTokens = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);

  it('computes stats', () => {
    const stats = computeSessionStats([
      { type: 'message', message: { role: 'user' } },
      { type: 'message', message: { role: 'assistant', provider: 'p', model: 'm', usage: { input: 1000 }, content: [{ type: 'toolCall' }] } },
      { type: 'message', message: { role: 'toolResult' } },
      { type: 'compaction' }
    ]);
    expect(stats.userMessages).toBe(1);
    expect(stats.assistantMessages).toBe(1);
    expect(stats.toolResults).toBe(1);
    expect(stats.compactions).toBe(1);
    expect(stats.toolCalls).toBe(1);
    expect(stats.models).toEqual(['p/m']);
  });

  it('renders header, system prompt, and tools', () => {
    const html = renderSessionHeader({
      header: { id: '<sid>', timestamp: '2026-01-01T00:00:00Z' },
      entries: [{ type: 'message', message: { role: 'user' } }],
      systemPrompt: Array(12).fill('line').join('\n'),
      tools: [{ name: 'read', description: 'Read file', parameters: { required: ['path'], properties: { path: { type: 'string', description: 'file' } } } }],
      escapeHtml,
      formatTokens
    });
    expect(html).toContain('Session: &lt;sid&gt;');
    expect(html).toContain('1 user');
    expect(html).toContain('System Prompt');
    expect(html).toContain('tool-param-required');
  });
});
