/**
 * artifact-registry.js — pure detection of "artifacts" from session entries.
 *
 * An artifact is substantial, self-contained content worth surfacing in a
 * dedicated panel. File artifacts are keyed by path and reflect the file's
 * latest known state, reconstructed from the *structured* tool calls:
 *   - `write`  → sets full content (replaces any prior state at that path)
 *   - `edit`   → applies its {oldText→newText} edits to the current content
 *   - `bash`   → only simple, recognized `mv` / `git mv` / `rm` (success-checked)
 *               rename or remove the artifact; anything fancier is left alone
 *
 * This means write/edit are always accurate, and the common rename/delete cases
 * are handled — but file changes made through arbitrary shell (sed, redirects,
 * scripts) can't be tracked from the transcript and may go stale. That tradeoff
 * is surfaced to users via the Artifacts help (?) panel.
 *
 * Sizeable fenced code blocks in assistant text are also surfaced as snippets.
 * This module is DOM-free and side-effect-free for isolated unit testing.
 *
 * Previewable artifacts carry a `previewType` describing how the panel should
 * render them: 'html'/'svg' run in a sandboxed iframe, 'markdown' renders via
 * the app's markdown parser. Non-previewable artifacts have previewType ''.
 */

const EXT_TO_LANG = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
  php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash',
  sql: 'sql', html: 'html', htm: 'html', css: 'css', scss: 'scss',
  json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml',
  md: 'markdown', svg: 'svg', dockerfile: 'dockerfile'
};

