// ============================================================
// MESSAGE RENDERING
// ============================================================

function formatTokens(count) {
  if (count < 1000) return count.toString();
  if (count < 10000) return (count / 1000).toFixed(1) + 'k';
  if (count < 1000000) return Math.round(count / 1000) + 'k';
  return (count / 1000000).toFixed(1) + 'M';
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function replaceTabs(text) {
  return text.replace(/\t/g, '   ');
}

/** Safely coerce value to string for display. Returns null if invalid type. */
function str(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return null;
}

function getLanguageFromPath(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const extToLang = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
    php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql', html: 'html', css: 'css', scss: 'scss',
    json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml',
    md: 'markdown', dockerfile: 'dockerfile'
  };
  return extToLang[ext];
}

function findToolResult(toolCallId) {
  for (const entry of entries) {
    if (entry.type === 'message' && entry.message.role === 'toolResult') {
      if (entry.message.toolCallId === toolCallId) {
        return entry;
      }
    }
  }
  return null;
}

function formatExpandableOutput(text, maxLines, lang) {
  text = replaceTabs(text);
  const lines = text.split('\n');
  const displayLines = lines.slice(0, maxLines);
  const remaining = lines.length - maxLines;

  if (lang) {
    let highlighted;
    try {
      highlighted = hljs.highlight(text, { language: lang }).value;
    } catch {
      highlighted = escapeHtml(text);
    }

    if (remaining > 0) {
      const previewCode = displayLines.join('\n');
      let previewHighlighted;
      try {
        previewHighlighted = hljs.highlight(previewCode, { language: lang }).value;
      } catch {
        previewHighlighted = escapeHtml(previewCode);
      }

      return `<div class="tool-output expandable" onclick="if(window.getSelection().toString())return;this.classList.toggle('expanded')">
        <div class="output-preview"><pre><code class="hljs">${previewHighlighted}</code></pre>
        <div class="expand-hint">... (${remaining} more lines)</div></div>
        <div class="output-full"><pre><code class="hljs">${highlighted}</code></pre></div></div>`;
    }

    return `<div class="tool-output"><pre><code class="hljs">${highlighted}</code></pre></div>`;
  }

  // Plain text output
  if (remaining > 0) {
    let out = '<div class="tool-output expandable" onclick="if(window.getSelection().toString())return;this.classList.toggle(\'expanded\')">';
    out += '<div class="output-preview">';
    for (const line of displayLines) {
      out += `<div>${escapeHtml(replaceTabs(line))}</div>`;
    }
    out += `<div class="expand-hint">... (${remaining} more lines)</div></div>`;
    out += '<div class="output-full">';
    for (const line of lines) {
      out += `<div>${escapeHtml(replaceTabs(line))}</div>`;
    }
    out += '</div></div>';
    return out;
  }

  let out = '<div class="tool-output">';
  for (const line of displayLines) {
    out += `<div>${escapeHtml(replaceTabs(line))}</div>`;
  }
  out += '</div>';
  return out;
}

