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
  import { tick, onMount } from 'svelte';
  import FullScreenSheet from './FullScreenSheet.svelte';
  import { t } from '../../shared/i18n.js';
  import { showToast } from '../../shared/toast.js';
  import { ChevronDown, ChevronRight, iconNode } from '../../shared/icons.js';
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
  // Per-file collapse state. The Set holds collapsed file names; the count
  // mirrors its size as $state so the "Collapse all" toggle label is reactive
  // (a raw Set's mutations don't notify Svelte). fileCount is the total once
  // the diff has loaded — drives the "all collapsed?" check. Set is a plain,
  // non-reactive collection here: we don't iterate it in any template, only
  // call has()/add()/delete() imperatively from render callbacks.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- imperative storage; collapsedCount carries the reactivity
  let collapsedFiles = new Set();
  let collapsedCount = $state(0);
  let fileCount = $state(0);
  const allCollapsed = $derived(fileCount > 0 && collapsedCount >= fileCount);

  // Matches FullScreenSheet's SHEET_BREAKPOINT. Drives where the toolbar
  // renders (header on desktop, second row in body on mobile) and feeds the
  // mobile-only CSS pumped into the shadow DOM via unsafeCSS.
  const MOBILE_QUERY = '(max-width: 900px)';
  let isMobile = $state(false);

  // Imperative, non-reactive handles (DOM-heavy; kept out of $state).
  let viewport = null; // container node, owned by CodeView (via the action)
  let diffsMod = null;
  let codeView = null;
  // The full CodeView options. setOptions REPLACES (not merges), so every
  // setOptions call must pass the complete object — otherwise diffStyle/theme
  // changes would wipe enableLineSelection, the gutter "+", and renderAnnotation.
  let codeViewOptions = null;
  let fileDiffs = null; // Map<fileName, FileDiffMetadata>
  let comments = [];
  let draft = null; // { file, startLine, endLine, side } pending compose box
  let editingId = '';
  let themeObserver = null;
  // CodeView.updateItem only re-renders when the item's `version` changes, so
  // every (re)built item gets a fresh monotonic version.
  let itemVersion = 0;

  onMount(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const sync = () => (isMobile = mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  });

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

  // Resolve `promise` but reject with a stage-labelled timeout if it stalls, so
  // a hang surfaces (in the UI and the console) as a specific step rather than
  // an opaque "Loading diff…". The stage names are logged for support.
  function withStage(stage, promise, ms) {
    const started = performance.now();
    console.info(`[diff] ${stage}: start`);
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`__diff_timeout__:${stage}`);
        reject(err);
      }, ms);
    });
    return Promise.race([promise, timeout]).then(
      (value) => {
        clearTimeout(timer);
        console.info(`[diff] ${stage}: done in ${Math.round(performance.now() - started)}ms`);
        return value;
      },
      (err) => {
        clearTimeout(timer);
        console.error(
          `[diff] ${stage}: failed after ${Math.round(performance.now() - started)}ms`,
          err,
        );
        throw err;
      },
    );
  }

  async function init() {
    loading = true;
    errorMsg = '';
    emptyState = '';
    try {
      // Load the (large, lazy) renderer and the diff in parallel; surface
      // whichever stalls. Saved comments are best-effort — a failure there must
      // not block the diff.
      const [mod, diffRes] = await Promise.all([
        withStage('renderer', import('@pierre/diffs'), 30000),
        withStage('diff', getDiff(sessionId), 25000),
      ]);
      diffsMod = mod;
      comments = await withStage('reviews', getReviewComments(sessionId), 15000)
        .then((r) => r.comments || [])
        .catch(() => []);
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
      fileCount = files.length;
      loading = false;
      // Let the container un-hide before CodeView measures its height.
      await tick();
      buildCodeView(files);
    } catch (err) {
      const msg = String(err?.message || err);
      errorMsg = msg.startsWith('__diff_timeout__')
        ? `${t('diff.timeout')} (${msg.split(':')[1] || ''})`
        : msg;
      loading = false;
    }
  }

  function teardown() {
    hideMobileComposeSheet();
    themeObserver?.disconnect();
    themeObserver = null;
    try {
      codeView?.cleanUp();
    } catch {
      /* ignore */
    }
    viewport = null;
    codeView = null;
    codeViewOptions = null;
    fileDiffs = null;
    comments = [];
    draft = null;
    editingId = '';
    loading = false;
    errorMsg = '';
    emptyState = '';
    commentCount = 0;
    collapsedFiles = new Set();
    collapsedCount = 0;
    fileCount = 0;
  }

  function currentThemeType() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }

  function buildCodeView(files) {
    const { CodeView } = diffsMod;
    codeViewOptions = {
      diffStyle: layout,
      themeType: currentThemeType(),
      // pierre-dark / pierre-light are the library's bundled default themes;
      // other names (e.g. github-*) aren't shipped and fall back to white.
      theme: { dark: 'pierre-dark', light: 'pierre-light' },
      enableLineSelection: true,
      enableGutterUtility: true,
      lineHoverHighlight: 'both',
      stickyHeaders: true,
      renderAnnotation: (annotation) => renderAnnotation(annotation),
      renderHeaderPrefix: (fileDiff) => buildCollapseToggle(fileDiff),
      onGutterUtilityClick: (range, context) => onGutterUtilityClick(range, context),
    };
    codeView = new CodeView(codeViewOptions);
    codeView.setup(viewport);
    codeView.setItems(files.map((f) => makeItem(f)));
    codeView.render();
    updateCommentCount();

    // Live-follow the app theme: re-theme the diff when the user switches it.
    themeObserver = new MutationObserver(() => applyOptions({ themeType: currentThemeType() }));
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  // setOptions replaces the whole options object, so always merge into the
  // retained codeViewOptions and pass the complete object.
  function applyOptions(patch) {
    if (!codeView || !codeViewOptions) return;
    codeViewOptions = { ...codeViewOptions, ...patch };
    codeView.setOptions(codeViewOptions);
    codeView.render();
  }

  function makeItem(file) {
    return {
      id: file.name,
      type: 'diff',
      fileDiff: file,
      annotations: annotationsFor(file.name),
      collapsed: collapsedFiles.has(file.name),
      version: ++itemVersion,
    };
  }

  // Chevron rendered as the file-header prefix. Lives inside the diffs shadow
  // DOM but we attach a real click listener directly on the button; the
  // library calls renderHeaderPrefix again on each updateItem, so the chevron
  // icon stays in sync after toggleFileCollapsed.
  function buildCollapseToggle(fileDiff) {
    const collapsed = collapsedFiles.has(fileDiff.name);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', collapsed ? t('diff.expandFile') : t('diff.collapseFile'));
    btn.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;' +
      'background:transparent;border:0;cursor:pointer;color:var(--muted,#858a96);padding:0;' +
      'margin-right:2px;border-radius:3px;flex-shrink:0;';
    btn.appendChild(iconNode(collapsed ? ChevronRight : ChevronDown, { size: 14 }));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFileCollapsed(fileDiff.name);
    });
    return btn;
  }

  function setFileCollapsed(fileName, collapsed) {
    if (collapsed) collapsedFiles.add(fileName);
    else collapsedFiles.delete(fileName);
    collapsedCount = collapsedFiles.size;
  }

  function toggleFileCollapsed(fileName) {
    setFileCollapsed(fileName, !collapsedFiles.has(fileName));
    refreshItem(fileName);
  }

  function toggleAllCollapsed() {
    if (!fileDiffs) return;
    const names = [...fileDiffs.keys()];
    const collapse = !names.every((n) => collapsedFiles.has(n));
    for (const name of names) setFileCollapsed(name, collapse);
    for (const name of names) refreshItem(name);
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
    if (!file || !codeView) return;
    const becameEmpty = annotationsFor(fileName).length === 0;
    codeView.updateItem(makeItem(file));
    // CodeView's reconcileHeights stops re-measuring a file once it has zero
    // annotations, so removing the last comment/draft strands the height the
    // annotation reserved (a tall gap). Bumping unsafeCSS — the only option with
    // no visual effect that still resets the per-item layout cache — forces a
    // clean re-measure that reclaims it. Highlighting is cached, so no reflash.
    if (becameEmpty) forceRelayout();
  }

  let relayoutNonce = 0;
  function forceRelayout() {
    if (!codeView || !codeViewOptions) return;
    codeViewOptions = { ...codeViewOptions, unsafeCSS: `/* relayout ${++relayoutNonce} */` };
    codeView.setOptions(codeViewOptions);
    codeView.render();
  }

  function updateCommentCount() {
    commentCount = comments.length;
  }

  // The gutter "+" button (shown on line hover / after a drag-selection) opens
  // a comment composer for the hovered line or the selected range. In a
  // CodeView the callback also receives the file item as context.
  function onGutterUtilityClick(range, context) {
    const id = context?.item?.id;
    if (!range || !id) return;
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
    applyOptions({ diffStyle: next });
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

  // Mobile-only body-level composer overlay (see composeBox for why it can't
  // live inside the diffs shadow root). We keep a single instance and rebind
  // its callbacks on re-render; preserving the typed text via the existing
  // <textarea> avoids losing user input when the diff re-renders.
  let mobileSheetEl = null;
  let mobileSheetCancel = null;
  let mobileSheetSave = null;

  function showMobileComposeSheet({ startLine, endLine, initialText, onSave, onCancel }) {
    mobileSheetCancel = onCancel;
    mobileSheetSave = onSave;
    if (mobileSheetEl) {
      mobileSheetEl.querySelector('[data-pi-meta]').textContent = rangeLabel(startLine, endLine);
      return;
    }
    const sheet = document.createElement('div');
    sheet.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));' +
      'z-index:1000;padding:12px;border-radius:8px;display:flex;flex-direction:column;gap:8px;' +
      'border:1px solid var(--border,#444);background:var(--surface-2,#191920);' +
      'color:var(--text,#e6e7eb);font-size:14px;line-height:1.4;' +
      'box-shadow:0 10px 30px rgba(0,0,0,0.5);';

    const metaEl = document.createElement('div');
    metaEl.dataset.piMeta = '';
    metaEl.style.cssText = 'color:var(--muted,#858a96);font-size:12px;';
    metaEl.textContent = rangeLabel(startLine, endLine);

    const textarea = document.createElement('textarea');
    textarea.rows = 4;
    textarea.value = initialText || '';
    textarea.placeholder = t('diff.commentPlaceholder');
    textarea.style.cssText =
      'width:100%;box-sizing:border-box;resize:vertical;border-radius:6px;padding:8px 10px;' +
      'font:inherit;font-size:15px;background:var(--input-bg,#0e0e12);' +
      'color:var(--text,#e6e7eb);border:1px solid var(--border,#444);';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    row.append(
      styledButton(t('diff.cancel'), () => mobileSheetCancel?.(), false),
      styledButton(
        t('diff.save'),
        () => {
          const text = textarea.value.trim();
          if (text) mobileSheetSave?.(text);
        },
        true,
      ),
    );

    sheet.append(metaEl, textarea, row);
    document.body.appendChild(sheet);
    mobileSheetEl = sheet;
    queueMicrotask(() => textarea.focus());
  }

  function hideMobileComposeSheet() {
    if (!mobileSheetEl) return;
    mobileSheetEl.remove();
    mobileSheetEl = null;
    mobileSheetCancel = null;
    mobileSheetSave = null;
  }

  function composeBox(args) {
    if (isMobile) {
      // On mobile we render the composer in light DOM (document.body) instead
      // of inside the @pierre/diffs shadow root: the library's `code { contain:
      // content }` creates a fixed-positioning containing block, so a sticky/
      // fixed annotation child gets anchored to the column rather than the
      // viewport. Return a zero-height placeholder so the library still
      // reserves a slot.
      showMobileComposeSheet(args);
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'height:0;margin:0;padding:0;';
      return placeholder;
    }
    const { startLine, endLine, initialText, onSave, onCancel } = args;

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
          hideMobileComposeSheet();
          persistComment(payload, fileName);
        },
        onCancel: () => {
          const fileName = draft?.file;
          draft = null;
          hideMobileComposeSheet();
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
          hideMobileComposeSheet();
          persistComment({ ...comment, body: text }, comment.file);
        },
        onCancel: () => {
          editingId = '';
          hideMobileComposeSheet();
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
  headerExtra={isMobile ? null : toolbar}
>
  {#snippet toolbar()}
    <!-- Lives in the sheet header on desktop and as a second row in the body
         on mobile (a phone-width header can't hold "← Diff" plus Split/Unified
         + Collapse all + Submit review without crushing the back button). e2e
         selectors still target .diff-toolbar / .diff-submit. -->
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
      <button
        type="button"
        class="diff-toolbar-btn"
        disabled={fileCount === 0}
        onclick={toggleAllCollapsed}
      >
        {allCollapsed ? t('diff.expandAll') : t('diff.collapseAll')}
      </button>
      <button
        type="button"
        class="diff-submit"
        disabled={commentCount === 0}
        onclick={submitReview}
      >
        {t('diff.submitReview')}{commentCount > 0 ? ` (${commentCount})` : ''}
      </button>
    </div>
  {/snippet}

  {#if isMobile}
    {@render toolbar()}
  {/if}

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

<!-- Styles live in internal/ui/embedded/styles/session.css (the app loads global
     stylesheets, not Svelte-scoped <style> blocks — see ModelUsageModal). -->
