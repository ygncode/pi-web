// Wires the branch indicator + the smart git action control beneath the chat
// composer. The bar stays hidden unless the session cwd is a git repo.
//
// The right-hand control is a split button: a primary action chosen for the
// current state, plus a caret (▾) revealing the remaining relevant actions.

export const DRAFT_PR_PROMPT =
  'Commit any uncommitted changes on this branch with a clear message, push ' +
  'the branch to the remote, then open a draft pull request with ' +
  '`gh pr create --draft`. Review the diff first (`git status`, `git diff`, ' +
  '`git log`) and write a clear PR title, a description summarizing what ' +
  'changed and why, and a short test plan.';

export const COMMIT_PUSH_PROMPT =
  'Review the current changes (run `git status` and `git diff`), then stage ' +
  'and commit them with a clear message summarizing what changed and why, and ' +
  'push to the remote.';

export const MERGE_PR_PROMPT =
  'Merge the pull request for this branch once its checks are green: run ' +
  '`gh pr merge` (use a squash merge unless the project prefers otherwise) and ' +
  'delete the branch after merging.';

export function setupGitFooter({
  documentImpl = document,
  windowImpl = window,
  sessionId = '',
  gitApi
} = {}) {
  const bar = documentImpl.getElementById('pi-git-bar');
  if (!bar || !gitApi) return;

  const nameEl = documentImpl.getElementById('pi-git-branch-name');
  const editBtn = documentImpl.getElementById('pi-git-branch-edit');
  const input = documentImpl.getElementById('pi-git-branch-input');
  const prWrap = documentImpl.getElementById('pi-git-pr');
  const primaryBtn = documentImpl.getElementById('pi-git-primary');
  const primaryLabel = documentImpl.getElementById('pi-git-primary-label');
  const caretBtn = documentImpl.getElementById('pi-git-caret');
  const prMenu = documentImpl.getElementById('pi-git-pr-menu');
  const items = {
    view: documentImpl.getElementById('pi-git-pr-view'),
    draft: documentImpl.getElementById('pi-git-pr-draft'),
    manual: documentImpl.getElementById('pi-git-pr-manual'),
    merge: documentImpl.getElementById('pi-git-pr-merge'),
    commit: documentImpl.getElementById('pi-git-pr-commit')
  };

  let currentBranch = '';
  let prCreateUrl = '';
  let existingPrUrl = '';
  let primaryAction = () => {};

  function show(el, visible) {
    if (el) el.hidden = !visible;
  }

  function insertPrompt(text) {
    const textarea = documentImpl.getElementById('pi-chat-message');
    if (!textarea) return;
    textarea.value = text;
    const EventCtor = windowImpl.Event || (typeof Event !== 'undefined' ? Event : null);
    if (EventCtor) textarea.dispatchEvent(new EventCtor('input', { bubbles: true }));
    if (typeof textarea.focus === 'function') textarea.focus();
  }
  function openUrl(url) {
    if (url && typeof windowImpl.open === 'function') windowImpl.open(url, '_blank', 'noopener');
  }

  // Each action is { id, label, run }. The plan picks one primary plus a list
  // of secondary actions shown under the caret.
  const ACTIONS = {
    draft: { label: 'Create PR', run: () => insertPrompt(DRAFT_PR_PROMPT) },
    manual: { label: 'Create PR manually ↗', run: () => openUrl(prCreateUrl) },
    view: { label: 'View PR ↗', run: () => openUrl(existingPrUrl) },
    merge: { label: 'Merge PR', run: () => insertPrompt(MERGE_PR_PROMPT) },
    commit: { label: 'Commit & push', run: () => insertPrompt(COMMIT_PUSH_PROMPT) }
  };

  // Decide the primary action + secondary list from the current git state.
  // "Commit & push" only appears when there is actually something to push.
  function planActions({ isDefault, hasPr, hasChanges }) {
    if (isDefault) {
      // The only thing to do on the default branch is push pending changes.
      return { primary: hasChanges ? 'commit' : null, secondary: [] };
    }
    if (!hasPr) {
      // "Create PR" already commits + pushes, so the only alternative offered
      // is doing it by hand on GitHub.
      return { primary: 'draft', secondary: ['manual'] };
    }
    // An open PR already exists for this feature branch.
    if (hasChanges) return { primary: 'commit', secondary: ['view', 'merge'] };
    return { primary: 'view', secondary: ['merge'] };
  }

  function applyInfo(info) {
    if (!info || !info.isRepo || !info.branch) {
      bar.hidden = true;
      return;
    }
    currentBranch = info.branch;
    prCreateUrl = info.prCreateUrl || '';
    existingPrUrl = info.prUrl || '';
    if (nameEl) nameEl.textContent = info.branch;
    if (items.manual) items.manual.title = prCreateUrl ? prCreateUrl : 'No GitHub remote configured';

    const isDefault = !!info.isDefault;
    const hasPr = !isDefault && !!existingPrUrl;
    const hasChanges = !!info.hasChanges;

    show(editBtn, !isDefault);

    const plan = planActions({ isDefault, hasPr, hasChanges });
    const primary = plan.primary ? ACTIONS[plan.primary] : null;
    if (primary) {
      if (primaryLabel) primaryLabel.textContent = primary.label;
      primaryAction = primary.run;
    } else {
      primaryAction = () => {};
    }
    show(primaryBtn, !!primary);

    const secondary = new Set(plan.secondary);
    Object.keys(items).forEach((id) => show(items[id], secondary.has(id)));
    show(caretBtn, plan.secondary.length > 0);
    if (plan.secondary.length === 0) setMenuOpen(false);

    // Hide the whole action cluster when there is nothing to do.
    show(prWrap, !!primary || plan.secondary.length > 0);

    bar.hidden = false;
  }

  // Synchronous first paint from the server-stamped data attributes (branch,
  // default, has-changes) so the control is correct immediately. The async
  // refresh() then fills in PR state (which can require a network gh call).
  function infoFromDataset() {
    if (bar.dataset.gitRepo !== 'true') return null;
    return {
      isRepo: true,
      branch: bar.dataset.gitBranch || '',
      isDefault: bar.dataset.gitDefault === 'true',
      hasChanges: bar.dataset.gitHasChanges === 'true',
      prUrl: '',
      prCreateUrl: ''
    };
  }

  function refresh() {
    return gitApi
      .getGitInfo(sessionId)
      .then(applyInfo)
      .catch(() => {});
  }

  // ── Branch rename ──
  function openEditor() {
    if (!input) return;
    input.value = currentBranch;
    input.hidden = false;
    if (nameEl) nameEl.hidden = true;
    if (editBtn) editBtn.hidden = true;
    input.focus();
    input.select();
  }
  function closeEditor() {
    if (!input) return;
    input.hidden = true;
    if (nameEl) nameEl.hidden = false;
    if (editBtn) editBtn.hidden = false;
  }
  function commitRename() {
    const next = (input ? input.value : '').trim();
    if (!next || next === currentBranch) {
      closeEditor();
      return;
    }
    gitApi
      .renameBranch(sessionId, next)
      .then(() => {
        closeEditor();
        return refresh();
      })
      .catch((err) => {
        if (input) {
          input.title = (err && err.message) || 'Rename failed';
          input.focus();
          input.select();
        }
      });
  }

  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openEditor();
    });
  }
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeEditor();
      }
    });
    input.addEventListener('blur', () => closeEditor());
  }

  // ── Split button ──
  function setMenuOpen(open) {
    if (!prMenu || !caretBtn) return;
    prMenu.hidden = !open;
    caretBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (primaryBtn) {
    primaryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setMenuOpen(false);
      primaryAction();
    });
  }
  if (caretBtn) {
    caretBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(prMenu ? prMenu.hidden : false);
    });
  }
  documentImpl.addEventListener('click', (e) => {
    if (prMenu && !prMenu.hidden && prWrap && !prWrap.contains(e.target)) setMenuOpen(false);
  });

  Object.keys(items).forEach((id) => {
    const el = items[id];
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      setMenuOpen(false);
      ACTIONS[id].run();
    });
  });

  const initial = infoFromDataset();
  if (initial) applyInfo(initial);
  refresh();
  return { refresh };
}
