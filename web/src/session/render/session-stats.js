// Pure session statistics + token formatting, shared by the live app and the
// static export. Extracted from session-header-renderer.js during the Svelte
// migration so the header card can be a component while the math stays a
// framework-free, unit-tested function. See docs/dev/svelte-migration-plan.md.

export function formatTokens(count) {
  if (count < 1000) return count.toString();
  if (count < 10000) return (count / 1000).toFixed(1) + 'k';
  if (count < 1000000) return Math.round(count / 1000) + 'k';
  return (count / 1000000).toFixed(1) + 'M';
}

export function computeSessionStats(entryList = []) {
  let userMessages = 0, assistantMessages = 0, toolResults = 0;
  let customMessages = 0, compactions = 0, branchSummaries = 0, toolCalls = 0;
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const models = new Set();

  for (const entry of entryList) {
    if (entry.type === 'message') {
      const msg = entry.message;
      if (msg.role === 'user') userMessages++;
      if (msg.role === 'assistant') {
        assistantMessages++;
        if (msg.model) models.add(msg.provider ? `${msg.provider}/${msg.model}` : msg.model);
        if (msg.usage) {
          tokens.input += msg.usage.input || 0;
          tokens.output += msg.usage.output || 0;
          tokens.cacheRead += msg.usage.cacheRead || 0;
          tokens.cacheWrite += msg.usage.cacheWrite || 0;
          if (msg.usage.cost) {
            cost.input += msg.usage.cost.input || 0;
            cost.output += msg.usage.cost.output || 0;
            cost.cacheRead += msg.usage.cost.cacheRead || 0;
            cost.cacheWrite += msg.usage.cost.cacheWrite || 0;
          }
        }
        toolCalls += (msg.content || []).filter(c => c.type === 'toolCall').length;
      }
      if (msg.role === 'toolResult') toolResults++;
    } else if (entry.type === 'model_change') {
      if (entry.modelId) models.add(entry.provider ? `${entry.provider}/${entry.modelId}` : entry.modelId);
    } else if (entry.type === 'compaction') {
      compactions++;
    } else if (entry.type === 'branch_summary') {
      branchSummaries++;
    } else if (entry.type === 'custom_message') {
      customMessages++;
    }
  }

  return { userMessages, assistantMessages, toolResults, customMessages, compactions, branchSummaries, toolCalls, tokens, cost, models: Array.from(models) };
}

// Pre-formatted summary strings used by the header card (kept here so they are
// unit-testable and identical between live + export).
export function summarizeSessionStats(stats) {
  const totalCost = stats.cost.input + stats.cost.output + stats.cost.cacheRead + stats.cost.cacheWrite;

  const tokenParts = [];
  if (stats.tokens.input) tokenParts.push(`↑${formatTokens(stats.tokens.input)}`);
  if (stats.tokens.output) tokenParts.push(`↓${formatTokens(stats.tokens.output)}`);
  if (stats.tokens.cacheRead) tokenParts.push(`R${formatTokens(stats.tokens.cacheRead)}`);
  if (stats.tokens.cacheWrite) tokenParts.push(`W${formatTokens(stats.tokens.cacheWrite)}`);

  const msgParts = [];
  if (stats.userMessages) msgParts.push(`${stats.userMessages} user`);
  if (stats.assistantMessages) msgParts.push(`${stats.assistantMessages} assistant`);
  if (stats.toolResults) msgParts.push(`${stats.toolResults} tool results`);
  if (stats.customMessages) msgParts.push(`${stats.customMessages} custom`);
  if (stats.compactions) msgParts.push(`${stats.compactions} compactions`);
  if (stats.branchSummaries) msgParts.push(`${stats.branchSummaries} branch summaries`);

  return {
    tokensText: tokenParts.join(' ') || '0',
    messagesText: msgParts.join(', ') || '0',
    modelsText: stats.models.join(', ') || 'unknown',
    costText: `$${totalCost.toFixed(3)}`,
    toolCalls: stats.toolCalls,
  };
}
