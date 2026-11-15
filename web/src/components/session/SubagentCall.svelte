<script>
  // Card view for the pi subagent extension (single / parallel / chain):
  // one row per child agent with live status, model, recent tool calls and
  // the final output. Live updates come from the "tool-progress" SSE event.
  import {
    subagentView,
    liveProgress,
    usageLine,
    TOOL_PROGRESS_EVENT,
  } from '../../session/ui/subagent-view.js';

  let { call, result = null } = $props();

  let liveDetails = $state(null);
  $effect(() => {
    const id = call?.id;
    if (!id || result) return;
    liveDetails = liveProgress(id);
    const on = (e) => {
      if (e.detail?.toolCallId === id) liveDetails = e.detail.details;
    };
    window.addEventListener(TOOL_PROGRESS_EVENT, on);
    return () => window.removeEventListener(TOOL_PROGRESS_EVENT, on);
  });

  const view = $derived(
    subagentView(call?.arguments || {}, result?.details || liveDetails, { final: !!result }),
  );
  let openOut = $state({});
  const STATUS = { pending: 'na fila', running: 'rodando', completed: 'ok', failed: 'falhou', aborted: 'abortado' };
</script>

<div class="subagent-runs" data-mode={view.mode}>
  {#each view.runs as run, i (i)}
    <div class="subagent-run" data-status={run.status}>
      <div class="subagent-run-head">
        <span class="subagent-dot subagent-dot-{run.status}" aria-hidden="true"></span>
        {#if view.mode === 'chain'}<span class="subagent-step">{run.step || i + 1}.</span>{/if}
        <span class="subagent-agent">{run.agent}</span>
        <span class="subagent-status">{STATUS[run.status] || run.status}</span>
        {#if run.model}<span class="subagent-model">{run.model}</span>{/if}
        {#if usageLine(run.usage)}<span class="subagent-usage">{usageLine(run.usage)}</span>{/if}
      </div>
      {#if run.task}<div class="subagent-task">{run.task}</div>{/if}
      {#if run.items.length && run.status !== 'completed'}
        <ul class="subagent-items">
          {#each run.items as it, j (j)}
            <li class="subagent-item subagent-item-{it.kind}">
              {#if it.kind === 'tool'}<span class="subagent-item-name">{it.name}</span>{/if}
              <span class="subagent-item-text">{it.text}</span>
            </li>
          {/each}
        </ul>
      {/if}
      {#if run.error}<div class="subagent-error">{run.error}</div>{/if}
      {#if run.output}
        <button
          type="button"
          class="subagent-out-toggle"
          aria-expanded={!!openOut[i]}
          onclick={() => (openOut = { ...openOut, [i]: !openOut[i] })}
          >{openOut[i] ? 'ocultar saída' : 'ver saída'}</button
        >
        {#if openOut[i]}<pre class="subagent-output">{run.output}</pre>{/if}
      {/if}
    </div>
  {/each}
</div>
