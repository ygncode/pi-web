// ============================================================
// TREE DISPLAY TEXT (pure data -> string)
// ============================================================

function shortenPath(p) {
  if (typeof p !== 'string') return '';
  if (p.startsWith('/Users/')) {
    const parts = p.split('/');
    if (parts.length > 2) return '~' + p.slice(('/Users/' + parts[2]).length);
  }
  if (p.startsWith('/home/')) {
    const parts = p.split('/');
    if (parts.length > 2) return '~' + p.slice(('/home/' + parts[2]).length);
  }
  return p;
}

function formatToolCall(name, args) {
  switch (name) {
    case 'read': {
      const path = shortenPath(String(args.path || args.file_path || ''));
      const offset = args.offset;
      const limit = args.limit;
      let display = path;
      if (offset !== undefined || limit !== undefined) {
        const start = offset ?? 1;
        const end = limit !== undefined ? start + limit - 1 : '';
        display += `:${start}${end ? `-${end}` : ''}`;
      }
      return `[read: ${display}]`;
    }
    case 'write':
      return `[write: ${shortenPath(String(args.path || args.file_path || ''))}]`;
    case 'edit':
      return `[edit: ${shortenPath(String(args.path || args.file_path || ''))}]`;
    case 'bash': {
      const rawCmd = String(args.command || '');
      const cmd = rawCmd.replace(/[\n\t]/g, ' ').trim().slice(0, 50);
      return `[bash: ${cmd}${rawCmd.length > 50 ? '...' : ''}]`;
    }
    case 'grep':
      return `[grep: /${args.pattern || ''}/ in ${shortenPath(String(args.path || '.'))}]`;
    case 'find':
      return `[find: ${args.pattern || ''} in ${shortenPath(String(args.path || '.'))}]`;
    case 'ls':
      return `[ls: ${shortenPath(String(args.path || '.'))}]`;
    default: {
      const argsStr = JSON.stringify(args).slice(0, 40);
      return `[${name}: ${argsStr}${JSON.stringify(args).length > 40 ? '...' : ''}]`;
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncate string to maxLen chars, append "..." if truncated.
 */
function truncate(s, maxLen = 100) {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '...';
}

/**
 * Get display text for tree node (returns HTML string).
 */
function getTreeNodeDisplayHtml(entry, label) {
  const normalize = s => s.replace(/[\n\t]/g, ' ').trim();
  const labelHtml = label ? `<span class="tree-label">[${escapeHtml(label)}]</span> ` : '';

  switch (entry.type) {
    case 'message': {
      const msg = entry.message;
      if (msg.role === 'user') {
        const content = truncate(normalize(extractContent(msg.content)));
        return labelHtml + `<span class="tree-role-user">user:</span> ${escapeHtml(content)}`;
      }
      if (msg.role === 'assistant') {
        const textContent = truncate(normalize(extractContent(msg.content)));
        if (textContent) {
          return labelHtml + `<span class="tree-role-assistant">assistant:</span> ${escapeHtml(textContent)}`;
        }
        if (msg.stopReason === 'aborted') {
          return labelHtml + `<span class="tree-role-assistant">assistant:</span> <span class="tree-muted">(aborted)</span>`;
        }
        if (msg.errorMessage) {
          return labelHtml + `<span class="tree-role-assistant">assistant:</span> <span class="tree-error">${escapeHtml(truncate(msg.errorMessage))}</span>`;
        }
        return labelHtml + `<span class="tree-role-assistant">assistant:</span> <span class="tree-muted">(no text)</span>`;
      }
      if (msg.role === 'toolResult') {
        const toolCall = msg.toolCallId ? toolCallMap.get(msg.toolCallId) : null;
        if (toolCall) {
          return labelHtml + `<span class="tree-role-tool">${escapeHtml(formatToolCall(toolCall.name, toolCall.arguments))}</span>`;
        }
        return labelHtml + `<span class="tree-role-tool">[${msg.toolName || 'tool'}]</span>`;
      }
      if (msg.role === 'bashExecution') {
        const cmd = truncate(normalize(msg.command || ''));
        return labelHtml + `<span class="tree-role-tool">[bash]:</span> ${escapeHtml(cmd)}`;
      }
      return labelHtml + `<span class="tree-muted">[${msg.role}]</span>`;
    }
    case 'compaction':
      return labelHtml + `<span class="tree-compaction">[compaction: ${Math.round(entry.tokensBefore/1000)}k tokens]</span>`;
    case 'branch_summary': {
      const summary = truncate(normalize(entry.summary || ''));
      return labelHtml + `<span class="tree-branch-summary">[branch summary]:</span> ${escapeHtml(summary)}`;
    }
    case 'custom_message': {
      const content = typeof entry.content === 'string' ? entry.content : extractContent(entry.content);
      return labelHtml + `<span class="tree-custom">[${escapeHtml(entry.customType)}]:</span> ${escapeHtml(truncate(normalize(content)))}`;
    }
    case 'model_change':
      return labelHtml + `<span class="tree-muted">[model: ${entry.modelId}]</span>`;
    case 'thinking_level_change':
      return labelHtml + `<span class="tree-muted">[thinking: ${entry.thinkingLevel}]</span>`;
    default:
      return labelHtml + `<span class="tree-muted">[${entry.type}]</span>`;
  }
}
