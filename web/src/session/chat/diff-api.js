import { getJSON, postJSON } from '../../shared/api.js';

export function getDiff(sessionId, { getImpl = getJSON } = {}) {
  return getImpl(`/api/git/diff?id=${encodeURIComponent(sessionId)}`);
}

export function getReviewComments(sessionId, { getImpl = getJSON } = {}) {
  return getImpl(`/api/diff/reviews?session=${encodeURIComponent(sessionId)}`);
}

export function saveReviewComment(sessionId, comment, { postImpl = postJSON } = {}) {
  return postImpl(`/api/diff/reviews?session=${encodeURIComponent(sessionId)}`, comment);
}

export function deleteReviewComment(sessionId, id, { fetchImpl = fetch } = {}) {
  return fetchImpl(
    `/api/diff/reviews?session=${encodeURIComponent(sessionId)}&id=${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  ).then((r) => r.json());
}
