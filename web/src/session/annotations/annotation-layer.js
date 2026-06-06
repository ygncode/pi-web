/**
 * annotation-layer.js — selection → comment, highlight rendering, Notes tab,
 * and "send notes to pi". Persists via /api/annotations (annotation-api.js) and
 * stays in sync across tabs via the SSE `annotations` snapshot event.
 *
 * Annotations anchor to any registered scope: the transcript (#messages) and the
 * artifact panel host. Highlights are re-applied whenever a scope re-renders
 * (navigation, live reload, artifact selection) via a MutationObserver.
 */
import { t } from '../../shared/i18n.js';
import { getSelectionInfo, applyHighlights } from './annotation-range.js';

export function createAnnotationLayer({
  sessionId,
  api,
  messagesEl,
  scopes,
  listHost,
  composerEl = null,
  countEl = null,
  escapeHtml,
  onSelectArtifact = null,
  onCreate = null,
  onSend = null,
  onAddToChat = null,
  resolveArtifact = null,
  selectionDelayMs = 250,
  documentImpl = document,
  windowImpl = window,
  rangeApi = { getSelectionInfo, applyHighlights }
} = {}) {
  const allScopes = (Array.isArray(scopes) && scopes.length ? scopes : [messagesEl]).filter(Boolean);
  if (!api || allScopes.length === 0 || !listHost) {
    return { init() {}, setAnnotations() {}, reapply() {}, refresh() {}, destroy() {} };
  }

  let annotations = [];
  let pending = null; // selection info awaiting a note
  let observer = null;
  // Monotonic guard: a slow in-flight list() must not clobber newer state set by
  // a later refresh, an optimistic create, or an SSE snapshot.
  let loadSeq = 0;
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s);

  // ── highlight (re)application ─────────────────────────────────────────────
  function reapply() {
    observer?.disconnect();
    for (const scope of allScopes) {
      rangeApi.applyHighlights(scope, annotations, { documentImpl });
    }
    observer?.takeRecords?.();
    if (observer) {
      for (const scope of allScopes) observer.observe(scope, { childList: true, subtree: true });
    }
  }

  function render() {
    reapply();
    renderList();
    if (countEl) {
      countEl.textContent = String(annotations.length);
      countEl.hidden = annotations.length === 0;
    }
  }

  function setAnnotations(list) {
    loadSeq += 1; // supersede any in-flight refresh
    annotations = Array.isArray(list) ? list : [];
    render();
  }

  async function refresh() {
    const seq = loadSeq + 1;
    loadSeq = seq;
    try {
      const list = await api.list();
      if (seq !== loadSeq) return; // a newer update superseded this load
      annotations = Array.isArray(list) ? list : [];
      render();
    } catch { /* keep current */ }
  }

  // ── Notes list ────────────────────────────────────────────────────────────
  function renderList() {
    if (annotations.length === 0) {
      listHost.innerHTML = `<div class="annotation-empty">${esc(t('annotation.empty'))}</div>`;
      return;
    }
    let html = '<div class="annotation-list">';
    for (const a of annotations) {
      html += `<div class="annotation-item" data-annotation-id="${esc(a.id)}" data-anchor-id="${esc(a.anchorId)}">`
        + `<button type="button" class="annotation-delete" data-action="delete" title="${esc(t('annotation.deleteNote'))}">×</button>`
        + (a.original ? `<div class="annotation-quote">${esc(a.original)}</div>` : '')
        + (a.text ? `<div class="annotation-note">${esc(a.text)}</div>` : '')
        + `</div>`;
    }
    html += '</div>';
    const noteNoun = annotations.length === 1 ? t('annotation.noteOne') : t('annotation.noteMany');
    html += `<div class="annotation-footer"><button type="button" class="annotation-send" data-action="send-to-pi">${esc(t('annotation.sendNotesToPi', { count: annotations.length, noun: noteNoun }))}</button></div>`;
    listHost.innerHTML = html;
  }

  function offsetToLine(content, offset) {
    let line = 1;
    const limit = Math.min(Math.max(0, offset), content.length);
    for (let i = 0; i < limit; i += 1) {
      if (content[i] === '\n') line += 1;
    }
    return line;
  }

  // "Line N" for a single line, "Lines N-M" for a span. end is exclusive, so the
  // last selected character is at end-1.
  function lineLabel(content, start, end) {
    if (typeof content !== 'string' || content.length === 0) return '';
    const a = offsetToLine(content, start);
    const b = offsetToLine(content, Math.max(start, end - 1));
    return a === b ? `Line ${a}` : `Lines ${a}-${b}`;
  }

  // Quote the anchored text on a single line so a multi-line selection doesn't
  // break the structure of the message we hand to the agent.
  function quote(s) {
    return `"${String(s || '').replace(/\s+/g, ' ').trim()}"`;
  }

  function formatForPi() {
    const fileGroups = new Map(); // path -> [{ label, original, text }]
    const convo = [];
    for (const a of annotations) {
      const anchorId = a.anchorId || '';
      if (anchorId.indexOf('artifact-') === 0) {
        const art = resolveArtifact ? resolveArtifact(anchorId.slice('artifact-'.length)) : null;
        const path = (art && (art.filePath || art.title)) || '(artifact)';
        const label = art ? lineLabel(art.content, a.startOffset, a.endOffset) : '';
        if (!fileGroups.has(path)) fileGroups.set(path, []);
        fileGroups.get(path).push({ label, original: a.original, text: a.text });
      } else {
        convo.push(a);
      }
    }

    // Lead with an explicit, directive framing: this continues the current task,
    // so a weaker model doesn't treat the notes as a new/unrelated conversation.
    const out = [
      "Here are my review notes on this session — changes I want you to make to the work we've already done together in this conversation. Please go through each note below and apply it. This is a continuation of our current task, not a new or separate request.",
      ''
    ];
    for (const [path, items] of fileGroups) {
      out.push(`In ${path}:`);
      for (const it of items) {
        out.push('');
        out.push(it.label ? `${it.label} — ${quote(it.original)}` : quote(it.original));
        if (it.text) out.push(`  ${it.text}`);
      }
      out.push('');
    }
    if (convo.length > 0) {
      out.push('In this conversation:');
      for (const a of convo) {
        out.push('');
        out.push(quote(a.original));
        if (a.text) out.push(`  ${a.text}`);
      }
      out.push('');
    }
    return out.join('\n').trimEnd() + '\n';
  }

  function sendToPi() {
    if (!composerEl || annotations.length === 0) return;
    composerEl.value = formatForPi();
    composerEl.dispatchEvent(new windowImpl.Event('input', { bubbles: true }));
    // Let the host get out of the way (e.g. collapse the mobile overlay sidebar)
    // before focusing, so the composer is actually visible when the keyboard opens.
    if (typeof onSend === 'function') onSend();
    composerEl.focus();
  }

  listHost.addEventListener('click', async (e) => {
    const del = e.target.closest?.('[data-action="delete"]');
    if (del) {
      const item = del.closest('.annotation-item');
      const id = item?.dataset.annotationId;
      if (!id) return;
      setAnnotations(annotations.filter((a) => a.id !== id)); // optimistic
      try { await api.remove(id); } finally { refresh(); }
      return;
    }
    if (e.target.closest?.('[data-action="send-to-pi"]')) {
      sendToPi();
      return;
    }
    const item = e.target.closest?.('.annotation-item');
    if (item) {
      const anchorId = item.dataset.anchorId || '';
      // Artifact anchors only exist when that artifact is open in source view;
      // ask the panel to select it first so the highlight + scroll land.
      if (anchorId.indexOf('artifact-') === 0 && onSelectArtifact) {
        onSelectArtifact(anchorId.slice('artifact-'.length));
      }
      const anchor = documentImpl.getElementById(anchorId);
      if (anchor) {
        anchor.scrollIntoView({ block: 'center', behavior: 'smooth' });
        anchor.classList.add('annotation-flash');
        windowImpl.setTimeout(() => anchor.classList.remove('annotation-flash'), 1200);
      }
    }
  });

  // ── floating "Comment" button (appears next to the selection) ─────────────
  const popover = documentImpl.createElement('div');
  popover.className = 'annotation-popover';
  popover.hidden = true;
  documentImpl.body.appendChild(popover);

  // ── note input as a clear modal ──────────────────────────────────────────
  // A centered dialog (not a tiny inline box) so on mobile it can't be mistaken
  // for the chat composer and is comfortable to type into above the keyboard.
  const noteModal = documentImpl.createElement('div');
  noteModal.className = 'annotation-note-modal';
  noteModal.hidden = true;
  noteModal.innerHTML =
    '<div class="annotation-note-backdrop" data-action="cancel-note"></div>'
    + `<div class="annotation-note-card" role="dialog" aria-modal="true" aria-label="${esc(t('annotation.addNote'))}">`
    + '<div class="annotation-note-quote"></div>'
    + `<textarea class="annotation-note-input" placeholder="${esc(t('annotation.addNotePlaceholder'))}" rows="3"></textarea>`
    + '<div class="annotation-note-actions">'
    + `<button type="button" class="annotation-note-cancel" data-action="cancel-note">${esc(t('annotation.cancel'))}</button>`
    + `<button type="button" class="annotation-note-addchat" data-action="add-to-chat">${esc(t('annotation.addToChat'))}</button>`
    + `<button type="button" class="annotation-note-save" data-action="save-note">${esc(t('annotation.saveNote'))}</button>`
    + '</div></div>';
  documentImpl.body.appendChild(noteModal);
  const noteInput = noteModal.querySelector('.annotation-note-input');
  const noteQuote = noteModal.querySelector('.annotation-note-quote');

  function hidePopover() {
    popover.hidden = true;
    popover.innerHTML = '';
  }

  function noteModalOpen() {
    return !noteModal.hidden;
  }

  function positionPopover(rect) {
    const top = Math.max(8, rect.bottom + 10);
    const left = Math.min(Math.max(8, rect.left), windowImpl.innerWidth - 150);
    popover.style.position = 'fixed';
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  function showCommentButton(rect) {
    popover.innerHTML = `<button type="button" class="annotation-pop-btn" data-action="start-comment">${esc(t('annotation.comment'))}</button>`;
    positionPopover(rect);
    popover.hidden = false;
  }

  function openNoteInput() {
    if (!pending) return;
    hidePopover();
    noteQuote.textContent = `"${String(pending.text || '').replace(/\s+/g, ' ').trim()}"`;
    noteInput.value = '';
    noteModal.hidden = false;
    noteInput.focus(); // within the tap gesture, so the keyboard opens for THIS field
  }

  function closeNote() {
    noteModal.hidden = true;
    pending = null;
  }

  // "Add to chat": attach the selection (and optional note) to the composer as a
  // clickable chip instead of saving it to the Notes list. The composer owns the
  // chip + send formatting; we just hand off the text.
  function addToChat() {
    if (!pending) return;
    const note = noteInput.value.trim();
    const original = pending.text;
    pending = null;
    noteModal.hidden = true;
    windowImpl.getSelection?.()?.removeAllRanges?.();
    if (typeof onAddToChat === 'function') onAddToChat({ original, note });
  }

  async function saveComment() {
    if (!pending) return;
    const note = noteInput.value.trim();
    const optimistic = {
      id: `tmp-${Date.now()}`,
      anchorId: pending.anchorId,
      startOffset: pending.start,
      endOffset: pending.end,
      kind: 'comment',
      text: note,
      original: pending.text,
      source: 'local',
      createdAt: Date.now()
    };
    const payload = {
      anchorId: optimistic.anchorId,
      startOffset: optimistic.startOffset,
      endOffset: optimistic.endOffset,
      kind: 'comment',
      text: note,
      original: optimistic.original
    };
    pending = null;
    noteModal.hidden = true;
    windowImpl.getSelection?.()?.removeAllRanges?.();
    setAnnotations([...annotations, optimistic]); // optimistic; bumps the load guard
    // Surface the just-created note: open the sidebar if hidden and switch to it.
    if (typeof onCreate === 'function') onCreate();
    try {
      await api.create(payload);
    } finally {
      refresh();
    }
  }

  popover.addEventListener('mousedown', (e) => e.preventDefault()); // keep selection alive on desktop
  popover.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-action="start-comment"]')) openNoteInput();
  });
  noteModal.addEventListener('click', (e) => {
    const action = e.target.closest?.('[data-action]')?.dataset.action;
    if (action === 'save-note') saveComment();
    else if (action === 'add-to-chat') addToChat();
    else if (action === 'cancel-note') closeNote();
  });

  function maybeShowFromSelection() {
    if (noteModalOpen()) return; // don't disturb an in-progress note
    if (popover.contains(documentImpl.activeElement)) return;
    const sel = windowImpl.getSelection?.();
    const info = rangeApi.getSelectionInfo(sel, { documentImpl });
    if (!info || !allScopes.some((s) => s.contains(info.anchorEl))) {
      if (!popover.hidden) hidePopover();
      return;
    }
    pending = info;
    let rect = { bottom: 0, left: 0 };
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch { /* default */ }
    showCommentButton(rect);
  }

  function onMouseUp(e) {
    if (popover.contains(e.target) || noteModal.contains(e.target)) return;
    maybeShowFromSelection();
  }

  // Touch text selection (mobile) finalizes via the native selection handles and
  // often fires no mouseup, so we also react to selectionchange — debounced so it
  // runs once the selection settles, not on every drag tick.
  let selectionTimer = null;
  function onSelectionChange() {
    if (windowImpl.clearTimeout) windowImpl.clearTimeout(selectionTimer);
    if (windowImpl.setTimeout) selectionTimer = windowImpl.setTimeout(maybeShowFromSelection, selectionDelayMs);
    else maybeShowFromSelection();
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    if (noteModalOpen()) closeNote();
    else if (!popover.hidden) hidePopover();
  }

  function init() {
    if (windowImpl.MutationObserver) {
      observer = new windowImpl.MutationObserver(() => {
        if (windowImpl.requestAnimationFrame) windowImpl.requestAnimationFrame(reapply);
        else reapply();
      });
    }
    documentImpl.addEventListener('mouseup', onMouseUp);
    documentImpl.addEventListener('selectionchange', onSelectionChange);
    documentImpl.addEventListener('keydown', onKeyDown);
    refresh();
  }

  function destroy() {
    observer?.disconnect();
    if (windowImpl.clearTimeout) windowImpl.clearTimeout(selectionTimer);
    documentImpl.removeEventListener('mouseup', onMouseUp);
    documentImpl.removeEventListener('selectionchange', onSelectionChange);
    documentImpl.removeEventListener('keydown', onKeyDown);
    popover.remove();
    noteModal.remove();
  }

  return { init, setAnnotations, reapply, refresh, render, destroy, get annotations() { return annotations; } };
}
