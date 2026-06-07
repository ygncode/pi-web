// Live wiring for the message pane (#messages). <SessionContent> (mounted by
// SessionPage) renders model.activePath via the injected renderEntry and runs
// afterRender(container) after each (re)render; this builds that renderEntry from
// the shared model and wires the single delegated copy/fork/label click handler.
// Live-only — the static export builds its own renderer in export-entry.js.
//
// Relocated out of session.js during the Svelte migration teardown
// (docs/dev/svelte-migration-plan.md §11).

import { marked } from 'marked';
import { icon, Loader } from '../shared/icons.js';
import { t } from '../shared/i18n.js';
import { extractContent } from './tree/session-filter.js';
import { escapeHtml, formatToolCall, getTreeNodeDisplayHtml, shortenPath, truncate } from './render/session-format.js';
import { safeMarkedParse } from './render/markdown.js';
import * as sessionEntryRenderer from './render/session-entry-renderer.js';

export function wireSessionContentRuntime({
  windowImpl,
  documentImpl,
  model,
  sessionId = '',
  contentRuntime,
  applyLazyHighlighting,
}) {
  const target = windowImpl;

  const escape = (text) => escapeHtml(text, { documentImpl });
  const sessionFormat = {
    shortenPath,
    formatToolCall,
    escapeHtml: escape,
    truncate,
    getTreeNodeDisplayHtml: (entry, label) => getTreeNodeDisplayHtml(entry, label, {
      extractContent,
      toolCallMap: model.toolCallMap,
      escapeHtmlImpl: escape,
    }),
  };

  const entryRenderer = sessionEntryRenderer.createSessionEntryRenderer({
    entries: model.entries,
    header: model.header,
    toolCallMap: model.toolCallMap,
    renderedTools: model.renderedTools,
    currentLeafIdRef: () => model.currentLeafId,
    escapeHtml: sessionFormat.escapeHtml,
    shortenPath,
    formatToolCall,
    safeMarkedParse: (text) => safeMarkedParse(text, { marked }),
    hljs: null,
    documentImpl,
    windowImpl: target,
    navigatorImpl: target.navigator,
    URLImpl: target.URL,
    BlobImpl: target.Blob,
  });
  target.downloadSessionJson = entryRenderer.downloadSessionJson;

  // Fork a new session starting at an entry.
  const forkEntry = (entryId, btn) => {
    if (!target.confirm('Are you sure you want to fork a new session starting from this message?')) {
      return;
    }
    const originalHtml = btn.innerHTML;
    btn.innerHTML = icon(Loader, { size: 13, class: 'spinner' });
    btn.disabled = true;

    target.fetch(`/api/fork-session?id=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          target.location.href = '/session?id=' + encodeURIComponent(data.id);
        } else {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
          const notice = documentImpl.getElementById('command-menu-toast');
          if (notice) {
            notice.textContent = data.error || 'Fork failed';
            notice.classList.add('visible');
            setTimeout(() => notice.classList.remove('visible'), 1500);
          } else {
            target.alert(data.error || 'Fork failed');
          }
        }
      })
      .catch(() => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        target.alert('Fork failed');
      });
  };

  // Set/clear an entry's tree label. The modal is <LabelModal> (SessionPage
  // exposes the opener); this owns the save (API + reactive labelMap update).
  const labelEntry = (entryId) => {
    target.__piOpenLabelModal?.({
      entryId,
      currentLabel: model.labelMap.get(entryId) || '',
      onSave: ({ entryId: id, label }) => {
        target.fetch(`/api/label-session?id=${encodeURIComponent(sessionId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: id, label }),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) throw new Error(data.error || t('session.labelSaveFailed'));
            if (label) model.labelMap.set(id, label);
            else model.labelMap.delete(id);
          })
          .catch((err) => target.alert(err?.message || t('session.labelSaveFailed')));
      },
    });
  };

  // Inject the renderer + afterRender hook into the shared $state runtime so the
  // message pane paints as soon as they're available.
  if (contentRuntime) {
    contentRuntime.renderEntry = entryRenderer.renderEntry;
    contentRuntime.afterRender = (container) => {
      target.applyToggleStateToNode?.(container);
      applyLazyHighlighting(documentImpl);
    };
  }

  // One delegated handler for the per-entry copy/fork/label buttons; survives the
  // reactive re-renders of #messages.
  const messagesEl = documentImpl.getElementById('messages');
  messagesEl?.addEventListener('click', (e) => {
    const copyBtn = e.target.closest?.('.copy-link-btn');
    if (copyBtn) {
      e.stopPropagation();
      entryRenderer.copyToClipboard(entryRenderer.buildShareUrl(copyBtn.dataset.entryId), copyBtn);
      return;
    }
    const forkBtn = e.target.closest?.('.fork-btn');
    if (forkBtn) {
      e.stopPropagation();
      forkEntry(forkBtn.dataset.entryId, forkBtn);
      return;
    }
    const labelBtn = e.target.closest?.('.label-btn');
    if (labelBtn) {
      e.stopPropagation();
      labelEntry(labelBtn.dataset.entryId);
    }
  });

  return { entryRenderer, sessionFormat };
}
