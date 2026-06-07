<script>
  // One assistant tool call. Dispatches on the tool name to a declarative
  // rendering of its arguments + (looked-up) result. Mirrors the former
  // renderToolCall(). {@html} is used only for pre-rendered (ANSI) custom-tool
  // HTML; everything else is escaped Svelte template. The result element keeps
  // the `entry-<resultId>` anchor so annotations + scroll still work.
  import { shortenPath } from '../../session/render/session-format.js';
  import { getLanguageFromPath, str } from '../../session/render/entry-format.js';
  import ToolOutput, { toggleExpanded } from './ToolOutput.svelte';
  import AskQuestion from './AskQuestion.svelte';

  let { call, model } = $props();

  const resultEntry = $derived.by(() => {
    for (const entry of model?.entries || []) {
      if (entry.type === 'message' && entry.message.role === 'toolResult'
        && entry.message.toolCallId === call.id) return entry;
    }
    return null;
  });
  const result = $derived(resultEntry?.message || null);
  const statusClass = $derived(result ? (result.isError ? 'error' : 'success') : 'pending');
  const args = $derived(call.arguments || {});

  const resultText = $derived(
    result ? result.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : '',
  );
  const resultImages = $derived(result ? result.content.filter((c) => c.type === 'image') : []);
  const rendered = $derived(model?.renderedTools?.[call.id] || null);

  // read/write/edit/ls share a file-path arg; compute it once.
  const filePath = $derived(str(args.file_path ?? args.path));
</script>

<div class="tool-execution {statusClass}" id={resultEntry ? `entry-${resultEntry.id}` : undefined}>
  {#if call.name === 'bash'}
    {@const command = str(args.command)}
    <div class="tool-command">$ {#if command === null}<span class="tool-error">[invalid arg]</span>{:else}{command || '...'}{/if}</div>
    {#if result && resultText.trim()}<ToolOutput text={resultText.trim()} maxLines={5} />{/if}

  {:else if call.name === 'read'}
    <div class="tool-header"><span class="tool-name">read</span> <span class="tool-path">{#if filePath === null}<span class="tool-error">[invalid arg]</span>{:else}{shortenPath(filePath || '')}{#if args.offset !== undefined || args.limit !== undefined}<span class="line-numbers">:{args.offset ?? 1}{args.limit !== undefined ? '-' + ((args.offset ?? 1) + args.limit - 1) : ''}</span>{/if}{/if}</span></div>
    {#if result}
      {#if resultImages.length > 0}<div class="tool-images">{#each resultImages as img}<img src={`data:${img.mimeType || 'image/png'};base64,${img.data}`} class="tool-image" alt="" />{/each}</div>{/if}
      {#if resultText}<ToolOutput text={resultText} maxLines={10} lang={filePath ? getLanguageFromPath(filePath) : null} />{/if}
    {/if}

  {:else if call.name === 'write'}
    {@const content = str(args.content)}
    {@const lineCount = content ? content.split('\n').length : 0}
    <div class="tool-header"><span class="tool-name">write</span> <span class="tool-path">{#if filePath === null}<span class="tool-error">[invalid arg]</span>{:else}{shortenPath(filePath || '')}{/if}</span>{#if content !== null && content && lineCount > 10} <span class="line-count">({lineCount} lines)</span>{/if}</div>
    {#if content === null}<div class="tool-error">[invalid content arg - expected string]</div>{:else if content}<ToolOutput text={content} maxLines={10} lang={filePath ? getLanguageFromPath(filePath) : null} />{/if}
    {#if result && resultText.trim()}<div class="tool-output"><div>{resultText.trim()}</div></div>{/if}

  {:else if call.name === 'edit'}
    <div class="tool-header"><span class="tool-name">edit</span> <span class="tool-path">{#if filePath === null}<span class="tool-error">[invalid arg]</span>{:else}{shortenPath(filePath || '')}{/if}</span></div>
    {#if result?.details?.diff}
      <div class="tool-diff">{#each result.details.diff.split('\n') as line}<div class={line.match(/^\+/) ? 'diff-added' : line.match(/^-/) ? 'diff-removed' : 'diff-context'}>{line.replace(/\t/g, '   ')}</div>{/each}</div>
    {:else if result && resultText.trim()}<div class="tool-output"><pre>{resultText.trim()}</pre></div>{/if}

  {:else if call.name === 'ls'}
    <div class="tool-header"><span class="tool-name">ls</span> <span class="tool-path">{#if str(args.path) === null}<span class="tool-error">[invalid arg]</span>{:else}{shortenPath(str(args.path) || '.')}{/if}{#if args.limit !== undefined} <span class="line-count">(limit {args.limit})</span>{/if}</span></div>
    {#if result && resultText.trim()}<ToolOutput text={resultText.trim()} maxLines={20} />{/if}

  {:else if call.name === 'ask_user_question' || call.name === 'pi_web_ask_user_question'}
    <AskQuestion {args} {result} />

  {:else if rendered && (rendered.callHtml || rendered.resultHtmlCollapsed || rendered.resultHtmlExpanded)}
    {#if rendered.callHtml}<div class="tool-header ansi-rendered">{@html rendered.callHtml}</div>{:else}<div class="tool-header"><span class="tool-name">{call.name}</span></div>{/if}
    {#if rendered.resultHtmlCollapsed && rendered.resultHtmlExpanded && rendered.resultHtmlCollapsed !== rendered.resultHtmlExpanded}
      <div class="tool-output expandable ansi-rendered" onclick={toggleExpanded} role="presentation">
        <div class="output-preview">{@html rendered.resultHtmlCollapsed}</div>
        <div class="output-full">{@html rendered.resultHtmlExpanded}</div>
      </div>
    {:else if rendered.resultHtmlExpanded}
      <div class="tool-output ansi-rendered">{@html rendered.resultHtmlExpanded}</div>
    {:else if result && resultText}<ToolOutput text={resultText} maxLines={10} />{/if}

  {:else}
    <div class="tool-header"><span class="tool-name">{call.name}</span></div>
    <div class="tool-output"><pre>{JSON.stringify(args, null, 2)}</pre></div>
    {#if result && resultText}<ToolOutput text={resultText} maxLines={10} />{/if}
  {/if}
</div>
