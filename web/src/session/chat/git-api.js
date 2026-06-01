import { getJSON, postJSON } from '../../shared/api.js';

export function getGitInfo(sessionId, { getImpl = getJSON } = {}) {
  return getImpl(`/api/git/info?id=${encodeURIComponent(sessionId)}`);
}

export function renameBranch(sessionId, name, { postImpl = postJSON } = {}) {
  return postImpl(`/api/git/rename-branch?id=${encodeURIComponent(sessionId)}`, { name });
}
