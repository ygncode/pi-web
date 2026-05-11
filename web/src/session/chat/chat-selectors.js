export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];

export function isScopedModel(model) {
  return !!(model?.isScoped || model?.scoped || model?.scope);
}

export function groupModelsByProvider(models, filter = '') {
  const q = filter.toLowerCase();
  const byProvider = {};
  models.forEach((model) => {
    if (q) {
      const name = (model.name || model.id || model.modelId || '').toLowerCase();
      const provider = (model.provider || '').toLowerCase();
      if (!name.includes(q) && !provider.includes(q)) return;
    }
    const provider = model.provider || 'unknown';
    if (!byProvider[provider]) byProvider[provider] = [];
    byProvider[provider].push(model);
  });
  return byProvider;
}

export function findModel(models, provider, modelId) {
  return models.find((model) => (model.provider || '') === provider && ((model.id || '') === modelId || (model.modelId || '') === modelId));
}

export function detectCurrentModel(entries) {
  const modelChanges = entries.filter((entry) => entry.type === 'model_change');
  if (modelChanges.length > 0) {
    const latest = modelChanges[modelChanges.length - 1];
    return { provider: latest.provider || '', modelId: latest.modelId || '' };
  }

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === 'message' && entry.message && entry.message.role === 'assistant' && entry.message.model) {
      return { provider: entry.message.provider || '', modelId: entry.message.model || '' };
    }
  }
  return { provider: '', modelId: '' };
}

export function supportedThinkingLevels(model, levels = THINKING_LEVELS) {
  if (!model) return levels;
  if (!model.reasoning) return ['off'];
  const map = model.thinkingLevelMap || {};
  return levels.filter((level) => {
    const mapped = map[level];
    if (mapped === null) return false;
    if (level === 'xhigh') return mapped !== undefined;
    return true;
  });
}

export function detectCurrentThinkingLevel(entries) {
  const changes = entries.filter((entry) => entry.type === 'thinking_level_change');
  const latest = changes[changes.length - 1];
  return latest?.thinkingLevel || '';
}

export function modelDisplayLabel(model, fallbackId = '') {
  const id = model?.name || model?.id || model?.modelId || fallbackId;
  return id + (model?.provider ? ' @ ' + model.provider : '');
}