function extOf(filePath) {
  const base = filePath.split(/[\\/]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function basename(filePath) {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function langFromPath(filePath) {
  return EXT_TO_LANG[extOf(filePath)] || '';
}

/** How a previewable artifact should render, or '' for non-previewable. */
function previewTypeFor(lang) {
  switch (lang) {
    case 'html':
    case 'xml':
      return 'html';
    case 'svg':
      return 'svg';
    case 'markdown':
    case 'md':
      return 'markdown';
    default:
      return '';
  }
}

/** Coerce a tool-call path argument to a non-empty string, else null. */
function strPath(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function makeFileArtifact(id, path, content, entry) {
  const lang = langFromPath(path);
  const previewType = previewTypeFor(lang);
  return {
    id,
    kind: previewType ? 'preview' : 'code',
    previewType,
    title: basename(path),
    lang,
    content,
    filePath: path,
    entryId: entry.id,
    anchorId: `entry-${entry.id}`,
    source: 'write'
  };
}

/** Apply pi `edit` edits ([{oldText,newText}]) to content (first-match each). */
function applyEdits(content, edits) {
  if (!Array.isArray(edits)) return content;
  let out = content;
  for (const e of edits) {
    if (!e) continue;
    const oldText = typeof e.oldText === 'string' ? e.oldText : e.old_string;
    const newText = typeof e.newText === 'string' ? e.newText
      : (typeof e.new_string === 'string' ? e.new_string : '');
    if (typeof oldText !== 'string' || oldText === '') continue;
    const i = out.indexOf(oldText);
    if (i === -1) continue; // mismatch (e.g. file changed via untracked means) — skip
    out = out.slice(0, i) + (newText || '') + out.slice(i + oldText.length);
  }
  return out;
}

// Shell features we refuse to interpret: their presence means the command may do
// more than a plain mv/rm, so we leave artifacts untouched rather than guess.
const UNSAFE_SHELL = /[|&;<>$`*?(){}\n]/;

/** Split a simple command into tokens honoring '…' and "…". null if unbalanced. */
function tokenizeShell(s) {
  const tokens = [];
  let cur = '';
  let quote = '';
  let started = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      if (ch === quote) quote = '';
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (ch === ' ' || ch === '\t') {
      if (started) { tokens.push(cur); cur = ''; started = false; }
    } else {
      cur += ch;
      started = true;
    }
  }
  if (quote) return null;
  if (started) tokens.push(cur);
  return tokens;
}

/**
 * Recognize ONLY plain `mv`/`git mv`/`rm` and return the file ops they imply.
 * Returns [] for anything with shell features, redirection, or ambiguous forms.
 */
export function parseFileOps(command) {
  if (typeof command !== 'string') return [];
  const trimmed = command.trim();
  if (!trimmed || UNSAFE_SHELL.test(trimmed)) return [];
  const tokens = tokenizeShell(trimmed);
  if (!tokens || tokens.length < 2) return [];

  let verb = tokens[0];
  let rest = tokens.slice(1);
  if (verb === 'git' && rest[0] === 'mv') { verb = 'mv'; rest = rest.slice(1); }
  if (verb !== 'mv' && verb !== 'rm') return [];

  const args = rest.filter((t) => !t.startsWith('-'));
  if (verb === 'rm') {
    return args.map((p) => ({ op: 'rm', path: p }));
  }
  if (args.length < 2) return [];
  const dst = args[args.length - 1];
  const srcs = args.slice(0, -1);
  if (dst.endsWith('/')) {
    return srcs.map((s) => ({ op: 'mv', from: s, to: dst + basename(s) }));
  }
  if (srcs.length === 1) return [{ op: 'mv', from: srcs[0], to: dst }];
  return []; // multiple sources without a directory dst — ambiguous, skip
}

function applyBashOps(command, byPath) {
  for (const op of parseFileOps(command)) {
    if (op.op === 'rm') {
      const art = byPath.get(op.path);
      if (art) { art._removed = true; byPath.delete(op.path); }
    } else if (op.op === 'mv' && op.from !== op.to) {
      const art = byPath.get(op.from);
      if (!art) continue;
      byPath.delete(op.from);
      art.filePath = op.to;
      art.title = basename(op.to);
      art.lang = langFromPath(op.to);
      art.previewType = previewTypeFor(art.lang);
      art.kind = art.previewType ? 'preview' : 'code';
      byPath.set(op.to, art);
    }
  }
}

function indexToolResults(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (entry && entry.type === 'message' && entry.message && entry.message.role === 'toolResult') {
      map.set(entry.message.toolCallId, entry.message);
    }
  }
  return map;
}

/** A tool call counts as "applied" only once its result lands without error. */
function toolSucceeded(callId, results) {
  const r = results.get(callId);
  return !!r && r.isError !== true;
}

function applyFileToolCall(call, entry, order, byPath, results) {
  const args = call.arguments || {};
  if (call.name === 'write') {
    const path = strPath(args.file_path ?? args.path);
    const content = typeof args.content === 'string' ? args.content : null;
    if (path === null || content === null) return;
    const existing = byPath.get(path);
    if (existing) {
      existing.content = content;
      existing.entryId = entry.id;
      existing.anchorId = `entry-${entry.id}`;
    } else {
      const art = makeFileArtifact(`art-${call.id ?? `${entry.id}-write`}`, path, content, entry);
      order.push(art);
      byPath.set(path, art);
    }
  } else if (call.name === 'edit') {
    const path = strPath(args.file_path ?? args.path);
    if (path === null) return;
    const art = byPath.get(path);
    if (!art) return; // no in-session baseline content — can't reconstruct, skip
    art.content = applyEdits(art.content, args.edits);
    art.entryId = entry.id;
    art.anchorId = `entry-${entry.id}`;
  } else if (call.name === 'bash') {
    if (toolSucceeded(call.id, results)) applyBashOps(args.command, byPath);
  }
}

/**
 * Yield fenced code blocks from markdown text. Recognizes ``` and ~~~ fences of
 * length >= 3; a closing fence is a line of the same char with no info string.
 */
function* fencedBlocks(text) {
  const lines = text.split('\n');
  let open = false;
  let fenceChar = '';
  let info = '';
  let buf = [];

  for (const line of lines) {
    const m = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (!open && m) {
      open = true;
      fenceChar = m[2][0];
      info = m[3].trim();
      buf = [];
    } else if (open && m && m[2][0] === fenceChar && m[3].trim() === '') {
      yield { lang: (info.split(/\s+/)[0] || '').toLowerCase(), content: buf.join('\n') };
      open = false;
      info = '';
    } else if (open) {
      buf.push(line);
    }
  }
}

function* artifactsFromText(text, entry, blockIndex, minCodeBlockLines) {
  let fenceIndex = 0;
  for (const { lang, content } of fencedBlocks(text)) {
    const idx = fenceIndex++;
    if (!content.trim()) continue;
    const previewType = previewTypeFor(lang);
    const previewable = previewType !== '';
    const lineCount = content.split('\n').length;
    if (!previewable && lineCount < minCodeBlockLines) continue;

    yield {
      id: `art-${entry.id}-${blockIndex}-${idx}`,
      kind: previewable ? 'preview' : 'code',
      previewType,
      title: lang ? `${lang} snippet` : 'snippet',
      lang,
      content,
      filePath: null,
      entryId: entry.id,
      anchorId: `entry-${entry.id}`,
      source: 'fenced'
    };
  }
}

/**
 * Walk session entries and collect artifact descriptors. File artifacts are
 * path-keyed and reflect their latest state (write/edit/rename/remove); fenced
 * snippets are emitted per occurrence. Order is first-appearance.
 *
 * @param {Array} entries  session entries (data-model order)
 * @param {object} [opts]
 * @param {number} [opts.minCodeBlockLines=6]  minimum lines for a non-previewable
 *        fenced block to qualify as a snippet artifact
 * @returns {Array<{id,kind,previewType,title,lang,content,filePath,entryId,anchorId,source}>}
 */
export function collectArtifacts(entries, { minCodeBlockLines = 6 } = {}) {
  if (!Array.isArray(entries)) return [];
  const order = [];          // file + snippet artifacts in first-seen order
  const byPath = new Map();   // current path -> file artifact
  const results = indexToolResults(entries);

  for (const entry of entries) {
    if (!entry || entry.type !== 'message') continue;
    const msg = entry.message;
    if (!msg) continue;

    // A bash command the user ran directly in the composer can also rename/remove.
    if (msg.role === 'bashExecution') {
      if (!msg.cancelled && msg.exitCode === 0) applyBashOps(msg.command, byPath);
      continue;
    }

    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;

    let blockIndex = 0;
    for (const block of msg.content) {
      const idx = blockIndex++;
      if (!block) continue;
      if (block.type === 'toolCall') {
        applyFileToolCall(block, entry, order, byPath, results);
      } else if (block.type === 'text' && typeof block.text === 'string') {
        for (const a of artifactsFromText(block.text, entry, idx, minCodeBlockLines)) {
          order.push(a);
        }
      }
    }
  }

  return order.filter((a) => !a._removed);
}

export const __test__ = {
  fencedBlocks, langFromPath, previewTypeFor, basename, extOf,
  parseFileOps, applyEdits, tokenizeShell
};
