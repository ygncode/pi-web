export function createLiveRenderer({ documentImpl = document, markedImpl = marked } = {}) {
  function escapeHtml(t) {
    var d = documentImpl.createElement('div');
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
    try { return markedImpl.parse(text); } catch(e) { return escapeHtml(text); }
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
    } else if (call.name === 'ask_user_question' || call.name === 'pi_web_ask_user_question') {
      var questions = Array.isArray(args.questions) ? args.questions : [];
      var qaAnswers = result && result.details && result.details.answers ? result.details.answers : {};
      var qaCancelled = result && result.details && result.details.cancelled === true;
      var qaAwaitingReply = !!(result && result.details && result.details.awaitingChatReply === true);
      var qaFailed = !!(result && result.isError);
      var qaInteractive = !result || qaFailed || qaCancelled || qaAwaitingReply;
      var qaMulti = questions.length > 1;
      var qaAnyMultiSelect = questions.some(function(q){ return q && q.multiSelect === true; });
      var qaNeedsSubmit = qaMulti || qaAnyMultiSelect;
      html = '<div class="tool-execution '+status+'">';
      html += '<div class="ask-question-card" data-question-count="'+questions.length+'" data-needs-submit="'+qaNeedsSubmit+'">';
      html += '<div class="ask-question-title">Question for you</div>';
      if (qaFailed) {
        html += '<div class="ask-question-state error">question UI failed</div>';
      } else if (qaCancelled) {
        html += '<div class="ask-question-state error">cancelled</div>';
      } else if (qaAwaitingReply) {
        html += '<div class="ask-question-state pending">waiting for response</div>';
      } else if (result) {
        html += '<div class="ask-question-state answered">answered</div>';
      } else {
        html += '<div class="ask-question-state pending">waiting for response</div>';
      }
      questions.forEach(function(q, qi) {
        var questionText = typeof q.question === 'string' ? q.question : 'Question '+(qi+1);
        var answer = qaAnswers[questionText];
        var options = Array.isArray(q.options) ? q.options : [];
        var multiSelect = q && q.multiSelect === true;
        html += '<div class="ask-question-block" data-question-text="'+escapeHtml(questionText)+'" data-multi-select="'+multiSelect+'">';
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
        if (qaNeedsSubmit) {
          html += '<div class="ask-question-actions" style="display:none"><button type="button" class="ask-question-submit-btn">Send answers</button></div>';
        } else if (qaFailed || qaCancelled) {
          html += '<div class="ask-question-hint">Click an option to send your answer to pi.</div>';
        } else {
          html += '<div class="ask-question-hint">Click an option, or use the chat composer below, to answer this question.</div>';
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
      if (entry.implicit) return '';
      return '<div class="model-change" id="'+eid+'">'+tsHtml+'Switched to model: <span class="model-name">'+escapeHtml(entry.provider)+'/'+escapeHtml(entry.modelId)+'</span></div>';
    }
    if (entry.type === 'thinking_level_change' && entry.implicit) return '';
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

  return {
    renderEntry,
    renderToolOutput,
    renderToolCall,
    renderMarkdown: safeMarked
  };
}
