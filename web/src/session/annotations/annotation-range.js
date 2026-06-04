/**
 * annotation-range.js — DOM range ⇄ character-offset utilities for annotations.
 *
 * Annotations anchor to a rendered entry by its element id (`entry-<id>`) plus a
 * [start, end) character range measured against that element's text content.
 * Offsets (not live DOM ranges) survive the re-renders the session view does on
 * navigation/live-reload, so they are the stable anchor.
 *
 * Pure and DOM-injectable for jsdom testing.
 */

const SHOW_TEXT = 0x4; // NodeFilter.SHOW_TEXT, hard-coded to avoid a global dep

/** A transcript entry anchor (`entry-<id>`). */
export function isEntryAnchor(el) {
  return !!(el && el.id && el.id.indexOf('entry-') === 0);
}

/**
 * Default predicate: an anchor is a transcript entry (`entry-<id>`) or an
 * artifact source view (`artifact-<id>`). Both expose stable text content whose
 * character offsets survive re-render.
 */
export function isAnnotationAnchor(el) {
  if (!el || !el.id) return false;
  return el.id.indexOf('entry-') === 0 || el.id.indexOf('artifact-') === 0;
}

function elementOf(node) {
  if (!node) return null;
  return node.nodeType === 1 ? node : node.parentElement;
}

/** Walk up from a node to the nearest matching anchor element, else null. */
export function findAnchor(node, isAnchor = isAnnotationAnchor) {
  let el = elementOf(node);
  while (el) {
    if (isAnchor(el)) return el;
    el = el.parentElement;
  }
  return null;
}

function measureOffset(anchorEl, node, nodeOffset, documentImpl) {
  const range = documentImpl.createRange();
  range.selectNodeContents(anchorEl);
  try {
    range.setEnd(node, nodeOffset);
  } catch {
    return 0;
  }
  return range.toString().length;
}

/**
 * Describe the current text selection relative to its enclosing anchor.
 * Returns null if there is no usable selection (collapsed, cross-anchor, or
 * outside any anchor).
 */
export function getSelectionInfo(selection, { documentImpl = document, isAnchor = isAnnotationAnchor } = {}) {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const anchorEl = findAnchor(range.startContainer, isAnchor);
  if (!anchorEl) return null;
  // Keep it simple: a selection that spans into a different entry is rejected.
  if (findAnchor(range.endContainer, isAnchor) !== anchorEl) return null;

  const start = measureOffset(anchorEl, range.startContainer, range.startOffset, documentImpl);
  const end = measureOffset(anchorEl, range.endContainer, range.endOffset, documentImpl);
  const text = range.toString();
  if (end <= start || !text.trim()) return null;

  return { anchorEl, anchorId: anchorEl.id, start, end, text };
}

/**
 * Wrap the [start, end) character range of an anchor's text in a <mark>.
 * Returns true if anything was wrapped. Each wrapped run lives inside a single
 * text node, so surroundContents never crosses element boundaries.
 */
export function wrapRange(anchorEl, start, end, { className = 'pi-annotation', dataset = {}, documentImpl = document } = {}) {
  if (!anchorEl || end <= start) return false;
  const walker = documentImpl.createTreeWalker(anchorEl, SHOW_TEXT);
  const targets = [];
  let pos = 0;
  let node;
  while ((node = walker.nextNode())) {
    const len = node.nodeValue.length;
    const nodeStart = pos;
    const nodeEnd = pos + len;
    pos = nodeEnd;
    if (nodeEnd <= start || nodeStart >= end) continue;
    targets.push({
      node,
      from: Math.max(start, nodeStart) - nodeStart,
      to: Math.min(end, nodeEnd) - nodeStart
    });
  }
  // Wrap last→first so splitting a later node can't invalidate an earlier ref.
  for (let i = targets.length - 1; i >= 0; i -= 1) {
    const { node: n, from, to } = targets[i];
    const range = documentImpl.createRange();
    range.setStart(n, from);
    range.setEnd(n, to);
    const mark = documentImpl.createElement('mark');
    mark.className = className;
    for (const [k, v] of Object.entries(dataset)) mark.dataset[k] = v;
    try {
      range.surroundContents(mark);
    } catch {
      /* run crossed a boundary unexpectedly — skip it rather than corrupt DOM */
    }
  }
  return targets.length > 0;
}

/** Remove every annotation <mark> in a container, restoring plain text. */
export function unwrapAll(container, { className = 'pi-annotation' } = {}) {
  if (!container) return;
  const marks = Array.from(container.querySelectorAll(`mark.${className}`));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

/**
 * Re-render all highlights for a container: clear existing marks, then wrap each
 * annotation against its anchor. Idempotent — safe to call after every render.
 */
export function applyHighlights(container, annotations, { className = 'pi-annotation', documentImpl = document } = {}) {
  if (!container) return;
  unwrapAll(container, { className });
  for (const a of annotations || []) {
    const anchorEl = documentImpl.getElementById(a.anchorId);
    if (!anchorEl || !container.contains(anchorEl)) continue;
    wrapRange(anchorEl, a.startOffset, a.endOffset, {
      className,
      dataset: { annotationId: a.id },
      documentImpl
    });
  }
}