function renderAskUserQuestionTool(args, result) {
  const questions = Array.isArray(args.questions) ? args.questions : [];
  const answers = result?.details?.answers || {};
  const cancelled = result?.details?.cancelled === true;
  const questionToolFailed = result?.isError === true;
  const canClick = !result || questionToolFailed;
  const isInteractive = canClick || cancelled;
  const isMulti = questions.length > 1;

  let html = `<div class="ask-question-card" data-question-count="${questions.length}">`;
  html += '<div class="ask-question-title">Question for you</div>';
  if (questionToolFailed) {
    html += '<div class="ask-question-state error">question UI failed</div>';
  } else if (cancelled) {
    html += '<div class="ask-question-state error">cancelled</div>';
  } else if (result) {
    html += '<div class="ask-question-state answered">answered</div>';
  } else {
    html += '<div class="ask-question-state pending">waiting for response</div>';
  }

  if (questions.length === 0) {
    html += '<div class="ask-question-text">No question payload provided.</div>';
  }

  questions.forEach((q, qIndex) => {
    const questionText = typeof q.question === 'string' ? q.question : `Question ${qIndex + 1}`;
    const answer = answers[questionText];
    const options = Array.isArray(q.options) ? q.options : [];
    html += `<div class="ask-question-block" data-question-text="${escapeHtml(questionText)}">`;
    if (q.header) html += `<div class="ask-question-header">${escapeHtml(String(q.header))}</div>`;
    html += `<div class="ask-question-text">${escapeHtml(questionText)}</div>`;
    if (options.length > 0) {
      html += '<div class="ask-question-options">';
      options.forEach((option) => {
        const label = typeof option?.label === 'string' ? option.label : String(option || '');
        const description = typeof option?.description === 'string' ? option.description : '';
        const selected = answer === label || (typeof answer === 'string' && answer.split(', ').includes(label));
        const tag = isInteractive ? 'button' : 'div';
        const actionClass = isInteractive ? ' ask-question-option-action' : '';
        const dataAttrs = isInteractive ? ` type="button" data-question="${escapeHtml(questionText)}" data-answer="${escapeHtml(label)}"` : '';
        html += `<${tag} class="ask-question-option${selected ? ' selected' : ''}${actionClass}"${dataAttrs}>`;
        html += `<div class="ask-question-option-label">${selected ? '✓ ' : ''}${escapeHtml(label)}</div>`;
        if (description) html += `<div class="ask-question-option-desc">${escapeHtml(description)}</div>`;
        html += `</${tag}>`;
      });
      html += '</div>';
    }
    if (answer) {
      html += `<div class="ask-question-answer"><span>Answer:</span> ${escapeHtml(String(answer))}</div>`;
    }
    html += '</div>';
  });

  if (isInteractive) {
    if (isMulti) {
      html += '<div class="ask-question-actions" style="display:none"><button type="button" class="ask-question-submit-btn">Send answers</button></div>';
    } else if (questionToolFailed) {
      html += '<div class="ask-question-hint">Use these options as a fallback — click an option to send your answer to pi.</div>';
    } else if (cancelled) {
      html += '<div class="ask-question-hint">Click an option to send your answer to pi.</div>';
    } else if (!result) {
      html += '<div class="ask-question-hint">Use the chat composer below to answer this question.</div>';
    }
  }

  html += '</div>';
  return html;
}

