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
  import SubagentCall from './SubagentCall.svelte';
  import {
    subagentView,
    subagentSummary,
    liveProgress,
    TOOL_PROGRESS_EVENT,
    SUBAGENT_TOOL,
  } from '../../session/ui/subagent-view.js';
  import {
    isOpen,
    toggleOpen,
    toolKind,
    toolLabel,
    toolSummary,
    kindIcon,
    baseName,
    diffStats,
    todoProgress,
  } from '../../session/ui/collapse-state.js';
  import { icon } from '../../shared/icons.js';

  let { call, model } = $props();

  const resultEntry = $derived.by(() => {
    for (const entry of model?.entries || []) {
      if (
        entry.type === 'message' &&
        entry.message.role === 'toolResult' &&
        entry.message.toolCallId === call.id
      )
        return entry;
    }
    return null;
  });
  const result = $derived(resultEntry?.message || null);
  const statusClass = $derived(result ? (result.isError ? 'error' : 'success') : 'pending');
  const args = $derived(call.arguments || {});

  const resultText = $derived(
    result
      ? result.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n')
      : '',
  );
  const resultImages = $derived(result ? result.content.filter((c) => c.type === 'image') : []);
  const rendered = $derived(model?.renderedTools?.[call.id] || null);

  // read/write/edit/ls share a file-path arg; compute it once.
  const filePath = $derived(str(args.file_path ?? args.path));

  // zcode/Codex-style collapsible row: one-line summary, expand on tap.
  const kind = $derived(toolKind(call.name));
  const label = $derived(toolLabel(call.name));
  const isQuestion = $derived(
    call.name === 'ask_user_question' ||
      call.name === 'pi_web_ask_user_question' ||
      call.name === 'ask_question',
  );
  const isSubagent = $derived(call.name === SUBAGENT_TOOL);
  let subLive = $state(null);
  $effect(() => {
    if (!isSubagent || result) return;
    subLive = liveProgress(call.id);
    const on = (e) => {
      if (e.detail?.toolCallId === call.id) subLive = e.detail.details;
    };
    window.addEventListener(TOOL_PROGRESS_EVENT, on);
    return () => window.removeEventListener(TOOL_PROGRESS_EVENT, on);
  });
  const subSummary = $derived(
    isSubagent ? subagentSummary(subagentView(args, result?.details || subLive, { final: !!result })) : '',
  );
  const summary = $derived.by(() => {
    if (isSubagent) return subSummary;
    const s = toolSummary(call.name, args);
    return ['read', 'edit', 'write', 'ls'].includes(kind) && s ? shortenPath(s) : s;
  });
  const fileKinds = ['read', 'edit', 'write'];
  const fileBadge = $derived(fileKinds.includes(kind) && filePath ? baseName(filePath) : '');
  // with a file badge, the muted detail shows the directory only
  const detail = $derived.by(() => {
    if (!fileBadge) return summary;
    const s = String(summary || '');
    const cut = s.lastIndexOf('/');
    return cut > 0 ? s.slice(0, cut + 1) : '';
  });
  const stats = $derived(diffStats(kind, args, result));
  const progress = $derived(kind === 'todo' ? todoProgress(args, resultText) : null);
  const rowKey = $derived(`tool:${call.id}`);
  // Default: open while running or when it needs an answer; collapsed when done.
  const open = $derived(isOpen(rowKey, isQuestion || statusClass === 'pending'));
  function onHeadClick(e) {
    e.stopPropagation();
    toggleOpen(rowKey, isQuestion || statusClass === 'pending');
  }
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG and rendered session markdown -->

<!--
  The .tool-call-collapsed sibling mirrors the .thinking-collapsed pattern:
  applyToggleStateToNode (web/src/session/ui/toggle-state.js) shows it whenever
  state.toolsVisible is false so an assistant message whose only content is a
  tool call doesn't render as a stranded timestamp.
-->
<div class="tool-call-collapsed">Tool: {call.name} ...</div>
<div
  class="tool-execution {statusClass} zc-row {open ? 'zc-open' : 'zc-collapsed'}"
  data-tool={kind}
  id={resultEntry ? `entry-${resultEntry.id}` : undefined}
