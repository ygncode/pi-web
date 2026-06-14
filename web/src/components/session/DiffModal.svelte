<script>
  // Working-tree diff review modal. Lazy-loads @pierre/diffs (a large,
  // shadow-DOM diff renderer) only when opened, fetches the session's
  // uncommitted diff + any saved review comments, and renders a split/unified
  // CodeView. Reviewers drag-select line ranges to attach GitHub-style comments
  // (persisted server-side); "Submit review" composes them into a chat prompt.
  //
  // The CodeView and its annotation boxes live in shadow DOM, so annotation
  // elements are built imperatively with inline styles (CSS custom properties
  // pierce the shadow boundary, so app theme vars still apply).
  import { tick } from 'svelte';
  import FullScreenSheet from './FullScreenSheet.svelte';
  import { t } from '../../shared/i18n.js';
  import { showToast } from '../../shared/toast.js';
  import {
    getDiff,
    getReviewComments,
    saveReviewComment,
    deleteReviewComment,
  } from '../../session/chat/diff-api.js';
  import { buildReviewPrompt } from '../../session/chat/diff-review.js';

  let { open = $bindable(false), sessionId = '' } = $props();

  let loading = $state(false);
  let errorMsg = $state('');
  let emptyState = $state(''); // '', 'empty', 'notrepo'
  let layout = $state('split');
  let commentCount = $state(0);

  // Imperative, non-reactive handles (DOM-heavy; kept out of $state).
  let viewport = null; // container node, owned by CodeView (via the action)
  let diffsMod = null;
  let codeView = null;
  let fileDiffs = null; // Map<fileName, FileDiffMetadata>
  let comments = [];
  let draft = null; // { file, startLine, endLine, side } pending compose box
  let editingId = '';

  // The mount container is driven by an action rather than bind:this: the
  // action mounts when <FullScreenSheet> reveals its body (open) and is
  // destroyed when it tears down (close), which is exactly the diff lifecycle.
  // CodeView fully owns this node's subtree, so Svelte never reconciles it.
  function mountDiff(node) {
    viewport = node;
    init();
    return {
      destroy() {
        teardown();
      },
    };
  }

  async function init() {
    loading = true;
    errorMsg = '';
    emptyState = '';
    try {
      const [diffRes, reviewRes, mod] = await Promise.all([
        getDiff(sessionId),
        getReviewComments(sessionId),
        import('@pierre/diffs'),
      ]);
      diffsMod = mod;
      comments = reviewRes.comments || [];
      if (!diffRes.isRepo) {
        emptyState = 'notrepo';
        loading = false;
        return;
      }
      const files = mod.parsePatchFiles(diffRes.diff || '').flatMap((p) => p.files);
      if (files.length === 0) {
        emptyState = 'empty';
        loading = false;
        return;
      }
      fileDiffs = new Map(files.map((f) => [f.name, f]));
      loading = false;
      // Let the container un-hide before CodeView measures its height.
      await tick();
      buildCodeView(files);
    } catch (err) {
      errorMsg = err?.message || String(err);
      loading = false;
    }
  }

  function teardown() {
    try {
      codeView?.cleanUp();
    } catch {
      /* ignore */
    }
    viewport = null;
    codeView = null;
    fileDiffs = null;
    comments = [];
    draft = null;
    editingId = '';
    loading = false;
    errorMsg = '';
    emptyState = '';
    commentCount = 0;
  }

  function buildCodeView(files) {
    const { CodeView } = diffsMod;
    const theme = document.documentElement.dataset.theme;
    const themeType = theme === 'light' ? 'light' : 'dark';
    codeView = new CodeView({
      diffStyle: layout,
      themeType,
      theme: { dark: 'github-dark', light: 'github-light' },
      enableLineSelection: true,
      stickyHeaders: true,
      renderAnnotation: (annotation) => renderAnnotation(annotation),
      onSelectedLinesChange: (selection) => onSelectionChange(selection),
    });
    codeView.setup(viewport);
    codeView.setItems(files.map((f) => makeItem(f)));
    codeView.render();
    updateCommentCount();
  }

  function makeItem(file) {
    return { id: file.name, type: 'diff', fileDiff: file, annotations: annotationsFor(file.name) };
  }

  function annotationsFor(fileName) {
    const saved = comments
      .filter((c) => c.file === fileName)
      .map((c) => ({
        side: c.side === 'old' ? 'deletions' : 'additions',
        lineNumber: c.endLine,
        metadata: c,
      }));
    if (draft && draft.file === fileName) {
      saved.push({ side: draft.side, lineNumber: draft.endLine, metadata: { __draft: true } });
    }
    return saved;
  }

  function refreshItem(fileName) {
    const file = fileDiffs?.get(fileName);
    if (file && codeView) codeView.updateItem(makeItem(file));
  }

  function updateCommentCount() {
    commentCount = comments.length;
  }

  function onSelectionChange(selection) {
    if (!selection || !selection.range) return;
    const { range, id } = selection;
    const side = range.endSide || range.side || 'additions';
    const a = range.start;
    const b = range.end ?? range.start;
    draft = { file: id, startLine: Math.min(a, b), endLine: Math.max(a, b), side };
    editingId = '';
    codeView?.clearSelectedLines?.();
    refreshItem(id);
  }

  function setLayout(next) {
    if (next === layout) return;
    layout = next;
    if (codeView) {
      codeView.setOptions({ diffStyle: next });
      codeView.render();
    }
  }

  async function persistComment(payload, fileName) {
    try {
      const res = await saveReviewComment(sessionId, payload);
      const saved = res.comment;
      const idx = comments.findIndex((c) => c.id === saved.id);
      if (idx >= 0) comments[idx] = saved;
      else comments.push(saved);
      refreshItem(fileName);
      updateCommentCount();
    } catch {
      showToast(t('diff.saveFailed'), { id: 'diff-toast' });
    }
  }

  async function removeComment(comment) {
    try {
      await deleteReviewComment(sessionId, comment.id);
      comments = comments.filter((c) => c.id !== comment.id);
      refreshItem(comment.file);
      updateCommentCount();
    } catch {
      showToast(t('diff.saveFailed'), { id: 'diff-toast' });
    }
  }

  function submitReview() {
    const prompt = buildReviewPrompt(comments);
    if (!prompt) {
      showToast(t('diff.noComments'), { id: 'diff-toast' });
      return;
    }
    const textarea = document.getElementById('pi-chat-message');
    if (textarea) {
      textarea.value = prompt;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    }
    open = false;
    showToast(t('diff.reviewSubmitted'), { id: 'diff-toast' });
  }

  // ── Imperative annotation DOM (rendered inside shadow DOM) ──

  const BOX_STYLE =
    'display:flex;flex-direction:column;gap:6px;margin:4px 8px;padding:8px 10px;' +
    'border:1px solid var(--border,#444);border-radius:6px;background:var(--surface-2,#191920);' +
    'color:var(--text,#e6e7eb);font-size:13px;line-height:1.4;';
  const META_STYLE = 'color:var(--muted,#858a96);font-size:11px;';
  const ROW_STYLE = 'display:flex;gap:6px;justify-content:flex-end;';

  function styledButton(label, onClick, primary) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText =
      'cursor:pointer;border-radius:5px;padding:3px 10px;font-size:12px;border:1px solid var(--border,#444);' +
      (primary
        ? 'background:var(--accent,#9cc7c0);color:#111;border-color:var(--accent,#9cc7c0);'
        : 'background:transparent;color:var(--text,#e6e7eb);');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  function rangeLabel(startLine, endLine) {
    return startLine === endLine ? `Line ${startLine}` : `Lines ${startLine}-${endLine}`;
  }

  function composeBox({ startLine, endLine, initialText, onSave, onCancel }) {
    const box = document.createElement('div');
    box.style.cssText = BOX_STYLE;
    box.addEventListener('click', (e) => e.stopPropagation());

    const meta = document.createElement('div');
    meta.style.cssText = META_STYLE;
    meta.textContent = rangeLabel(startLine, endLine);

    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.value = initialText || '';
    textarea.placeholder = t('diff.commentPlaceholder');
    textarea.style.cssText =
      'width:100%;box-sizing:border-box;resize:vertical;border-radius:5px;padding:6px 8px;font:inherit;' +
      'background:var(--input-bg,#0e0e12);color:var(--text,#e6e7eb);border:1px solid var(--border,#444);';

    const row = document.createElement('div');
    row.style.cssText = ROW_STYLE;
    row.append(
      styledButton(t('diff.cancel'), onCancel, false),
      styledButton(
        t('diff.save'),
        () => {
          const text = textarea.value.trim();
          if (text) onSave(text);
        },
        true,
      ),
    );

    box.append(meta, textarea, row);
    queueMicrotask(() => textarea.focus());
    return box;
  }

  function renderAnnotation(annotation) {
    const meta = annotation.metadata || {};

    if (meta.__draft && draft) {
      return composeBox({
        startLine: draft.startLine,
        endLine: draft.endLine,
        onSave: (text) => {
          const payload = {
            file: draft.file,
            startLine: draft.startLine,
            endLine: draft.endLine,
            side: draft.side === 'deletions' ? 'old' : 'new',
            body: text,
          };
          const fileName = draft.file;
          draft = null;
          persistComment(payload, fileName);
        },
        onCancel: () => {
          const fileName = draft?.file;
          draft = null;
          if (fileName) refreshItem(fileName);
        },
      });
    }

    const comment = meta;
    if (editingId === comment.id) {
      return composeBox({
        startLine: comment.startLine,
        endLine: comment.endLine,
        initialText: comment.body,
        onSave: (text) => {
          editingId = '';
          persistComment({ ...comment, body: text }, comment.file);
        },
        onCancel: () => {
          editingId = '';
          refreshItem(comment.file);
        },
      });
    }

    const box = document.createElement('div');
    box.style.cssText = BOX_STYLE;
    box.addEventListener('click', (e) => e.stopPropagation());

    const metaEl = document.createElement('div');
    metaEl.style.cssText = META_STYLE;
    metaEl.textContent =
      rangeLabel(comment.startLine, comment.endLine) + (comment.side === 'old' ? ' · old' : '');

    const body = document.createElement('div');
    body.style.cssText = 'white-space:pre-wrap;word-break:break-word;';
    body.textContent = comment.body;

    const row = document.createElement('div');
    row.style.cssText = ROW_STYLE;
    row.append(
      styledButton(t('diff.delete'), () => removeComment(comment), false),
      styledButton(
        t('diff.edit'),
        () => {
          editingId = comment.id;
          refreshItem(comment.file);
        },
        false,
      ),
    );

    box.append(metaEl, body, row);
    return box;
  }
