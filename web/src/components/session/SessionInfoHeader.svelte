<script>
  // The in-content session header card (#header-container). Reactive, live-safe
  // (no SSE/fetch) → used by both the live app and the static export. Markup
  // mirrors the old session-header-renderer.js so CSS + the toggle controller
  // (which binds the data-action buttons) keep working. See
  // docs/dev/svelte-migration-plan.md (Phase 2).
  import { getSessionModel } from '../../session/session-context.js';
  import { computeSessionStats, summarizeSessionStats } from '../../session/render/session-stats.js';
  import { icon, Download } from '../../shared/icons.js';

  let { model = getSessionModel() } = $props();

  const SYSTEM_PROMPT_PREVIEW_LINES = 10;

  const stats = $derived(summarizeSessionStats(computeSessionStats(model.entries)));
  const sessionIdText = $derived(model.header?.id || 'unknown');
  const dateText = $derived(
    model.header?.timestamp ? new Date(model.header.timestamp).toLocaleString() : 'unknown',
  );
  const systemPrompt = $derived(model.systemPrompt || '');
  const promptLines = $derived(systemPrompt ? systemPrompt.split('\n') : []);
  const promptIsLong = $derived(promptLines.length > SYSTEM_PROMPT_PREVIEW_LINES);
  const promptPreview = $derived(promptLines.slice(0, SYSTEM_PROMPT_PREVIEW_LINES).join('\n'));
  const tools = $derived(Array.isArray(model.tools) ? model.tools : []);

  let promptExpanded = $state(false);
  let expandedTools = $state(new Set());

  function hasSelection() {
    return typeof window !== 'undefined' && !!window.getSelection?.().toString();
  }
  function togglePrompt() {
    if (hasSelection()) return;
    promptExpanded = !promptExpanded;
  }
  function toggleTool(i) {
    if (hasSelection()) return;
    const next = new Set(expandedTools);
    next.has(i) ? next.delete(i) : next.add(i);
    expandedTools = next;
  }
  function toolParams(tool) {
    const params = tool.parameters;
    const hasParams = params && typeof params === 'object' && params.properties &&
      Object.keys(params.properties).length > 0;
    if (!hasParams) return null;
    const required = params.required || [];
    return Object.entries(params.properties).map(([name, prop]) => ({
      name,
      type: prop.type || 'any',
      required: required.includes(name),
      description: prop.description || '',
    }));
  }
  function downloadJson() {
    window.downloadSessionJson?.();
  }
</script>

<div class="header">
  <h1>Session: {sessionIdText}</h1>
  <div class="help-bar">
    <span class="help-hint">T show/hide thinking · O show/hide tools · P expand/collapse tool output</span>
    <div class="help-actions">
      <button type="button" class="header-toggle-btn" data-action="toggle-thinking" title="Show/hide thinking (T)">Thinking</button>
      <button type="button" class="header-toggle-btn" data-action="toggle-tools" title="Show/hide tools (O)">Tools</button>
      <button type="button" class="header-toggle-btn" data-action="toggle-tool-output" title="Expand/collapse tool output (P)">Tool output</button>
      <button type="button" class="download-json-btn" onclick={downloadJson} title="Download session as JSONL">{@html icon(Download, { size: 13 })} JSONL</button>
    </div>
  </div>
  <div class="header-info">
    <div class="info-item"><span class="info-label">Date:</span><span class="info-value">{dateText}</span></div>
    <div class="info-item"><span class="info-label">Models:</span><span class="info-value">{stats.modelsText}</span></div>
    <div class="info-item"><span class="info-label">Messages:</span><span class="info-value">{stats.messagesText}</span></div>
    <div class="info-item"><span class="info-label">Tool Calls:</span><span class="info-value">{stats.toolCalls}</span></div>
    <div class="info-item"><span class="info-label">Tokens:</span><span class="info-value">{stats.tokensText}</span></div>
    <div class="info-item"><span class="info-label">Cost:</span><span class="info-value">{stats.costText}</span></div>
  </div>
</div>

{#if systemPrompt}
  {#if promptIsLong}
    <div class="system-prompt expandable" class:expanded={promptExpanded} onclick={togglePrompt} role="button" tabindex="0" onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && togglePrompt()}>
      <div class="system-prompt-header">System Prompt</div>
      <div class="system-prompt-preview">{promptPreview}</div>
      <div class="system-prompt-expand-hint">... ({promptLines.length - SYSTEM_PROMPT_PREVIEW_LINES} more lines, click to expand)</div>
      <div class="system-prompt-full">{systemPrompt}</div>
    </div>
  {:else}
    <div class="system-prompt">
      <div class="system-prompt-header">System Prompt</div>
      <div class="system-prompt-full" style="display: block">{systemPrompt}</div>
    </div>
  {/if}
{/if}

{#if tools.length > 0}
  <div class="tools-list">
    <div class="tools-header">Available Tools</div>
    <div class="tools-content">
      {#each tools as tool, i}
        {@const params = toolParams(tool)}
        {#if !params}
          <div class="tool-item"><span class="tool-item-name">{tool.name}</span> - <span class="tool-item-desc">{tool.description}</span></div>
        {:else}
          <div class="tool-item" class:params-expanded={expandedTools.has(i)} onclick={() => toggleTool(i)} role="button" tabindex="0" onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleTool(i)}>
            <span class="tool-item-name">{tool.name}</span> - <span class="tool-item-desc">{tool.description}</span> <span class="tool-params-hint"></span>
            <div class="tool-params-content">
              {#each params as p}
                <div class="tool-param">
                  <span class="tool-param-name">{p.name}</span> <span class="tool-param-type">{p.type}</span>
                  {#if p.required}<span class="tool-param-required">required</span>{:else}<span class="tool-param-optional">optional</span>{/if}
                  {#if p.description}<div class="tool-param-desc">{p.description}</div>{/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}
