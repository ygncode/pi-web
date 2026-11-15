// zcode/Codex-style collapsible rows for thinking blocks and tool calls.
// User choices live in a module-level reactive map keyed by a stable id
// (tool call id / entry id + block index), so they survive SSE re-renders and
// component remounts for the lifetime of the page.
import { SvelteMap } from 'svelte/reactivity';
import {
  Terminal,
  Brain,
  Pencil,
  FilePlus,
  FileText,
  Search,
  FolderSearch,
  FolderTree,
  Globe,
  Bot,
  ListTodo,
  Wrench,
} from '../../shared/icons.js';

const openState = new SvelteMap();

export function isOpen(key, fallback = false) {
  return openState.has(key) ? openState.get(key) : fallback;
}

export function setOpen(key, value) {
  openState.set(key, !!value);
}

export function toggleOpen(key, fallback = false) {
  setOpen(key, !isOpen(key, fallback));
}

// Map a tool name to a colour family used by the theme (data-tool attribute).
export function toolKind(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'bash' || n === 'shell' || n === 'exec' || n.endsWith('_bash')) return 'bash';
  if (n === 'read' || n === 'read_file' || n === 'view') return 'read';
  if (n === 'edit' || n === 'multiedit' || n === 'multi_edit' || n === 'apply_patch' || n === 'str_replace') return 'edit';
  if (n === 'write' || n === 'write_file' || n === 'create') return 'write';
  if (n === 'grep' || n === 'rg' || n === 'search') return 'grep';
  if (n === 'glob' || n === 'find' || n === 'fd') return 'glob';
  if (n === 'ls' || n === 'list' || n === 'list_dir') return 'ls';
  if (n.includes('web') || n.includes('fetch') || n.includes('browse') || n.includes('url')) return 'web';
  if (n === 'task' || n.includes('agent') || n.includes('delegate') || n.includes('subagent')) return 'task';
  if (n.includes('todo') || n.includes('plan')) return 'todo';
  return 'other';
}

const LABELS = { subagent: 'Subagentes', bash: 'Terminal', read: 'Read', edit: 'Edit', write: 'Write', grep: 'Grep', glob: 'Glob', ls: 'List', web: 'Web', task: 'Task', todo: 'Todo' };

const ICONS = { thinking: Brain, bash: Terminal, read: FileText, edit: Pencil, write: FilePlus, grep: Search, glob: FolderSearch, ls: FolderTree, web: Globe, task: Bot, todo: ListTodo, other: Wrench };

// Lucide icon node for a tool kind (or 'thinking').
export function kindIcon(kind) {
  return ICONS[kind] || Wrench;
}

export function toolLabel(name) {
  if (String(name || '').toLowerCase() === 'subagent') return LABELS.subagent;
  const kind = toolKind(name);
  if (kind === 'glob' && String(name).toLowerCase() === 'find') return 'Find';
  return LABELS[kind] || String(name || 'tool');
}

function firstLine(s, max = 140) {
  const line = String(s || '').split('\n').find((l) => l.trim()) || '';
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
}

// Short, single-line argument summary shown in the collapsed row.
export function toolSummary(name, args = {}) {
  const a = args || {};
  const kind = toolKind(name);
  const pick = (...keys) => {
    for (const k of keys) if (typeof a[k] === 'string' && a[k].trim()) return a[k];
    return '';
  };
  if (kind === 'bash') return firstLine(pick('command', 'cmd'));
  if (kind === 'read' || kind === 'edit' || kind === 'write' || kind === 'ls')
    return firstLine(pick('file_path', 'path') || (kind === 'ls' ? '.' : ''));
  if (kind === 'grep' || kind === 'glob') {
    const p = pick('pattern', 'query', 'glob');
    const where = pick('path');
    return firstLine(where ? `${p}  in ${where}` : p);
  }
  if (kind === 'web') return firstLine(pick('url', 'query', 'q'));
  if (kind === 'task') return firstLine(pick('description', 'prompt', 'task'));
  for (const v of Object.values(a)) if (typeof v === 'string' && v.trim()) return firstLine(v);
  return '';
}

export function thinkingPreview(text, max = 110) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function baseName(p) {
  const s = String(p || '');
  const parts = s.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : s;
}

// +added / -removed line counts for edit/write rows (null when unknown).
export function diffStats(kind, args = {}, result = null) {
  const a = args || {};
  if (kind === 'write') {
    const c = typeof a.content === 'string' ? a.content : '';
    if (!c) return null;
    const n = c.replace(/\n$/, '').split('\n').length;
    return { added: n, removed: 0 };
  }
  if (kind === 'edit') {
    const diff = result?.details?.diff;
    if (typeof diff === 'string' && diff) {
      let added = 0;
      let removed = 0;
      for (const line of diff.split('\n')) {
        if (/^\+(?!\+\+)/.test(line)) added++;
        else if (/^-(?!--)/.test(line)) removed++;
      }
      return { added, removed };
    }
    const lines = (v) => (typeof v === 'string' && v ? v.split('\n').length : 0);
    const edits = Array.isArray(a.edits) ? a.edits : [a];
    let added = 0;
    let removed = 0;
    for (const e of edits) {
      added += lines(e?.newText ?? e?.new_string ?? e?.new_str);
      removed += lines(e?.oldText ?? e?.old_string ?? e?.old_str);
    }
    return added || removed ? { added, removed } : null;
  }
  return null;
}

// "done/total" for todo-ish tools, from structured args or "[x]" checklists.
export function todoProgress(args = {}, resultText = '') {
  const a = args || {};
  const list = Array.isArray(a.todos) ? a.todos : Array.isArray(a.items) ? a.items : null;
  if (list && list.length) {
    const done = list.filter((t) =>
      t && typeof t === 'object'
        ? t.done === true || t.completed === true || /^(done|completed|complete)$/i.test(String(t.status || ''))
        : false,
    ).length;
    return { done, total: list.length };
  }
  const text = [typeof a.todos === 'string' ? a.todos : '', String(resultText || '')].join('\n');
  const checked = (text.match(/\[[xX✓]\]/g) || []).length;
  const open = (text.match(/\[ \]/g) || []).length;
  if (checked + open > 0) return { done: checked, total: checked + open };
  const m = /(\d+)\s*\/\s*(\d+)/.exec(String(resultText || ''));
  if (m && +m[2] > 0 && +m[1] <= +m[2]) return { done: +m[1], total: +m[2] };
  return null;
}

// 703000 -> "11m 43s"; 5000 -> "5s"; 3723000 -> "1h 2m".
export function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function tsOf(entry) {
  const t = Date.parse(entry?.timestamp || '');
  return Number.isFinite(t) ? t : null;
}

// For the assistant entry that ends a turn (stopReason stop/end), the time from
// the user prompt that started the turn. Returns null for other entries.
export function turnDuration(entry, entries) {
  const m = entry?.message;
  if (!m || m.role !== 'assistant') return null;
  if (m.stopReason && !/^(stop|end_turn|endTurn|length)$/.test(m.stopReason)) return null;
  if (!Array.isArray(entries)) return null;
  let idx = entries.indexOf(entry);
  if (idx < 0 && entry.id) idx = entries.findIndex((e) => e?.id === entry.id);
  if (idx < 0) return null;
  let tools = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const e = entries[i];
    if (e?.type !== 'message') continue;
    if (e.message?.role === 'toolResult') tools++;
    if (e.message?.role === 'user') {
      const a = tsOf(e);
      const b = tsOf(entry);
      if (a == null || b == null || b <= a) return null;
      return { ms: b - a, tools };
    }
  }
  return null;
}
