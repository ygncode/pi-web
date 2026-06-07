<script module>
  // Prompt text the split button injects into the composer for each git action.
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
</script>

<script>
  import { onMount } from 'svelte';
  import { icon, ChevronDown, ExternalLink } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
  import * as defaultGitApi from '../../session/chat/git-api.js';

  // The branch indicator + smart git action control beneath the chat composer.
  // The bar stays visible (even outside a git repo) because it also hosts the
  // always-available btw button. gitApi is injectable for tests.
  let { sessionId = '', gitApi = defaultGitApi } = $props();

  onMount(() => {
    const documentImpl = document;
    const windowImpl = window;
    const bar = documentImpl.getElementById('pi-git-bar');
    if (!bar || !gitApi) return;

    const cleanups = [];
    const on = (host, type, handler, opts) => {
      host.addEventListener(type, handler, opts);
      cleanups.push(() => host.removeEventListener(type, handler, opts));
    };

    const branchWrap = documentImpl.getElementById('pi-git-branch');
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
      commit: documentImpl.getElementById('pi-git-pr-commit'),
    };

    let currentBranch = '';
    let prCreateUrl = '';
    let existingPrUrl = '';
    let primaryAction = () => {};

    const show = (el, visible) => { if (el) el.hidden = !visible; };

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

    // Each action is { label, run, external? }. `external` actions open a URL in
    // a new tab, so their label gets a trailing external-link icon. The plan
    // picks one primary plus a list of secondary actions shown under the caret.
    const ACTIONS = {
      draft: { label: t('git.createPr'), run: () => insertPrompt(DRAFT_PR_PROMPT) },
      manual: { label: t('git.createPrManually'), external: true, run: () => openUrl(prCreateUrl) },
      view: { label: t('git.viewPr'), external: true, run: () => openUrl(existingPrUrl) },
      merge: { label: t('git.mergePr'), run: () => insertPrompt(MERGE_PR_PROMPT) },
      commit: { label: t('git.commitPush'), run: () => insertPrompt(COMMIT_PUSH_PROMPT) },
    };

    // Decide the primary action + secondary list from the current git state.
    // "Commit & push" only appears when there is actually something to push.
    function planActions({ isDefault, hasPr, hasChanges }) {
      if (isDefault) {
        return { primary: hasChanges ? 'commit' : null, secondary: [] };
      }
      if (!hasPr) {
        return { primary: 'draft', secondary: ['manual'] };
      }
      if (hasChanges) return { primary: 'commit', secondary: ['view', 'merge'] };
      return { primary: 'view', secondary: ['merge'] };
    }

    function applyInfo(info) {
      if (!info || !info.isRepo || !info.branch) {
        // Not a git repo: hide the git controls but keep the bar itself visible,
        // since it also hosts the always-available btw button.
        show(branchWrap, false);
        show(prWrap, false);
        bar.hidden = false;
        return;
      }
      show(branchWrap, true);
      currentBranch = info.branch;
      prCreateUrl = info.prCreateUrl || '';
      existingPrUrl = info.prUrl || '';
      if (nameEl) nameEl.textContent = info.branch;
      if (items.manual) items.manual.title = prCreateUrl ? prCreateUrl : t('git.noRemote');

      const isDefault = !!info.isDefault;
      const hasPr = !isDefault && !!existingPrUrl;
      const hasChanges = !!info.hasChanges;

      show(editBtn, !isDefault);

      const plan = planActions({ isDefault, hasPr, hasChanges });
      const primary = plan.primary ? ACTIONS[plan.primary] : null;
      if (primary) {
        if (primaryLabel) {
          primaryLabel.textContent = primary.label;
          if (primary.external) primaryLabel.innerHTML += ' ' + icon(ExternalLink, { size: 12 });
        }
        primaryAction = primary.run;
      } else {
        primaryAction = () => {};
      }
      show(primaryBtn, !!primary);

      const secondary = new Set(plan.secondary);
      Object.keys(items).forEach((key) => show(items[key], secondary.has(key)));
      show(caretBtn, plan.secondary.length > 0);
      if (plan.secondary.length === 0) setMenuOpen(false);

      show(prWrap, !!primary || plan.secondary.length > 0);
      bar.hidden = false;
    }

    function refresh() {
      return gitApi.getGitInfo(sessionId).then(applyInfo).catch(() => {});
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
      gitApi.renameBranch(sessionId, next)
        .then(() => {
          closeEditor();
          return refresh();
        })
        .catch((err) => {
          if (input) {
            input.title = (err && err.message) || t('git.renameFailed');
            input.focus();
            input.select();
          }
        });
    }

    if (editBtn) {
      on(editBtn, 'click', (e) => { e.preventDefault(); openEditor(); });
    }
    if (input) {
      on(input, 'keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
        else if (e.key === 'Escape') { e.preventDefault(); closeEditor(); }
      });
      on(input, 'blur', () => closeEditor());
    }

    // ── Split button ──
    function setMenuOpen(open) {
      if (!prMenu || !caretBtn) return;
      prMenu.hidden = !open;
      caretBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (primaryBtn) {
      on(primaryBtn, 'click', (e) => { e.preventDefault(); setMenuOpen(false); primaryAction(); });
    }
    if (caretBtn) {
      on(caretBtn, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(prMenu ? prMenu.hidden : false);
      });
    }
    on(documentImpl, 'click', (e) => {
      if (prMenu && !prMenu.hidden && prWrap && !prWrap.contains(e.target)) setMenuOpen(false);
    });

    Object.keys(items).forEach((key) => {
      const el = items[key];
      if (!el) return;
      on(el, 'click', (e) => { e.preventDefault(); setMenuOpen(false); ACTIONS[key].run(); });
    });

    refresh();

    return () => { for (const fn of cleanups) fn(); };
  });
</script>

<div class="pi-git-bar" id="pi-git-bar"><div class="pi-git-branch" id="pi-git-branch" hidden><span class="pi-git-branch-name" id="pi-git-branch-name" title={t('git.currentBranch')}></span><button type="button" class="pi-git-edit" id="pi-git-branch-edit" title={t('git.renameBranch')} aria-label={t('git.renameBranch')}></button><input type="text" class="pi-git-branch-input" id="pi-git-branch-input" autocomplete="off" spellcheck="false" aria-label={t('git.newBranchName')} hidden></div><div class="pi-git-right"><button type="button" class="pi-git-pr-button pi-btw-button" id="pi-btw-button" title="btw">btw</button><div class="pi-git-pr" id="pi-git-pr" hidden><button type="button" class="pi-git-pr-button pi-git-primary" id="pi-git-primary"><span id="pi-git-primary-label">{t('git.createPr')}</span></button><button type="button" class="pi-git-pr-button pi-git-caret" id="pi-git-caret" aria-haspopup="true" aria-expanded="false" aria-label={t('git.moreActions')}>{@html icon(ChevronDown, { size: 12 })}</button><div class="pi-git-pr-menu" id="pi-git-pr-menu" role="menu" hidden><button type="button" class="pi-git-pr-item" id="pi-git-pr-view" role="menuitem" hidden>{t('git.viewPr')} {@html icon(ExternalLink, { size: 12 })}</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-draft" role="menuitem" hidden>{t('git.createDraftPr')}</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-manual" role="menuitem">{t('git.createPrManually')} {@html icon(ExternalLink, { size: 12 })}</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-merge" role="menuitem" hidden>{t('git.mergePr')}</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-commit" role="menuitem" hidden>{t('git.commitPush')}</button></div></div></div></div>
