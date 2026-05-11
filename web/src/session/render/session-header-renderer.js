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

export function renderSessionHeader({ header, entries = [], systemPrompt = '', tools = [], escapeHtml, formatTokens }) {
  const stats = computeSessionStats(entries);
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
        <div class="info-item"><span class="info-label">Models:</span><span class="info-value">${stats.models.join(', ') || 'unknown'}</span></div>
        <div class="info-item"><span class="info-label">Messages:</span><span class="info-value">${msgParts.join(', ') || '0'}</span></div>
        <div class="info-item"><span class="info-label">Tool Calls:</span><span class="info-value">${stats.toolCalls}</span></div>
        <div class="info-item"><span class="info-label">Tokens:</span><span class="info-value">${tokenParts.join(' ') || '0'}</span></div>
        <div class="info-item"><span class="info-label">Cost:</span><span class="info-value">$${totalCost.toFixed(3)}</span></div>
      </div>
    </div>`;

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
            if (prop.description) paramsHtml += `<div class="tool-param-desc">${escapeHtml(prop.description)}</div>`;
            paramsHtml += `</div>`;
          }
          return `<div class="tool-item" onclick="if(window.getSelection().toString())return;this.classList.toggle('params-expanded')"><span class="tool-item-name">${escapeHtml(t.name)}</span> - <span class="tool-item-desc">${escapeHtml(t.description)}</span> <span class="tool-params-hint"></span><div class="tool-params-content">${paramsHtml}</div></div>`;
        }).join('')}
      </div>
    </div>`;
  }

  return html;
}