</script>

<FullScreenSheet
  bind:open
  title={t('diff.title')}
  backdropClass="diff-sheet-backdrop"
  panelClass="diff-sheet-panel"
  bodyClass="diff-sheet-body"
>
  <div class="diff-toolbar">
    <div class="diff-toggle" role="group" aria-label={t('diff.title')}>
      <button
        type="button"
        class="diff-toggle-btn"
        class:active={layout === 'split'}
        onclick={() => setLayout('split')}>{t('diff.split')}</button
      >
      <button
        type="button"
        class="diff-toggle-btn"
        class:active={layout === 'unified'}
        onclick={() => setLayout('unified')}>{t('diff.unified')}</button
      >
    </div>
    <button type="button" class="diff-submit" disabled={commentCount === 0} onclick={submitReview}>
      {t('diff.submitReview')}{commentCount > 0 ? ` (${commentCount})` : ''}
    </button>
  </div>

  {#if loading}
    <div class="diff-status">{t('diff.loading')}</div>
  {:else if errorMsg}
    <div class="diff-status diff-status-error">{errorMsg}</div>
  {:else if emptyState === 'notrepo'}
    <div class="diff-status">{t('diff.notRepo')}</div>
  {:else if emptyState === 'empty'}
    <div class="diff-status">{t('diff.empty')}</div>
  {/if}

  <div class="diff-codeview" use:mountDiff hidden={loading || !!errorMsg || !!emptyState}></div>
</FullScreenSheet>

<style>
  .diff-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 4px 12px;
  }
  .diff-toggle {
    display: inline-flex;
    border: 1px solid var(--border, #444);
    border-radius: 6px;
    overflow: hidden;
  }
  .diff-toggle-btn {
    cursor: pointer;
    border: 0;
    background: transparent;
    color: var(--text-soft, #b7bbc4);
    padding: 4px 12px;
    font-size: 13px;
  }
  .diff-toggle-btn.active {
    background: var(--accent, #9cc7c0);
    color: #111;
  }
  .diff-submit {
    cursor: pointer;
    border-radius: 6px;
    border: 1px solid var(--accent, #9cc7c0);
    background: var(--accent, #9cc7c0);
    color: #111;
    padding: 5px 14px;
    font-size: 13px;
  }
  .diff-submit:disabled {
    cursor: default;
    opacity: 0.5;
    background: transparent;
    color: var(--muted, #858a96);
    border-color: var(--border, #444);
  }
  .diff-status {
    padding: 32px 8px;
    text-align: center;
    color: var(--muted, #858a96);
  }
  .diff-status-error {
    color: var(--error, #cc6666);
  }
  .diff-codeview {
    height: 70vh;
    overflow: hidden;
  }
</style>
