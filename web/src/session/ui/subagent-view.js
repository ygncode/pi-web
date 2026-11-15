// View model for the pi subagent extension's tool call (single / parallel /
// chain). Works from either the final toolResult details (full child
// transcripts) or the compact live "tool-progress" payload the server
// broadcasts while the call runs.

export const SUBAGENT_TOOL = 'subagent';
export const TOOL_PROGRESS_EVENT = 'pi:tool-progress';

const live = new Map(); // toolCallId -> compact details

export function recordToolProgress(payload, target = globalThis) {
  if (!payload?.toolCallId || !payload.details) return;
  live.set(payload.toolCallId, payload.details);
  try {
    target.dispatchEvent?.(new CustomEvent(TOOL_PROGRESS_EVENT, { detail: payload }));
  } catch {
    /* ignore */
  }
}

export function liveProgress(toolCallId) {
  return live.get(toolCallId) || null;
}

export function _resetLiveProgress() {
  live.clear();
}

function clip(s, n) {
  const t = String(s || '');
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

function itemsFromMessages(messages = []) {
  const items = [];
  let output = '';
  for (const m of messages) {
    if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue;
    for (const c of m.content) {
      if (c?.type === 'toolCall') {
        items.push({ kind: 'tool', name: c.name, text: clip(JSON.stringify(c.arguments ?? {}), 160) });
      } else if (c?.type === 'text' && c.text) {
        items.push({ kind: 'text', text: clip(c.text, 240) });
        output = c.text;
      }
    }
  }
  return { items: items.slice(-6), output };
}

function statusOf(r, final) {
  if (r.status) return r.status;
  if (r.exitCode == null) return final ? 'completed' : 'running';
  return r.exitCode === 0 ? 'completed' : 'failed';
}

/** Planned tasks from the call arguments (before any progress arrives). */
export function plannedTasks(args = {}) {
  if (Array.isArray(args.tasks)) return { mode: 'parallel', tasks: args.tasks };
  if (Array.isArray(args.chain)) return { mode: 'chain', tasks: args.chain };
  if (args.agent) return { mode: 'single', tasks: [{ agent: args.agent, task: args.task }] };
  return { mode: 'single', tasks: [] };
}

/**
 * Normalise into { mode, runs: [{agent, task, status, model, step, items,
 * output, usage, error}], done, failed, total }.
 */
export function subagentView(args, details, { final = false } = {}) {
  const plan = plannedTasks(args);
  const mode = details?.mode || plan.mode;
  const results = Array.isArray(details?.results) ? details.results : [];
  const runs = [];
  const n = Math.max(results.length, plan.tasks.length);
  for (let i = 0; i < n; i++) {
    const r = results[i];
    const p = plan.tasks[i] || {};
    if (!r) {
      runs.push({
        agent: p.agent || '?',
        task: clip(p.task, 400),
        status: final ? 'failed' : 'pending',
        step: mode === 'chain' ? i + 1 : 0,
        items: [],
        output: '',
      });
      continue;
    }
    const fromMsgs = Array.isArray(r.messages) ? itemsFromMessages(r.messages) : null;
    runs.push({
      agent: r.agent || p.agent || '?',
      task: clip(r.task || p.task, 400),
      status: statusOf(r, final),
      model: r.model || '',
      step: r.step || (mode === 'chain' ? i + 1 : 0),
      items: fromMsgs ? fromMsgs.items : r.items || [],
      output: fromMsgs ? fromMsgs.output : r.output || '',
      usage: r.usage || null,
      error: r.errorMessage || '',
    });
  }
  const done = runs.filter((r) => r.status === 'completed').length;
  const failed = runs.filter((r) => r.status === 'failed' || r.status === 'aborted').length;
  return { mode, runs, done, failed, total: runs.length };
}

const MODE_LABEL = { single: 'agente', parallel: 'paralelo', chain: 'cadeia' };

export function subagentSummary(view) {
  if (!view || !view.total) return '';
  const head = MODE_LABEL[view.mode] || view.mode;
  if (view.mode === 'single') return `${head} · ${view.runs[0].agent}`;
  const fail = view.failed ? ` · ${view.failed} falha${view.failed > 1 ? 's' : ''}` : '';
  return `${head} · ${view.done}/${view.total} concluídos${fail}`;
}

export function usageLine(u) {
  if (!u) return '';
  const parts = [];
  if (u.turns) parts.push(`${u.turns} turno${u.turns > 1 ? 's' : ''}`);
  const k = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));
  if (u.input) parts.push(`↑${k(u.input)}`);
  if (u.output) parts.push(`↓${k(u.output)}`);
  if (u.cost) parts.push(`$${Number(u.cost).toFixed(4)}`);
  return parts.join(' ');
}
