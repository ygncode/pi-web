import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import GitFooter, { DRAFT_PR_PROMPT, COMMIT_PUSH_PROMPT, MERGE_PR_PROMPT } from './GitFooter.svelte';

const flush = () => new Promise((r) => setTimeout(r, 0));
const id = (x) => document.getElementById(x);

// GitFooter wires the composer's textarea (#pi-chat-message), which lives in
// <ChatComposer>, not in GitFooter itself — provide one for the prompt-insert
// assertions.
let textarea;
function renderFooter(gitApi) {
  textarea = document.createElement('textarea');
  textarea.id = 'pi-chat-message';
  document.body.appendChild(textarea);
  render(GitFooter, { props: { sessionId: 's', gitApi } });
}

afterEach(() => {
  cleanup();
  textarea?.remove();
  textarea = undefined;
  vi.restoreAllMocks();
});

describe('GitFooter', () => {
  it('hides the git controls but keeps the bar visible (for btw) when the cwd is not a git repo', async () => {
    renderFooter({ getGitInfo: vi.fn().mockResolvedValue({ isRepo: false }) });
    await flush();
    expect(id('pi-git-bar').hidden).toBe(false);
    expect(id('pi-git-branch').hidden).toBe(true);
    expect(id('pi-git-pr').hidden).toBe(true);
  });

  it('feature branch, no PR -> primary Create PR (commit+push+create), only manual under the caret', async () => {
    renderFooter({ getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'feature/x', isDefault: false, hasChanges: true, prUrl: '' }) });
    await flush();
    expect(id('pi-git-primary-label').textContent).toBe('Create PR');
    expect(id('pi-git-branch-edit').hidden).toBe(false);
    expect(id('pi-git-caret').hidden).toBe(false);
    expect(id('pi-git-pr-manual').hidden).toBe(false);
    expect(id('pi-git-pr-commit').hidden).toBe(true);
    expect(id('pi-git-pr-view').hidden).toBe(true);
    expect(id('pi-git-pr-merge').hidden).toBe(true);
    id('pi-git-primary').click();
    expect(id('pi-chat-message').value).toBe(DRAFT_PR_PROMPT);
  });

  it('feature branch, open PR + local changes -> primary Commit & push, secondary view + merge', async () => {
    renderFooter({ getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'feature/x', isDefault: false, hasChanges: true, prUrl: 'https://github.com/o/r/pull/42' }) });
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
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderFooter({ getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'feature/x', isDefault: false, hasChanges: false, prUrl: 'https://github.com/o/r/pull/42' }) });
    await flush();
    expect(id('pi-git-primary-label').textContent.trim()).toBe('View PR');
    expect(id('pi-git-primary-label').querySelector('svg')).not.toBeNull();
    expect(id('pi-git-pr-merge').hidden).toBe(false);
    expect(id('pi-git-pr-commit').hidden).toBe(true);
    id('pi-git-primary').click();
    expect(open).toHaveBeenCalledWith('https://github.com/o/r/pull/42', '_blank', 'noopener');
  });

  it('default branch + changes -> primary Commit & push, no caret, no edit pencil', async () => {
    renderFooter({ getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'main', isDefault: true, hasChanges: true }) });
    await flush();
    expect(id('pi-git-primary-label').textContent).toBe('Commit & push');
    expect(id('pi-git-caret').hidden).toBe(true);
    expect(id('pi-git-branch-edit').hidden).toBe(true);
    id('pi-git-primary').click();
    expect(id('pi-chat-message').value).toBe(COMMIT_PUSH_PROMPT);
  });

  it('default branch + no changes -> action control hidden, only the branch shows', async () => {
    renderFooter({ getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'main', isDefault: true, hasChanges: false }) });
    await flush();
    expect(id('pi-git-bar').hidden).toBe(false);
    expect(id('pi-git-pr').hidden).toBe(true);
    expect(id('pi-git-primary').hidden).toBe(true);
  });

  it('menu items run their actions (Merge PR injects merge prompt)', async () => {
    renderFooter({ getGitInfo: vi.fn().mockResolvedValue({ isRepo: true, branch: 'feature/x', isDefault: false, hasChanges: true, prUrl: 'https://github.com/o/r/pull/42' }) });
    await flush();
    id('pi-git-pr-merge').click();
    expect(id('pi-chat-message').value).toBe(MERGE_PR_PROMPT);
  });

  it('renames the branch and refreshes', async () => {
    const renameBranch = vi.fn().mockResolvedValue({ ok: true, branch: 'renamed' });
    const getGitInfo = vi
      .fn()
      .mockResolvedValueOnce({ isRepo: true, branch: 'old', isDefault: false, prUrl: '' })
      .mockResolvedValueOnce({ isRepo: true, branch: 'renamed', isDefault: false, prUrl: '' });
    renderFooter({ getGitInfo, renameBranch });
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