>
  <button type="button" class="zc-row-head" aria-expanded={open} onclick={onHeadClick}>
    <span class="zc-chevron" aria-hidden="true"></span>
    <span class="zc-icon" aria-hidden="true">{@html icon(kindIcon(kind), { size: 14, strokeWidth: 2 })}</span>
    <span class="zc-label">{label}</span>
    {#if fileBadge}<span class="zc-file">{fileBadge}</span>{/if}
    {#if stats}<span class="zc-diffstat"
        >{#if stats.added}<span class="zc-add">+{stats.added}</span>{/if}{#if stats.removed}<span
            class="zc-del">−{stats.removed}</span
          >{/if}</span
      >{/if}
    {#if progress}<span class="zc-progress" class:zc-progress-done={progress.done === progress.total}
        >{progress.done}/{progress.total}</span
      >{/if}
    <span class="zc-arg">{detail}</span>
    <span class="zc-status zc-status-{statusClass}" aria-hidden="true"></span>
  </button>
  <div class="zc-row-body">
  {#if call.name === 'bash'}
    {@const command = str(args.command)}
    <div class="tool-command">
      $ {#if command === null}<span class="tool-error">[invalid arg]</span>{:else}{command ||
          '...'}{/if}
    </div>
    {#if result && resultText.trim()}<ToolOutput text={resultText.trim()} maxLines={5} />{/if}
  {:else if call.name === 'read'}
    <div class="tool-header">
      <span class="tool-name">read</span>
      <span class="tool-path"
        >{#if filePath === null}<span class="tool-error">[invalid arg]</span>{:else}{shortenPath(
            filePath || '',
          )}{#if args.offset !== undefined || args.limit !== undefined}<span class="line-numbers"
              >:{args.offset ?? 1}{args.limit !== undefined
                ? '-' + ((args.offset ?? 1) + args.limit - 1)
                : ''}</span
            >{/if}{/if}</span
      >
    </div>
    {#if result}
      {#if resultImages.length > 0}<div class="tool-images">
          {#each resultImages as img, imgIndex (imgIndex)}<img
              src={`data:${img.mimeType || 'image/png'};base64,${img.data}`}
              class="tool-image"
              alt=""
            />{/each}
        </div>{/if}
      {#if resultText}<ToolOutput
          text={resultText}
          maxLines={10}
          lang={filePath ? getLanguageFromPath(filePath) : null}
        />{/if}
    {/if}
  {:else if call.name === 'write'}
    {@const content = str(args.content)}
    {@const lineCount = content ? content.split('\n').length : 0}
    <div class="tool-header">
      <span class="tool-name">write</span>
      <span class="tool-path"
        >{#if filePath === null}<span class="tool-error">[invalid arg]</span>{:else}{shortenPath(
            filePath || '',
          )}{/if}</span
      >{#if content !== null && content && lineCount > 10}
        <span class="line-count">({lineCount} lines)</span>{/if}
    </div>
    {#if content === null}<div class="tool-error">
        [invalid content arg - expected string]
      </div>{:else if content}<ToolOutput
        text={content}
        maxLines={10}
        lang={filePath ? getLanguageFromPath(filePath) : null}
      />{/if}
    {#if result && resultText.trim()}<div class="tool-output">
        <div>{resultText.trim()}</div>
      </div>{/if}
  {:else if call.name === 'edit'}
    <div class="tool-header">
      <span class="tool-name">edit</span>
      <span class="tool-path"
        >{#if filePath === null}<span class="tool-error">[invalid arg]</span>{:else}{shortenPath(
            filePath || '',
          )}{/if}</span
      >
    </div>
    {#if result?.details?.diff}
      <div class="tool-diff">
        {#each result.details.diff.split('\n') as line, lineIndex (lineIndex)}<div
            class={line.match(/^\+/)
              ? 'diff-added'
              : line.match(/^-/)
                ? 'diff-removed'
                : 'diff-context'}
          >
            {line.replace(/\t/g, '   ')}
          </div>{/each}
      </div>
    {:else if result && resultText.trim()}<div class="tool-output">
        <pre>{resultText.trim()}</pre>
      </div>{/if}
  {:else if call.name === 'ls'}
    <div class="tool-header">
      <span class="tool-name">ls</span>
      <span class="tool-path"
        >{#if str(args.path) === null}<span class="tool-error">[invalid arg]</span
          >{:else}{shortenPath(str(args.path) || '.')}{/if}{#if args.limit !== undefined}
          <span class="line-count">(limit {args.limit})</span>{/if}</span
      >
    </div>
    {#if result && resultText.trim()}<ToolOutput text={resultText.trim()} maxLines={20} />{/if}
  {:else if call.name === 'ask_user_question' || call.name === 'pi_web_ask_user_question' || call.name === 'ask_question'}
    <AskQuestion {args} {result} />
  {:else if isSubagent}
    <SubagentCall {call} {result} />
  {:else if rendered && (rendered.callHtml || rendered.resultHtmlCollapsed || rendered.resultHtmlExpanded)}
    {#if rendered.callHtml}<div class="tool-header ansi-rendered">
        {@html rendered.callHtml}
      </div>{:else}<div class="tool-header"><span class="tool-name">{call.name}</span></div>{/if}
    {#if rendered.resultHtmlCollapsed && rendered.resultHtmlExpanded && rendered.resultHtmlCollapsed !== rendered.resultHtmlExpanded}
      <div
        class="tool-output expandable ansi-rendered"
        onclick={toggleExpanded}
        role="presentation"
      >
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
</div>
