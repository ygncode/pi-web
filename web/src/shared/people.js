// Multi-user hub helpers: who am I, who else owns sessions, and which person's
// sessions the sidebar is showing (cookie read by the server on /api/sessions
// and /api/projects).
import { getJSON } from './api.js';

export const VIEW_COOKIE = 'pi_view_owner';
export const VIEW_MINE = 'me';
export const VIEW_ALL = 'all';
export const VIEW_UNASSIGNED = '_unassigned';

export function fetchPeople(fetchImpl) {
  return getJSON('/api/people', fetchImpl ? { fetchImpl } : undefined);
}

export function fetchSessionOwner(id, fetchImpl) {
  return getJSON(
    '/api/session-owner?id=' + encodeURIComponent(id),
    fetchImpl ? { fetchImpl } : undefined,
  );
}

export function viewCookieString(view) {
  const v = encodeURIComponent(view || VIEW_MINE);
  return `${VIEW_COOKIE}=${v}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function setView(view, doc = globalThis.document) {
  if (doc) doc.cookie = viewCookieString(view);
}

export function shortName(login = '') {
  const l = String(login).toLowerCase();
  const i = l.indexOf('@');
  return i > 0 ? l.slice(0, i) : l;
}

export function displayName(person) {
  if (!person) return '';
  const short = person.short || shortName(person.login);
  if (person.name && person.name.toLowerCase() !== short) return person.name;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

// viewLabel returns the switcher button text for the current view.
export function viewLabel(view, data) {
  const me = data?.me;
  if (!view || view === VIEW_MINE || (me?.login && view === me.login)) return 'Minhas conversas';
  if (view === VIEW_ALL) return 'Todas as pessoas';
  if (view === VIEW_UNASSIGNED) return 'Sem dono';
  const p = (data?.people || []).find((x) => x.login === view || x.short === shortName(view));
  return 'Conversas de ' + displayName(p || { login: view });
}

// isOthersView reports whether the sidebar shows someone else's sessions.
export function isOthersView(view, data) {
  if (!view || view === VIEW_MINE) return false;
  const me = data?.me;
  return !(me?.login && (view === me.login || shortName(view) === me.short));
}