function renderToolCall(call) {
  const resultEntry = findToolResult(call.id);
  const result = resultEntry?.message;
  const isError = result?.isError || false;
  const statusClass = result ? (isError ? 'error' : 'success') : 'pending';

  const getResultText = () => {
    if (!result) return '';
    const textBlocks = result.content.filter(c => c.type === 'text');
    return textBlocks.map(c => c.text).join('\n');
  };

  const getResultImages = () => {
    if (!result) return [];
    return result.content.filter(c => c.type === 'image');
  };

  const renderResultImages = () => {
    const images = getResultImages();
    if (images.length === 0) return '';
    return '<div class="tool-images">' +
      images.map(img => `<img src="data:${escapeHtml(img.mimeType || 'image/png')};base64,${img.data}" class="tool-image" />`).join('') +
      '</div>';
  };

  const containerId = resultEntry ? ` id="entry-${resultEntry.id}"` : '';
  let html = `<div class="tool-execution ${statusClass}"${containerId}>`;
  const args = call.arguments || {};
  const name = call.name;

  const invalidArg = '<span class="tool-error">[invalid arg]</span>';

  switch (name) {
    case 'bash': {
      const command = str(args.command);
      const cmdDisplay = command === null ? invalidArg : escapeHtml(command || '...');
      html += `<div class="tool-command">$ ${cmdDisplay}</div>`;
      if (result) {
        const output = getResultText().trim();
        if (output) html += formatExpandableOutput(output, 5);
      }
      break;
    }
    case 'read': {
      const filePath = str(args.file_path ?? args.path);
      const offset = args.offset;
      const limit = args.limit;

      let pathHtml = filePath === null ? invalidArg : escapeHtml(shortenPath(filePath || ''));
      if (filePath !== null && (offset !== undefined || limit !== undefined)) {
        const startLine = offset ?? 1;
        const endLine = limit !== undefined ? startLine + limit - 1 : '';
        pathHtml += `<span class="line-numbers">:${startLine}${endLine ? '-' + endLine : ''}</span>`;
      }

      html += `<div class="tool-header"><span class="tool-name">read</span> <span class="tool-path">${pathHtml}</span></div>`;
      if (result) {
        html += renderResultImages();
        const output = getResultText();
        const lang = filePath ? getLanguageFromPath(filePath) : null;
        if (output) html += formatExpandableOutput(output, 10, lang);
      }
      break;
    }
    case 'write': {
      const filePath = str(args.file_path ?? args.path);
      const content = str(args.content);

      html += `<div class="tool-header"><span class="tool-name">write</span> <span class="tool-path">${filePath === null ? invalidArg : escapeHtml(shortenPath(filePath || ''))}</span>`;
      if (content !== null && content) {
        const lines = content.split('\n');
        if (lines.length > 10) html += ` <span class="line-count">(${lines.length} lines)</span>`;
      }
      html += '</div>';

      if (content === null) {
        html += `<div class="tool-error">[invalid content arg - expected string]</div>`;
      } else if (content) {
        const lang = filePath ? getLanguageFromPath(filePath) : null;
        html += formatExpandableOutput(content, 10, lang);
      }
      if (result) {
        const output = getResultText().trim();
        if (output) html += `<div class="tool-output"><div>${escapeHtml(output)}</div></div>`;
      }
      break;
    }
    case 'edit': {
      const filePath = str(args.file_path ?? args.path);
      html += `<div class="tool-header"><span class="tool-name">edit</span> <span class="tool-path">${filePath === null ? invalidArg : escapeHtml(shortenPath(filePath || ''))}</span></div>`;

      if (result?.details?.diff) {
        const diffLines = result.details.diff.split('\n');
        html += '<div class="tool-diff">';
        for (const line of diffLines) {
          const cls = line.match(/^\+/) ? 'diff-added' : line.match(/^-/) ? 'diff-removed' : 'diff-context';
          html += `<div class="${cls}">${escapeHtml(replaceTabs(line))}</div>`;
        }
        html += '</div>';
      } else if (result) {
        const output = getResultText().trim();
        if (output) html += `<div class="tool-output"><pre>${escapeHtml(output)}</pre></div>`;
      }
      break;
    }
    case 'ls': {
      const dirPath = str(args.path);
      const limit = args.limit;

      let pathHtml = dirPath === null ? invalidArg : escapeHtml(shortenPath(dirPath || '.'));
      if (limit !== undefined) {
        pathHtml += ` <span class="line-count">(limit ${escapeHtml(String(limit))})</span>`;
      }

      html += `<div class="tool-header"><span class="tool-name">ls</span> <span class="tool-path">${pathHtml}</span></div>`;
      if (result) {
        const output = getResultText().trim();
        if (output) html += formatExpandableOutput(output, 20);
      }
      break;
    }
    case 'ask_user_question': {
      html += renderAskUserQuestionTool(args, result);
      break;
    }
    default: {
      // Check for pre-rendered custom tool HTML
      const rendered = renderedTools?.[call.id];
      if (rendered?.callHtml || rendered?.resultHtmlCollapsed || rendered?.resultHtmlExpanded) {
        // Custom tool with pre-rendered HTML from TUI renderer
        if (rendered.callHtml) {
          html += `<div class="tool-header ansi-rendered">${rendered.callHtml}</div>`;
        } else {
          html += `<div class="tool-header"><span class="tool-name">${escapeHtml(name)}</span></div>`;
        }

        if (rendered.resultHtmlCollapsed && rendered.resultHtmlExpanded && rendered.resultHtmlCollapsed !== rendered.resultHtmlExpanded) {
          // Both collapsed and expanded differ - render expandable section
          html += `<div class="tool-output expandable ansi-rendered" onclick="if(window.getSelection().toString())return;this.classList.toggle('expanded')">
            <div class="output-preview">${rendered.resultHtmlCollapsed}</div>
            <div class="output-full">${rendered.resultHtmlExpanded}</div>
          </div>`;
        } else if (rendered.resultHtmlExpanded) {
          // Only expanded exists (or collapsed is identical) - show directly
          html += `<div class="tool-output ansi-rendered">${rendered.resultHtmlExpanded}</div>`;
        } else if (result) {
          // No pre-rendered result HTML - fallback to JSON
          const output = getResultText();
          if (output) html += formatExpandableOutput(output, 10);
        }
      } else {
        // Fallback to JSON display (existing behavior)
        html += `<div class="tool-header"><span class="tool-name">${escapeHtml(name)}</span></div>`;
        html += `<div class="tool-output"><pre>${escapeHtml(JSON.stringify(args, null, 2))}</pre></div>`;
        if (result) {
          const output = getResultText();
          if (output) html += formatExpandableOutput(output, 10);
        }
      }
    }
  }

  html += '</div>';
  return html;
}

