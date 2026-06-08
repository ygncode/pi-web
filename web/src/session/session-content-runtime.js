// Live wiring for the message pane (#messages). <SessionContent> renders
// model.activePath as <SessionEntry> components and runs afterRender(container)
// after each (re)render; this supplies that afterRender hook (toggle state +
// lazy highlight), the per-message copy/fork/label delegated handler, and the
// download-JSONL action. Also builds the sessionFormat object setupSessionUi
// needs. Live-only — the static export wires its own afterRender in export-entry.
//
// Relocated out of session.js during the Svelte migration teardown
// (docs/dev/svelte-migration-plan.md §11).

import { setIconElement, Loader } from '../shared/icons.js';
import { t } from '../shared/i18n.js';
import { openLabel } from './session-modals.svelte.js';
import { navigate } from '../shared/navigation.js';
import { sessionRuntime } from './session-runtime.js';
import { extractContent } from './tree/session-filter.js';
import { escapeHtml, formatToolCall, getTreeNodeDisplayHtml, shortenPath, truncate } from './render/session-format.js';
import { buildShareUrl, copyToClipboard, downloadSessionJson } from './render/session-entry-actions.js';

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

  const previousDownloadSessionJson = target.downloadSessionJson;
  target.downloadSessionJson = () => downloadSessionJson({
    entries: model.entries,
    header: model.header,
    documentImpl,
    URLImpl: target.URL,
    BlobImpl: target.Blob,
  });

  // Fork a new session starting at an entry.
  const forkEntry = (entryId, btn) => {
    if (!target.confirm('Are you sure you want to fork a new session starting from this message?')) {
      return;
    }
    const originalChildren = Array.from(btn.childNodes).map((node) => node.cloneNode(true));
    const restoreButton = () => btn.replaceChildren(...originalChildren.map((node) => node.cloneNode(true)));
    setIconElement(btn, Loader, { size: 13, class: 'spinner', documentImpl });
    btn.disabled = true;

    target.fetch(`/api/fork-session?id=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          navigate('/session?id=' + encodeURIComponent(data.id), { windowImpl: target });
        } else {
          restoreButton();
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
        restoreButton();
        btn.disabled = false;
        target.alert('Fork failed');
      });
  };

  // Set/clear an entry's tree label. The modal is <LabelModal>, opened via the
  // shared sessionModals store; this owns the save (API + reactive labelMap update).
  const labelEntry = (entryId) => {
    openLabel({
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

  // After each (re)render of <SessionContent>, re-apply persisted collapse/toggle
  // state and lazy-highlight any pending code blocks.
  if (contentRuntime) {
    contentRuntime.afterRender = (container) => {
      sessionRuntime.toggleState?.applyToNode(container);
      applyLazyHighlighting(documentImpl);
    };
  }

  // One delegated handler for the per-entry copy/fork/label buttons; survives the
  // reactive re-renders of #messages.
  const messagesEl = documentImpl.getElementById('messages');
  const onMessagesClick = (e) => {
    const copyBtn = e.target.closest?.('.copy-link-btn');
    if (copyBtn) {
      e.stopPropagation();
      const url = buildShareUrl(copyBtn.dataset.entryId, {
        documentImpl,
        windowImpl: target,
        getCurrentLeafId: () => model.currentLeafId,
        URLImpl: target.URL,
      });
      copyToClipboard(url, copyBtn, { documentImpl, navigatorImpl: target.navigator });
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
  };
  messagesEl?.addEventListener('click', onMessagesClick);

  return {
    sessionFormat,
    dispose: () => {
      messagesEl?.removeEventListener('click', onMessagesClick);
      if (previousDownloadSessionJson === undefined) delete target.downloadSessionJson;
      else target.downloadSessionJson = previousDownloadSessionJson;
    },
  };
}
