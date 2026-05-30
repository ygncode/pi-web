// ============================================================
// HEADER / STATS
// ============================================================

function computeStats(entryList) {
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
        toolCalls += msg.content.filter(c => c.type === 'toolCall').length;
      }
      if (msg.role === 'toolResult') toolResults++;
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

const globalStats = computeStats(entries);

function renderHeader() {
  const totalCost = globalStats.cost.input + globalStats.cost.output + globalStats.cost.cacheRead + globalStats.cost.cacheWrite;

  const tokenParts = [];
  if (globalStats.tokens.input) tokenParts.push(`↑${formatTokens(globalStats.tokens.input)}`);
  if (globalStats.tokens.output) tokenParts.push(`↓${formatTokens(globalStats.tokens.output)}`);
  if (globalStats.tokens.cacheRead) tokenParts.push(`R${formatTokens(globalStats.tokens.cacheRead)}`);
  if (globalStats.tokens.cacheWrite) tokenParts.push(`W${formatTokens(globalStats.tokens.cacheWrite)}`);

  const msgParts = [];
  if (globalStats.userMessages) msgParts.push(`${globalStats.userMessages} user`);
  if (globalStats.assistantMessages) msgParts.push(`${globalStats.assistantMessages} assistant`);
  if (globalStats.toolResults) msgParts.push(`${globalStats.toolResults} tool results`);
  if (globalStats.customMessages) msgParts.push(`${globalStats.customMessages} custom`);
  if (globalStats.compactions) msgParts.push(`${globalStats.compactions} compactions`);
  if (globalStats.branchSummaries) msgParts.push(`${globalStats.branchSummaries} branch summaries`);

  let html = `
    <div class="header">
      <h1>Session: ${escapeHtml(header?.id || 'unknown')}</h1>
      <div class="help-bar">
        <span class="help-hint">T show/hide thinking · O show/hide tools · P expand/collapse tool output</span>
        <div class="help-actions">
          <button type="button" class="header-toggle-btn" data-action="toggle-thinking" title="Show/hide thinking (T)">Thinking</button>
          <button type="button" class="header-toggle-btn" data-action="toggle-tools" title="Show/hide tools (O)">Tools</button>
          <button type="button" class="header-toggle-btn" data-action="toggle-tool-output" title="Expand/collapse tool output (P)">Tool output</button>
          <button type="button" class="download-json-btn" onclick="downloadSessionJson()" title="Download session as JSONL">↓ JSONL</button>
        </div>
      </div>
      <div class="header-info">
        <div class="info-item"><span class="info-label">Date:</span><span class="info-value">${header?.timestamp ? new Date(header.timestamp).toLocaleString() : 'unknown'}</span></div>
        <div class="info-item"><span class="info-label">Models:</span><span class="info-value">${globalStats.models.join(', ') || 'unknown'}</span></div>
        <div class="info-item"><span class="info-label">Messages:</span><span class="info-value">${msgParts.join(', ') || '0'}</span></div>
        <div class="info-item"><span class="info-label">Tool Calls:</span><span class="info-value">${globalStats.toolCalls}</span></div>
        <div class="info-item"><span class="info-label">Tokens:</span><span class="info-value">${tokenParts.join(' ') || '0'}</span></div>
        <div class="info-item"><span class="info-label">Cost:</span><span class="info-value">$${totalCost.toFixed(3)}</span></div>
      </div>
    </div>`;

  // Render system prompt (user's base prompt, applies to all providers)
  if (systemPrompt) {
    const lines = systemPrompt.split('\n');
    const previewLines = 10;
    if (lines.length > previewLines) {
      const preview = lines.slice(0, previewLines).join('\n');
      const remaining = lines.length - previewLines;
      html += `<div class="system-prompt expandable" onclick="if(window.getSelection().toString())return;this.classList.toggle('expanded')">
        <div class="system-prompt-header">System Prompt</div>
        <div class="system-prompt-preview">${escapeHtml(preview)}</div>
        <div class="system-prompt-expand-hint">... (${remaining} more lines, click to expand)</div>
        <div class="system-prompt-full">${escapeHtml(systemPrompt)}</div>
      </div>`;
    } else {
      html += `<div class="system-prompt">
        <div class="system-prompt-header">System Prompt</div>
        <div class="system-prompt-full" style="display: block">${escapeHtml(systemPrompt)}</div>
      </div>`;
    }
  }

  if (tools && tools.length > 0) {
    html += `<div class="tools-list">
      <div class="tools-header">Available Tools</div>
      <div class="tools-content">
        ${tools.map(t => {
          const hasParams = t.parameters && typeof t.parameters === 'object' && t.parameters.properties && Object.keys(t.parameters.properties).length > 0;
          if (!hasParams) {
            return `<div class="tool-item"><span class="tool-item-name">${escapeHtml(t.name)}</span> - <span class="tool-item-desc">${escapeHtml(t.description)}</span></div>`;
          }
          const params = t.parameters;
          const properties = params.properties;
          const required = params.required || [];
          let paramsHtml = '';
          for (const [name, prop] of Object.entries(properties)) {
            const isRequired = required.includes(name);
            const typeStr = prop.type || 'any';
            const reqLabel = isRequired ? '<span class="tool-param-required">required</span>' : '<span class="tool-param-optional">optional</span>';
            paramsHtml += `<div class="tool-param"><span class="tool-param-name">${escapeHtml(name)}</span> <span class="tool-param-type">${escapeHtml(typeStr)}</span> ${reqLabel}`;
            if (prop.description) {
              paramsHtml += `<div class="tool-param-desc">${escapeHtml(prop.description)}</div>`;
            }
            paramsHtml += `</div>`;
          }
          return `<div class="tool-item" onclick="if(window.getSelection().toString())return;this.classList.toggle('params-expanded')"><span class="tool-item-name">${escapeHtml(t.name)}</span> - <span class="tool-item-desc">${escapeHtml(t.description)}</span> <span class="tool-params-hint"></span><div class="tool-params-content">${paramsHtml}</div></div>`;
        }).join('')}
      </div>
    </div>`;
  }

  return html;
}