/**
 * Download the session data as a JSONL file.
 * Reconstructs the original format: header line + entry lines.
 */
window.downloadSessionJson = function() {
  // Build JSONL content: header first, then all entries
  const lines = [];
  if (header) {
    lines.push(JSON.stringify({ type: 'header', ...header }));
  }
  for (const entry of entries) {
    lines.push(JSON.stringify(entry));
  }
  const jsonlContent = lines.join('\n');

  // Create download
  const blob = new Blob([jsonlContent], { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${header?.id || 'session'}.jsonl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build a shareable URL for a specific message.
 * URL format: base?gistId&leafId=<leafId>&targetId=<entryId>
 */
function buildShareUrl(entryId) {
  // Check for injected base URL (used when loaded in iframe via srcdoc)
  const baseUrlMeta = document.querySelector('meta[name="pi-share-base-url"]');
  const baseUrl = baseUrlMeta ? baseUrlMeta.content : window.location.href.split('?')[0];

  const url = new URL(window.location.href);
  // Find the gist ID (first query param without value, e.g., ?abc123)
  const gistId = Array.from(url.searchParams.keys()).find(k => !url.searchParams.get(k));

  // Build the share URL
  const params = new URLSearchParams();
  const sessionId = url.searchParams.get('id');
  if (sessionId) params.set('id', sessionId);
  params.set('leafId', currentLeafId);
  params.set('targetId', entryId);

  // If we have an injected base URL (iframe context), use it directly
  if (baseUrlMeta) {
    return `${baseUrl}&${params.toString()}`;
  }

  // Otherwise build from current location (direct file access)
  url.search = gistId ? `?${gistId}&${params.toString()}` : `?${params.toString()}`;
  return url.toString();
}

/**
 * Copy text to clipboard with visual feedback.
 * Uses navigator.clipboard with fallback to execCommand for HTTP contexts.
 */
async function copyToClipboard(text, button) {
  let success = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      success = true;
    }
  } catch (err) {
    // Clipboard API failed, try fallback
  }

  // Fallback for HTTP or when Clipboard API is unavailable
  if (!success) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      success = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  if (success && button) {
    const originalHtml = button.innerHTML;
    button.innerHTML = '✓';
    button.classList.add('copied');
    setTimeout(() => {
      button.innerHTML = originalHtml;
      button.classList.remove('copied');
    }, 1500);
  }
}

/**
 * Render the copy-link button HTML for a message.
 */
function renderCopyLinkButton(entryId) {
  return `<button class="copy-link-btn" data-entry-id="${entryId}" title="Copy link to this message">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  </button>`;
}

function renderEntry(entry) {
  const ts = formatTimestamp(entry.timestamp);
  const tsHtml = ts ? `<div class="message-timestamp">${ts}</div>` : '';
  const entryId = `entry-${entry.id}`;
  const copyBtnHtml = renderCopyLinkButton(entry.id);

  if (entry.type === 'message') {
    const msg = entry.message;

    if (msg.role === 'user') {
      let html = `<div class="user-message" id="${entryId}">${copyBtnHtml}${tsHtml}`;
      const content = msg.content;

      if (Array.isArray(content)) {
        const images = content.filter(c => c.type === 'image');
        if (images.length > 0) {
          html += '<div class="message-images">';
          for (const img of images) {
            html += `<img src="data:${escapeHtml(img.mimeType || 'image/png')};base64,${img.data}" class="message-image" />`;
          }
          html += '</div>';
        }
      }

      const text = typeof content === 'string' ? content :
        content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      if (text.trim()) {
        html += `<div class="markdown-content">${safeMarkedParse(text)}</div>`;
      }
      html += '</div>';
      return html;
    }

    if (msg.role === 'assistant') {
      let html = `<div class="assistant-message" id="${entryId}">${copyBtnHtml}${tsHtml}`;

      for (const block of msg.content) {
        if (block.type === 'text' && block.text.trim()) {
          html += `<div class="assistant-text markdown-content">${safeMarkedParse(block.text)}</div>`;
        } else if (block.type === 'thinking' && block.thinking.trim()) {
          html += `<div class="thinking-block">
            <div class="thinking-text">${escapeHtml(block.thinking)}</div>
            <div class="thinking-collapsed">Thinking ...</div>
          </div>`;
        }
      }

      for (const block of msg.content) {
        if (block.type === 'toolCall') {
          html += renderToolCall(block);
        }
      }

      if (msg.stopReason === 'aborted') {
        html += '<div class="error-text">Aborted</div>';
      } else if (msg.stopReason === 'error') {
        html += `<div class="error-text">Error: ${escapeHtml(msg.errorMessage || 'Unknown error')}</div>`;
      }

      html += '</div>';
      return html;
    }

    if (msg.role === 'bashExecution') {
      const isError = msg.cancelled || (msg.exitCode !== 0 && msg.exitCode !== null);
      let html = `<div class="tool-execution ${isError ? 'error' : 'success'}" id="${entryId}">${tsHtml}`;
      html += `<div class="tool-command">$ ${escapeHtml(msg.command)}</div>`;
      if (msg.output) html += formatExpandableOutput(msg.output, 10);
      if (msg.cancelled) {
        html += '<div style="color: var(--warning)">(cancelled)</div>';
      } else if (msg.exitCode !== 0 && msg.exitCode !== null) {
        html += `<div style="color: var(--error)">(exit ${msg.exitCode})</div>`;
      }
      html += '</div>';
      return html;
    }

    if (msg.role === 'toolResult') return '';
  }

  if (entry.type === 'model_change') {
    return `<div class="model-change" id="${entryId}">${tsHtml}Switched to model: <span class="model-name">${escapeHtml(entry.provider)}/${escapeHtml(entry.modelId)}</span></div>`;
  }

  if (entry.type === 'compaction') {
    return `<div class="compaction" id="${entryId}" onclick="if(window.getSelection().toString())return;this.classList.toggle('expanded')">
      <div class="compaction-label">[compaction]</div>
      <div class="compaction-collapsed">Compacted from ${entry.tokensBefore.toLocaleString()} tokens</div>
      <div class="compaction-content"><strong>Compacted from ${entry.tokensBefore.toLocaleString()} tokens</strong>\n\n${escapeHtml(entry.summary)}</div>
    </div>`;
  }

  if (entry.type === 'branch_summary') {
    return `<div class="branch-summary" id="${entryId}">${tsHtml}
      <div class="branch-summary-header">Branch Summary</div>
      <div class="markdown-content">${safeMarkedParse(entry.summary)}</div>
    </div>`;
  }

  if (entry.type === 'custom_message' && entry.display) {
    return `<div class="hook-message" id="${entryId}">${tsHtml}
      <div class="hook-type">[${escapeHtml(entry.customType)}]</div>
      <div class="markdown-content">${safeMarkedParse(typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content))}</div>
    </div>`;
  }

  return '';
}

