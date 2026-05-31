import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupGitFooter, DRAFT_PR_PROMPT, COMMIT_PUSH_PROMPT, MERGE_PR_PROMPT } from './git-footer.js';

function createDom(dataset = {}) {
  const div = document.createElement('div');
  div.innerHTML = `
    <textarea id="pi-chat-message"></textarea>
    <div class="pi-git-bar" id="pi-git-bar" hidden>
      <div class="pi-git-branch" id="pi-git-branch">
        <span id="pi-git-branch-name"></span>
        <button id="pi-git-branch-edit"></button>
        <input id="pi-git-branch-input" hidden />
      </div>
      <div class="pi-git-pr" id="pi-git-pr">
        <button id="pi-git-primary"><span id="pi-git-primary-label"></span></button>
        <button id="pi-git-caret" aria-expanded="false"></button>
        <div id="pi-git-pr-menu" role="menu" hidden>
          <button id="pi-git-pr-view" hidden></button>
          <button id="pi-git-pr-draft" hidden></button>
          <button id="pi-git-pr-manual" hidden></button>
          <button id="pi-git-pr-merge" hidden></button>
          <button id="pi-git-pr-commit" hidden></button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  const bar = div.querySelector('#pi-git-bar');
  Object.entries(dataset).forEach(([k, v]) => { bar.dataset[k] = v; });
  return div;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const id = (x) => document.getElementById(x);

let dom;
afterEach(() => {
  if (dom) dom.remove();
  dom = undefined;
});

describe('setupGitFooter', () => {
  it('stays hidden when the cwd is not a git repo', async () => {
    dom = createDom();
    const gitApi = { getGitInfo: vi.fn().mockResolvedValue({ isRepo: false }) };
    setupGitFooter({ documentImpl: document, windowImpl: window, sessionId: 's', gitApi });
    await flush();
    expect(id('pi-git-bar').hidden).toBe(true);
  });

  it('renders synchronously from data attributes before the async fetch resolves', () => {
    dom = createDom({ gitRepo: 'true', gitBranch: 'feature/x', gitDefault: 'false', gitHasChanges: 'false' });
    // getGitInfo never resolves during this synchronous assertion.
    const gitApi = { getGitInfo: vi.fn(() => new Promise(() => {})) };
    setupGitFooter({ documentImpl: document, windowImpl: window, sessionId: 's', gitApi });
    expect(id('pi-git-bar').hidden).toBe(false);
    expect(id('pi-git-branch-name').textContent).toBe('feature/x');
    expect(id('pi-git-primary-label').textContent).toBe('Create PR');
  });

  it('feature branch, no PR -> primary Create PR (commit+push+create), only manual under the caret', async () => {
    dom = createDom();
    const gitApi = { getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'feature/x', isDefault: false, hasChanges: true, prUrl: '' }) };
    setupGitFooter({ documentImpl: document, windowImpl: window, sessionId: 's', gitApi });
    await flush();
    expect(id('pi-git-primary-label').textContent).toBe('Create PR');
    expect(id('pi-git-branch-edit').hidden).toBe(false);
    expect(id('pi-git-caret').hidden).toBe(false);
    expect(id('pi-git-pr-manual').hidden).toBe(false);
    // No separate Commit & push — Create PR already commits and pushes.
    expect(id('pi-git-pr-commit').hidden).toBe(true);
    expect(id('pi-git-pr-view').hidden).toBe(true);
    expect(id('pi-git-pr-merge').hidden).toBe(true);
    id('pi-git-primary').click();
    expect(id('pi-chat-message').value).toBe(DRAFT_PR_PROMPT);
  });

  it('feature branch, open PR + local changes -> primary Commit & push, secondary view + merge', async () => {
    dom = createDom();
    const gitApi = { getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'feature/x', isDefault: false, hasChanges: true, prUrl: 'https://github.com/o/r/pull/42' }) };
    setupGitFooter({ documentImpl: document, windowImpl: window, sessionId: 's', gitApi });
    await flush();
    expect(id('pi-git-primary-label').textContent).toBe('Commit & push');
    expect(id('pi-git-pr-view').hidden).toBe(false);
    expect(id('pi-git-pr-merge').hidden).toBe(false);
    expect(id('pi-git-pr-draft').hidden).toBe(true);
    expect(id('pi-git-pr-manual').hidden).toBe(true);
    id('pi-git-primary').click();
    expect(id('pi-chat-message').value).toBe(COMMIT_PUSH_PROMPT);
  });

  it('feature branch, open PR + no changes -> primary View PR, secondary merge only (no commit)', async () => {
    const open = vi.fn();
    dom = createDom();
    const win = { ...window, open, Event: window.Event };
    const gitApi = { getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'feature/x', isDefault: false, hasChanges: false, prUrl: 'https://github.com/o/r/pull/42' }) };
    setupGitFooter({ documentImpl: document, windowImpl: win, sessionId: 's', gitApi });
    await flush();
    expect(id('pi-git-primary-label').textContent).toBe('View PR ↗');
    expect(id('pi-git-pr-merge').hidden).toBe(false);
    expect(id('pi-git-pr-commit').hidden).toBe(true);
    id('pi-git-primary').click();
    expect(open).toHaveBeenCalledWith('https://github.com/o/r/pull/42', '_blank', 'noopener');
  });

  it('default branch + changes -> primary Commit & push, no caret, no edit pencil', async () => {
    dom = createDom();
    const gitApi = { getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'main', isDefault: true, hasChanges: true }) };
    setupGitFooter({ documentImpl: document, windowImpl: window, sessionId: 's', gitApi });
    await flush();
    expect(id('pi-git-primary-label').textContent).toBe('Commit & push');
    expect(id('pi-git-caret').hidden).toBe(true);
    expect(id('pi-git-branch-edit').hidden).toBe(true);
    id('pi-git-primary').click();
    expect(id('pi-chat-message').value).toBe(COMMIT_PUSH_PROMPT);
  });

  it('default branch + no changes -> action control hidden, only the branch shows', async () => {
    dom = createDom();
    const gitApi = { getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'main', isDefault: true, hasChanges: false }) };
    setupGitFooter({ documentImpl: document, windowImpl: window, sessionId: 's', gitApi });
    await flush();
    expect(id('pi-git-bar').hidden).toBe(false);
    expect(id('pi-git-pr').hidden).toBe(true);
    expect(id('pi-git-primary').hidden).toBe(true);
  });

  it('menu items run their actions (Merge PR injects merge prompt)', async () => {
    dom = createDom();
    const gitApi = { getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'feature/x', isDefault: false, hasChanges: true, prUrl: 'https://github.com/o/r/pull/42' }) };
    setupGitFooter({ documentImpl: document, windowImpl: window, sessionId: 's', gitApi });
    await flush();
    id('pi-git-pr-merge').click();
    expect(id('pi-chat-message').value).toBe(MERGE_PR_PROMPT);
  });

  it('renames the branch and refreshes', async () => {
    dom = createDom();
    const renameBranch = vi.fn().mockResolvedValue({ ok: true, branch: 'renamed' });
    const getGitInfo = vi
      .fn()
      .mockResolvedValueOnce({ isRepo: true, branch: 'old', isDefault: false, prUrl: '' })
      .mockResolvedValueOnce({ isRepo: true, branch: 'renamed', isDefault: false, prUrl: '' });
    setupGitFooter({ documentImpl: document, windowImpl: window, sessionId: 's', gitApi: { getGitInfo, renameBranch } });
    await flush();

    id('pi-git-branch-edit').click();
    const input = id('pi-git-branch-input');
    expect(input.hidden).toBe(false);
    input.value = 'renamed';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await flush();

    expect(renameBranch).toHaveBeenCalledWith('s', 'renamed');
    expect(id('pi-git-branch-name').textContent).toBe('renamed');
  });
});
