import { describe, expect, it } from 'vitest';
import { detectCurrentModel, detectCurrentThinkingLevel, findModel, groupModelsByProvider, isScopedModel, modelDisplayLabel, supportedThinkingLevels } from './chat-selectors.js';

describe('chat selector helpers', () => {
  const models = [
    { provider: 'openai', id: 'gpt-5', name: 'GPT 5', reasoning: true, thinkingLevelMap: { xhigh: 'xhigh', low: null } },
    { provider: 'anthropic', modelId: 'sonnet', scoped: true },
    { id: 'local' }
  ];

  it('groups and finds models', () => {
    expect(Object.keys(groupModelsByProvider(models)).sort()).toEqual(['anthropic', 'openai', 'unknown']);
    expect(Object.keys(groupModelsByProvider(models, 'sonnet'))).toEqual(['anthropic']);
    expect(findModel(models, 'openai', 'gpt-5')).toBe(models[0]);
    expect(findModel(models, 'anthropic', 'sonnet')).toBe(models[1]);
    expect(isScopedModel(models[1])).toBe(true);
  });

  it('detects selected model from entries', () => {
    expect(detectCurrentModel([{ type: 'model_change', provider: 'p', modelId: 'm' }])).toEqual({ provider: 'p', modelId: 'm' });
    expect(detectCurrentModel([{ type: 'message', message: { role: 'assistant', provider: 'p2', model: 'm2' } }])).toEqual({ provider: 'p2', modelId: 'm2' });
  });

  it('computes supported thinking levels and current level', () => {
    expect(supportedThinkingLevels(null)).toContain('xhigh');
    expect(supportedThinkingLevels({ reasoning: false })).toEqual(['off']);
    expect(supportedThinkingLevels(models[0])).not.toContain('low');
    expect(supportedThinkingLevels(models[0])).toContain('xhigh');
    expect(detectCurrentThinkingLevel([{ type: 'thinking_level_change', thinkingLevel: 'medium' }])).toBe('medium');
  });

  it('formats model labels', () => {
    expect(modelDisplayLabel(models[0])).toBe('GPT 5 @ openai');
    expect(modelDisplayLabel(null, 'fallback')).toBe('fallback');
  });
});
