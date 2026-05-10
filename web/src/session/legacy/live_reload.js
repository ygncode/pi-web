(function() {
  var SEEN = new Set();
  var LIVE_RENDERED = new Set();
  document.querySelectorAll('[id^="entry-"]').forEach(function(el) {
    SEEN.add(el.id.replace('entry-', ''));
  });

  function escapeHtml(t) {
    var d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }
  function extractContent(c) {
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.filter(function(x){return x.type==='text'}).map(function(x){return x.text}).join('');
    return '';
  }
  function fmtTs(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  function shortenPath(p) {
    if (typeof p !== 'string') return '';
    if (p.indexOf('/Users/')===0) { var parts=p.split('/'); if(parts.length>2) return '~'+p.slice(('/Users/'+parts[2]).length); }
    if (p.indexOf('/home/')===0) { var parts=p.split('/'); if(parts.length>2) return '~'+p.slice(('/home/'+parts[2]).length); }
    return p;
  }
  function formatToolCall(name, args) {
    args = args || {};
    switch(name) {
      case 'read':
        var path = shortenPath(String(args.path || args.file_path || ''));
        var off = args.offset, lim = args.limit;
        if (off !== undefined || lim !== undefined) { var s = off||1, e = lim ? s+lim-1 : ''; path += ':'+s+(e?'-'+e:''); }
        return '[read: '+path+']';
      case 'write': return '[write: '+shortenPath(String(args.path || args.file_path || ''))+']';
      case 'edit': return '[edit: '+shortenPath(String(args.path || args.file_path || ''))+']';
      case 'bash':
        var raw = String(args.command || '');
        var cmd = raw.replace(/[\n\t]/g,' ').trim().slice(0,50);
        return '[bash: '+cmd+(raw.length>50?'...':'')+']';
      case 'grep': return '[grep: /'+(args.pattern||'')+'/ in '+shortenPath(String(args.path||'.'))+']';
      case 'find': return '[find: '+(args.pattern||'')+' in '+shortenPath(String(args.path||'.'))+']';
      case 'ls': return '[ls: '+shortenPath(String(args.path||'.'))+']';
      default:
        var s = JSON.stringify(args).slice(0,40);
        return '['+name+': '+s+(JSON.stringify(args).length>40?'...':'')+']';
    }
  }
  function safeMarked(text) {
    try { return marked.parse(text); } catch(e) { return escapeHtml(text); }
  }
  function renderToolOutput(text) {
    text = String(text || '');
    if (!text) return '';
    var lines = text.split('\n');
    var preview = lines.slice(0, 12).join('\n');
    if (lines.length > 12) preview += '\n…';
    return '<div class="tool-output expandable" onclick="if(window.getSelection().toString())return;this.classList.toggle(\'expanded\')"><div class="output-preview"><pre>'+escapeHtml(preview)+'</pre></div><div class="output-full"><pre>'+escapeHtml(text)+'</pre></div></div>';
  }

  var TOOL_RESULT_CACHE = {};
  function cacheToolResults(entries) {
    entries.forEach(function(e) {
      if (e.type === 'message' && e.message && e.message.role === 'toolResult' && e.message.toolCallId) {
        TOOL_RESULT_CACHE[e.message.toolCallId] = e.message;
      }
    });
  }

  function renderToolCall(call, result) {
    var isError = result && result.isError;
    var status = result ? (isError ? 'error' : 'success') : 'pending';
    var html = '<div class="tool-execution '+status+'">';
    var args = call.arguments || {};
    var invalid = '<span class="tool-error">[invalid arg]</span>';

    function getResultText() {
      if (!result) return '';
      return (result.content||[]).filter(function(c){return c.type==='text'}).map(function(c){return c.text}).join('\n');
    }
    function getResultImages() {
      if (!result) return [];
      return (result.content||[]).filter(function(c){return c.type==='image'});
    }

    if (call.name === 'bash') {
      var cmd = typeof args.command === 'string' ? escapeHtml(args.command) : invalid;
      html += '<div class="tool-command">$ '+cmd+'</div>';
      if (result) {
        var out = getResultText().trim();
        if (out) html += renderToolOutput(out);
      }
    } else if (call.name === 'read') {
      var fp = typeof (args.file_path || args.path) === 'string' ? shortenPath(String(args.file_path || args.path || '')) : invalid;
      html += '<div class="tool-header"><span class="tool-name">read</span> <span class="tool-path">'+escapeHtml(fp)+'</span></div>';
      if (result) {
        var imgs = getResultImages();
        imgs.forEach(function(img) {
          html += '<img src="data:'+escapeHtml(img.mimeType||'image/png')+';base64,'+img.data+'" class="tool-image" />';
        });
        var out = getResultText();
        if (out) html += renderToolOutput(out);
      }
    } else if (call.name === 'write') {
      var fp = typeof (args.file_path || args.path) === 'string' ? escapeHtml(shortenPath(String(args.file_path || args.path || ''))) : invalid;
      html += '<div class="tool-header"><span class="tool-name">write</span> <span class="tool-path">'+fp+'</span></div>';
      if (typeof args.content === 'string') {
        html += renderToolOutput(args.content);
      } else if (args.content !== undefined) {
        html += '<div class="tool-error">[invalid content arg - expected string]</div>';
      }
      if (result) {
        var out = getResultText().trim();
        if (out) html += renderToolOutput(out);
      }
    } else if (call.name === 'edit') {
      var fp = typeof (args.file_path || args.path) === 'string' ? escapeHtml(shortenPath(String(args.file_path || args.path || ''))) : invalid;
      html += '<div class="tool-header"><span class="tool-name">edit</span> <span class="tool-path">'+fp+'</span></div>';
      if (result && result.details && result.details.diff) {
        var lines = result.details.diff.split('\n');
        html += '<div class="tool-diff">';
        lines.forEach(function(line) {
          var cls = line.match(/^\+/) ? 'diff-added' : line.match(/^-/) ? 'diff-removed' : 'diff-context';
          html += '<div class="'+cls+'">'+escapeHtml(line)+'</div>';
        });
        html += '</div>';
      } else if (result) {
        var out = getResultText().trim();
        if (out) html += renderToolOutput(out);
      }
    } else if (call.name === 'ls') {
      var dp = typeof args.path === 'string' ? escapeHtml(shortenPath(String(args.path || '.'))) : invalid;
      html += '<div class="tool-header"><span class="tool-name">ls</span> <span class="tool-path">'+dp+'</span></div>';
      if (result) {
        var out = getResultText().trim();
        if (out) html += renderToolOutput(out);
      }
    } else if (call.name === 'ask_user_question') {
      var questions = Array.isArray(args.questions) ? args.questions : [];
      var qaAnswers = result && result.details && result.details.answers ? result.details.answers : {};
      var qaCancelled = result && result.details && result.details.cancelled === true;
      var qaFailed = !!(result && result.isError);
      var qaInteractive = !result || qaFailed || qaCancelled;
      var qaMulti = questions.length > 1;
      html = '<div class="tool-execution '+status+'">';
      html += '<div class="ask-question-card" data-question-count="'+questions.length+'">';
      html += '<div class="ask-question-title">Question for you</div>';
      if (qaFailed) {
        html += '<div class="ask-question-state error">question UI failed</div>';
      } else if (qaCancelled) {
        html += '<div class="ask-question-state error">cancelled</div>';
      } else if (result) {
        html += '<div class="ask-question-state answered">answered</div>';
      } else {
        html += '<div class="ask-question-state pending">waiting for response</div>';
      }
      questions.forEach(function(q, qi) {
        var questionText = typeof q.question === 'string' ? q.question : 'Question '+(qi+1);
        var answer = qaAnswers[questionText];
        var options = Array.isArray(q.options) ? q.options : [];
        html += '<div class="ask-question-block" data-question-text="'+escapeHtml(questionText)+'">';
        if (q.header) html += '<div class="ask-question-header">'+escapeHtml(String(q.header))+'</div>';
        html += '<div class="ask-question-text">'+escapeHtml(questionText)+'</div>';
        if (options.length > 0) {
          html += '<div class="ask-question-options">';
          options.forEach(function(opt) {
            var label = (opt && typeof opt.label === 'string') ? opt.label : String(opt||'');
            var desc = (opt && typeof opt.description === 'string') ? opt.description : '';
            var sel = answer === label || (typeof answer === 'string' && answer.split(', ').indexOf(label) >= 0);
            var tag = qaInteractive ? 'button' : 'div';
            var cls = 'ask-question-option'+(sel?' selected':'')+(qaInteractive?' ask-question-option-action':'');
            var dAttrs = qaInteractive ? ' type="button" data-question="'+escapeHtml(questionText)+'" data-answer="'+escapeHtml(label)+'"' : '';
            html += '<'+tag+' class="'+cls+'"'+dAttrs+'>';
            html += '<div class="ask-question-option-label">'+(sel?'✓ ':'')+escapeHtml(label)+'</div>';
            if (desc) html += '<div class="ask-question-option-desc">'+escapeHtml(desc)+'</div>';
            html += '</'+tag+'>';
          });
          html += '</div>';
        }
        if (answer) html += '<div class="ask-question-answer"><span>Answer:</span> '+escapeHtml(String(answer))+'</div>';
        html += '</div>';
      });
      if (qaInteractive) {
        if (qaMulti) {
          html += '<div class="ask-question-actions" style="display:none"><button type="button" class="ask-question-submit-btn">Send answers</button></div>';
        } else if (qaFailed || qaCancelled) {
          html += '<div class="ask-question-hint">Click an option to send your answer to pi.</div>';
        } else {
          html += '<div class="ask-question-hint">Use the chat composer below to answer this question.</div>';
        }
      }
      html += '</div>';
    } else {
      html += '<div class="tool-header"><span class="tool-name">'+escapeHtml(call.name)+'</span></div>';
      html += renderToolOutput(JSON.stringify(args,null,2));
      if (result) {
        var out = getResultText();
        if (out) html += renderToolOutput(out);
      }
    }
    html += '</div>';
    return html;
  }

  function renderEntry(entry, allEntries) {
    cacheToolResults(allEntries);
    var ts = fmtTs(entry.timestamp);
    var tsHtml = ts ? '<div class="message-timestamp">'+ts+'</div>' : '';
    var eid = 'entry-' + entry.id;

    if (entry.type === 'message') {
      var msg = entry.message;
      if (msg.role === 'user') {
        var html = '<div class="user-message" id="'+eid+'">'+tsHtml;
        var content = msg.content;
        if (Array.isArray(content)) {
          var imgs = content.filter(function(c){return c.type==='image'});
          if (imgs.length) {
            html += '<div class="message-images">';
            imgs.forEach(function(img) {
              html += '<img src="data:'+escapeHtml(img.mimeType||'image/png')+';base64,'+img.data+'" class="message-image" />';
            });
            html += '</div>';
          }
        }
        var text = typeof content === 'string' ? content : extractContent(content);
        if (text.trim()) html += '<div class="markdown-content">'+safeMarked(text)+'</div>';
        html += '</div>';
        return html;
      }
      if (msg.role === 'assistant') {
        var html = '<div class="assistant-message" id="'+eid+'">'+tsHtml;
        var content = msg.content || [];
        content.forEach(function(block) {
          if (block.type === 'text' && block.text.trim()) {
            html += '<div class="assistant-text markdown-content">'+safeMarked(block.text)+'</div>';
          } else if (block.type === 'thinking' && block.thinking.trim()) {
            html += '<div class="thinking-block"><div class="thinking-text">'+escapeHtml(block.thinking)+'</div><div class="thinking-collapsed">Thinking ...</div></div>';
          }
        });
        content.forEach(function(block) {
          if (block.type === 'toolCall') {
            var result = TOOL_RESULT_CACHE[block.id];
            html += renderToolCall(block, result);
          }
        });
        if (msg.stopReason === 'aborted') html += '<div class="error-text">Aborted</div>';
        else if (msg.stopReason === 'error') html += '<div class="error-text">Error: '+escapeHtml(msg.errorMessage||'Unknown error')+'</div>';
        html += '</div>';
        return html;
      }
      if (msg.role === 'bashExecution') {
        var isErr = msg.cancelled || (msg.exitCode !== 0 && msg.exitCode !== null);
        var html = '<div class="tool-execution '+(isErr?'error':'success')+'" id="'+eid+'">'+tsHtml;
        html += '<div class="tool-command">$ '+escapeHtml(msg.command)+'</div>';
        if (msg.output) html += renderToolOutput(msg.output);
        if (msg.cancelled) html += '<div style="color:var(--warning)">(cancelled)</div>';
        else if (msg.exitCode !== 0 && msg.exitCode !== null) html += '<div style="color:var(--error)">(exit '+msg.exitCode+')</div>';
        html += '</div>';
        return html;
      }
      if (msg.role === 'toolResult') return '';
    }
    if (entry.type === 'model_change') {
      return '<div class="model-change" id="'+eid+'">'+tsHtml+'Switched to model: <span class="model-name">'+escapeHtml(entry.provider)+'/'+escapeHtml(entry.modelId)+'</span></div>';
    }
    if (entry.type === 'compaction') {
      return '<div class="compaction" id="'+eid+'"><div class="compaction-label">[compaction]</div><div class="compaction-collapsed">Compacted from '+entry.tokensBefore.toLocaleString()+' tokens</div></div>';
    }
    if (entry.type === 'branch_summary') {
      return '<div class="branch-summary" id="'+eid+'">'+tsHtml+'<div class="branch-summary-header">Branch Summary</div><div class="markdown-content">'+safeMarked(entry.summary||'')+'</div></div>';
    }
    if (entry.type === 'custom_message' && entry.display) {
      return '<div class="hook-message" id="'+eid+'">'+tsHtml+'<div class="hook-type">['+escapeHtml(entry.customType)+']</div><div class="markdown-content">'+safeMarked(typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content))+'</div></div>';
    }
    return '';
  }

  // Follow mode (like terminal/chat)
  var FOLLOW = true;
  var followBtn = null;
  var pendingCount = 0;
  var forcePreviewFollowUntil = 0;

  function isAtBottom() {
    var de = document.documentElement;
    var body = document.body;
    var docHeight = Math.max(de.scrollHeight, body.scrollHeight);
    var scrolled = window.scrollY || window.pageYOffset || de.scrollTop || body.scrollTop;
    var viewport = window.innerHeight;
    var remaining = docHeight - scrolled - viewport;

    var content = document.getElementById('content');
    if (content && content.scrollHeight > content.clientHeight) {
      var contentRemaining = content.scrollHeight - content.scrollTop - content.clientHeight;
      remaining = Math.max(remaining, contentRemaining);
    }

    return remaining < 80;
  }

  function chatComposerHeight() {
    var composer = document.getElementById('pi-chat-composer');
    return composer ? composer.getBoundingClientRect().height : 0;
  }

  function scrollToBottom(smooth) {
    var content = document.getElementById('content');
    if (content && content.scrollHeight > content.clientHeight) {
      content.scrollTo({ top: content.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }
    window.scrollTo({ top: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), behavior: smooth ? 'smooth' : 'auto' });
  }

  function scrollElementAboveComposer(el, smooth) {
    if (!el) {
      scrollToBottom(smooth);
      return;
    }
    var gap = chatComposerHeight() + 24;
    var content = document.getElementById('content');
    if (content && content.contains(el)) {
      var contentRect = content.getBoundingClientRect();
      var elRect = el.getBoundingClientRect();
      var delta = elRect.bottom - (contentRect.bottom - gap);
      if (delta > 0) {
        content.scrollTo({ top: content.scrollTop + delta, behavior: smooth ? 'smooth' : 'auto' });
      }
    }
    var rect = el.getBoundingClientRect();
    var viewportDelta = rect.bottom - (window.innerHeight - gap);
    if (viewportDelta > 0) {
      window.scrollTo({ top: (window.scrollY || window.pageYOffset) + viewportDelta, behavior: smooth ? 'smooth' : 'auto' });
    }
  }

  function showFollowButton() {
    if (followBtn) {
      followBtn.textContent = '↓ ' + pendingCount + ' new' + (pendingCount > 1 ? 's' : '');
      return;
    }
    followBtn = document.createElement('button');
    followBtn.textContent = '↓ ' + pendingCount + ' new' + (pendingCount > 1 ? 's' : '');
    followBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:200;padding:6px 14px;font-size:11px;font-family:inherit;background:var(--accent);color:var(--body-bg);border:none;border-radius:4px;cursor:pointer;opacity:0;transition:opacity 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    document.body.appendChild(followBtn);
    requestAnimationFrame(function() { followBtn.style.opacity = '1'; });
    followBtn.addEventListener('click', function() {
      FOLLOW = true;
      pendingCount = 0;
      scrollToBottom(true);
      hideFollowButton();
    });
  }

  function hideFollowButton() {
    if (!followBtn) return;
    followBtn.style.opacity = '0';
    setTimeout(function() {
      if (followBtn && followBtn.parentNode) {
        followBtn.parentNode.removeChild(followBtn);
      }
      followBtn = null;
    }, 200);
  }

  function onScroll() {
    var wasFollowing = FOLLOW;
    FOLLOW = isAtBottom();
    if (FOLLOW && followBtn) {
      hideFollowButton();
      pendingCount = 0;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  var contentEl = document.getElementById('content');
  if (contentEl) contentEl.addEventListener('scroll', onScroll, { passive: true });

  function scrollAfterLayout(smooth, target) {
    requestAnimationFrame(function() {
      scrollElementAboveComposer(target, !!smooth);
      setTimeout(function() { scrollElementAboveComposer(target, !!smooth); }, 40);
    });
  }

  function forceFollowToBottom(smooth) {
    FOLLOW = true;
    pendingCount = 0;
    hideFollowButton();
    scrollAfterLayout(!!smooth);
  }

  window.addEventListener('pi-chat-message-sent', function() {
    forcePreviewFollowUntil = Date.now() + 30000;
    forceFollowToBottom(true);
  });

  scrollToBottom(false);

  function buildEntryNode(entry, allEntries) {
    var html = renderEntry(entry, allEntries);
    if (!html) return null;
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var node = wrap.firstElementChild;
    if (!node) return null;
    if (typeof window.applyToggleStateToNode === 'function') {
      window.applyToggleStateToNode(node);
    }
    return node;
  }

  function replaceEntryNode(existing, node) {
    if (!existing || !node) return;
    existing.replaceWith(node);
  }

  function highlightNewEntry(node) {
    node.style.transition = 'box-shadow 0.8s ease-out';
    node.style.boxShadow = '0 0 0 2px var(--accent)';
    setTimeout(function() { node.style.boxShadow = ''; }, 1500);
  }

  function appendEntry(entry, allEntries) {
    if (SEEN.has(entry.id)) return false;
    var container = document.getElementById('messages');
    if (!container) return false;
    var node = buildEntryNode(entry, allEntries);
    SEEN.add(entry.id);
    if (!node) return false;
    container.appendChild(node);
    LIVE_RENDERED.add(entry.id);
    highlightNewEntry(node);
    return true;
  }

  function upsertEntry(entry, allEntries) {
    if (!entry.id) return false;
    var existing = document.getElementById('entry-' + entry.id);
    if (!existing) return appendEntry(entry, allEntries);
    var node = buildEntryNode(entry, allEntries);
    if (!node) return false;
    replaceEntryNode(existing, node);
    LIVE_RENDERED.add(entry.id);
    return false;
  }

  function refreshEntriesAffectedByToolResult(toolResultEntry, allEntries) {
    if (!toolResultEntry.message || !toolResultEntry.message.toolCallId) return;
    allEntries.forEach(function(candidate) {
      if (!candidate.id || !candidate.message || candidate.message.role !== 'assistant') return;
      var content = candidate.message.content || [];
      var usesToolResult = content.some(function(block) {
        if (block.type === 'toolCall' && block.id === toolResultEntry.message.toolCallId) return true;
        return false;
      });
      if (usesToolResult) upsertEntry(candidate, allEntries);
    });
  }

  function updateStats(entries) {
    var user=0, assistant=0, toolCalls=0;
    var tokens={input:0,output:0,cacheRead:0,cacheWrite:0};
    var cost={input:0,output:0,cacheRead:0,cacheWrite:0};
    var models=new Set();
    entries.forEach(function(e) {
      if (e.type !== 'message' || !e.message) return;
      var m = e.message;
      if (m.role === 'user') user++;
      if (m.role === 'assistant') {
        assistant++;
        if (m.model) models.add(m.provider ? m.provider+'/'+m.model : m.model);
        if (m.usage) {
          tokens.input += m.usage.input||0;
          tokens.output += m.usage.output||0;
          tokens.cacheRead += m.usage.cacheRead||0;
          tokens.cacheWrite += m.usage.cacheWrite||0;
          if (m.usage.cost) {
            cost.input += m.usage.cost.input||0;
            cost.output += m.usage.cost.output||0;
            cost.cacheRead += m.usage.cost.cacheRead||0;
            cost.cacheWrite += m.usage.cost.cacheWrite||0;
          }
        }
        toolCalls += (m.content||[]).filter(function(c){return c.type==='toolCall'}).length;
      }
    });
    var totalCost = cost.input+cost.output+cost.cacheRead+cost.cacheWrite;
    var headerInfo = document.querySelector('.header-info');
    if (!headerInfo) return;
    var parts = [];
    if (user) parts.push(user+' user');
    if (assistant) parts.push(assistant+' assistant');
    var rows = headerInfo.querySelectorAll('.info-item');
    rows.forEach(function(row) {
      var label = row.querySelector('.info-label');
      if (!label) return;
      var text = label.textContent;
      var val = row.querySelector('.info-value');
      if (!val) return;
      if (text.indexOf('Messages:') >= 0) val.textContent = parts.join(', ') || '0';
      if (text.indexOf('Tool Calls:') >= 0) val.textContent = toolCalls;
      if (text.indexOf('Models:') >= 0) val.textContent = Array.from(models).join(', ') || 'unknown';
      if (text.indexOf('Tokens:') >= 0) {
        var tps = [];
        if (tokens.input) tps.push('↑'+formatTokens(tokens.input));
        if (tokens.output) tps.push('↓'+formatTokens(tokens.output));
        if (tokens.cacheRead) tps.push('R'+formatTokens(tokens.cacheRead));
        if (tokens.cacheWrite) tps.push('W'+formatTokens(tokens.cacheWrite));
        val.textContent = tps.join(' ') || '0';
      }
      if (text.indexOf('Cost:') >= 0) val.textContent = '$'+totalCost.toFixed(3);
    });
  }
  function formatTokens(n) {
    if (n < 1000) return n.toString();
    if (n < 10000) return (n/1000).toFixed(1)+'k';
    if (n < 1000000) return Math.round(n/1000)+'k';
    return (n/1000000).toFixed(1)+'M';
  }

  var sessId = location.search.split('id=')[1]?.split('&')[0] || '';
  var es = new EventSource('/events?id=' + encodeURIComponent(sessId));
  var indicator = null;

  function showIndicator() {
    if (indicator) return;
    indicator = document.createElement('div');
    indicator.textContent = 'updated - tap to view';
    indicator.style.cssText = 'position:fixed;top:8px;right:8px;z-index:200;padding:2px 8px;font-size:10px;font-family:inherit;background:var(--accent);color:var(--body-bg);border-radius:3px;opacity:0;transition:opacity 0.3s;cursor:pointer;';
    indicator.addEventListener('click', function() {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('open');
      document.body.classList.remove('sidebar-open');
      var hamburger = document.getElementById('hamburger');
      if (hamburger) hamburger.style.display = '';
      scrollToBottom(true);
    });
    document.body.appendChild(indicator);
    requestAnimationFrame(function() { indicator.style.opacity = '1'; });
    setTimeout(function() {
      indicator.style.opacity = '0';
      setTimeout(function() { if(indicator){document.body.removeChild(indicator);indicator=null;} }, 300);
    }, 1200);
  }

  var chatPreviewEl = null;

  function clearChatPreview() {
    if (chatPreviewEl && chatPreviewEl.parentNode) {
      chatPreviewEl.parentNode.removeChild(chatPreviewEl);
    }
    chatPreviewEl = null;
  }

  function renderChatPreview(payload) {
    if (!payload || typeof payload.content !== 'string' || payload.content.length === 0) return;
    var container = document.getElementById('messages') || document.getElementById('content') || document.body;
    if (!chatPreviewEl) {
      chatPreviewEl = document.createElement('div');
      chatPreviewEl.id = 'chat-preview-stream';
      chatPreviewEl.className = 'assistant-message chat-preview-stream';
      chatPreviewEl.innerHTML = '<div class="message-content assistant-text"></div><div class="preview-label">working<span class="working-dots" aria-hidden="true"></span></div>';
      container.appendChild(chatPreviewEl);
    }
    var content = chatPreviewEl.querySelector('.message-content');
    if (content) {
      content.innerHTML = renderMarkdown(payload.content);
    }
    chatPreviewEl.classList.toggle('done', !!payload.done);
    if (FOLLOW || Date.now() < forcePreviewFollowUntil) {
      forceFollowToBottom(false);
      scrollAfterLayout(false, chatPreviewEl);
    }
  }

  es.onmessage = function(e) {
    if (e.data !== 'reload') return;
    fetch('/api/session?id=' + encodeURIComponent(sessId))
      .then(function(r){return r.json();})
      .then(function(data) {
        clearChatPreview();
        var entries = data.entries || [];
        var newCount = 0;
        entries.forEach(function(entry) {
          if (!entry.id) return;
          if (!SEEN.has(entry.id)) {
            if (appendEntry(entry, entries)) newCount++;
            if (entry.message && entry.message.role === 'toolResult') {
              refreshEntriesAffectedByToolResult(entry, entries);
            }
          } else if (LIVE_RENDERED.has(entry.id)) {
            upsertEntry(entry, entries);
            if (entry.message && entry.message.role === 'toolResult') {
              refreshEntriesAffectedByToolResult(entry, entries);
            }
          } else if (entry.message && entry.message.role === 'toolResult') {
            refreshEntriesAffectedByToolResult(entry, entries);
          }
        });
        if (newCount > 0) {
          showIndicator();
          updateStats(entries);
          if (FOLLOW) {
            scrollAfterLayout(true);
          } else {
            pendingCount += newCount;
            showFollowButton();
          }
        }
      })
      .catch(function(err){ console.error('Live update failed:', err); });
  };
  es.addEventListener('chat-preview', function(e) {
    try {
      renderChatPreview(JSON.parse(e.data));
    } catch (_) {}
  });
  es.onerror = function() {};

  // Share button
  var shareBtn = document.getElementById('share-btn');
  var shareOverlay = null;

  function showShareResult(gistUrl, previewUrl) {
    if (shareOverlay) shareOverlay.remove();
    shareOverlay = document.createElement('div');
    shareOverlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:300;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--container-bg);border:1px solid var(--dim);border-radius:4px;padding:calc(var(--line-height)*2);max-width:500px;width:90%;font-family:inherit;';
    box.innerHTML = '<h3 style="margin:0 0 var(--line-height);font-size:12px;color:var(--border-accent);">Session Shared</h3>' +
      '<div style="margin-bottom:var(--line-height);"><label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">Gist URL</label>' +
      '<input readonly value="'+escapeHtml(gistUrl)+'" style="width:100%;padding:4px 8px;font-size:11px;font-family:inherit;background:var(--body-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;" onclick="this.select()"></div>' +
      '<div style="margin-bottom:var(--line-height);"><label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">Preview URL</label>' +
      '<input readonly value="'+escapeHtml(previewUrl)+'" style="width:100%;padding:4px 8px;font-size:11px;font-family:inherit;background:var(--body-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;" onclick="this.select()"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
      '<button id="share-copy-gist" style="padding:4px 10px;font-size:11px;font-family:inherit;background:var(--accent);color:var(--body-bg);border:none;border-radius:3px;cursor:pointer;">Copy Gist</button>' +
      '<button id="share-copy-preview" style="padding:4px 10px;font-size:11px;font-family:inherit;background:var(--container-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;">Copy Preview</button>' +
      '<button id="share-close" style="padding:4px 10px;font-size:11px;font-family:inherit;background:var(--container-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;">Close</button></div>';
    shareOverlay.appendChild(box);
    document.body.appendChild(shareOverlay);

    shareOverlay.addEventListener('click', function(e) {
      if (e.target === shareOverlay) { shareOverlay.remove(); shareOverlay = null; }
    });
    document.getElementById('share-close').addEventListener('click', function() {
      shareOverlay.remove(); shareOverlay = null;
    });
    var shareCopyHideTimer;
    function showShareCopiedNotice(label, text) {
      var notice = document.getElementById('share-copy-notice');
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'share-copy-notice';
        notice.style.cssText = 'position:fixed;top:8px;right:8px;z-index:400;padding:2px 8px;font-size:10px;font-family:inherit;background:var(--accent);color:var(--body-bg);border-radius:3px;opacity:0;transition:opacity 0.3s;';
        document.body.appendChild(notice);
      }
      notice.textContent = label + ' copied';
      notice.title = text;
      clearTimeout(shareCopyHideTimer);
      notice.style.opacity = '1';
      shareCopyHideTimer = setTimeout(function() { notice.style.opacity = '0'; }, 1200);
    }
    function copyShareUrl(text, label) {
      function fallbackCopy() {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) showShareCopiedNotice(label, text);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() { showShareCopiedNotice(label, text); }).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    }
    document.getElementById('share-copy-gist').addEventListener('click', function() {
      copyShareUrl(gistUrl, 'Gist');
    });
    document.getElementById('share-copy-preview').addEventListener('click', function() {
      copyShareUrl(previewUrl, 'Preview');
    });
  }

  function showShareError(msg) {
    if (shareOverlay) shareOverlay.remove();
    shareOverlay = document.createElement('div');
    shareOverlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:300;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--container-bg);border:1px solid var(--error);border-radius:4px;padding:calc(var(--line-height)*2);max-width:400px;width:90%;font-family:inherit;';
    box.innerHTML = '<h3 style="margin:0 0 var(--line-height);font-size:12px;color:var(--error);">Share Failed</h3>' +
      '<p style="font-size:11px;color:var(--text);margin:0 0 var(--line-height);white-space:pre-wrap;">'+escapeHtml(msg)+'</p>' +
      '<div style="display:flex;justify-content:flex-end;"><button id="share-close-err" style="padding:4px 10px;font-size:11px;font-family:inherit;background:var(--container-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;">Close</button></div>';
    shareOverlay.appendChild(box);
    document.body.appendChild(shareOverlay);
    document.getElementById('share-close-err').addEventListener('click', function() {
      shareOverlay.remove(); shareOverlay = null;
    });
    shareOverlay.addEventListener('click', function(e) {
      if (e.target === shareOverlay) { shareOverlay.remove(); shareOverlay = null; }
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', function() {
      shareBtn.textContent = '...';
      shareBtn.disabled = true;
      fetch('/share?id=' + encodeURIComponent(sessId), { method: 'POST' })
        .then(function(r){ return r.json(); })
        .then(function(data) {
          shareBtn.textContent = '↗ Share';
          shareBtn.disabled = false;
          if (data.error) {
            showShareError(data.error + (data.stderr ? '\n\n' + data.stderr : ''));
          } else {
            showShareResult(data.gistUrl, data.previewUrl);
          }
        })
        .catch(function(err) {
          shareBtn.textContent = '↗ Share';
          shareBtn.disabled = false;
          showShareError(err.message || 'Network error');
        });
    });
  }

  // Terminal button
  var resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', function() {
      var resumeSessionArg = document.body.dataset.sessionUuid;
      var cmd = 'pi --session ' + resumeSessionArg;
      var hideTimer;
      function showCopiedNotice() {
        var notice = document.getElementById('resume-copy-notice');
        if (!notice) {
          notice = document.createElement('div');
          notice.id = 'resume-copy-notice';
          notice.style.cssText = 'position:fixed;top:8px;right:8px;z-index:200;padding:2px 8px;font-size:10px;font-family:inherit;background:var(--accent);color:var(--body-bg);border-radius:3px;opacity:0;transition:opacity 0.3s;';
          document.body.appendChild(notice);
        }
        notice.textContent = 'Copied';
        notice.title = cmd;
        clearTimeout(hideTimer);
        notice.style.opacity = '1';
        hideTimer = setTimeout(function() {
          notice.style.opacity = '0';
        }, 1200);
      }
      function fallbackCopy() {
        var textarea = document.createElement('textarea');
        textarea.value = cmd;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) showCopiedNotice();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd).then(showCopiedNotice).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    });
  }
})();
