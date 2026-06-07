import { escapeHtml } from './escape.js';
import { t } from './i18n.js';

let active = null;

export function registerVersionController(controller) {
  active = controller || null;
  return () => {
    if (active === controller) active = null;
  };
}

export function openVersionModal() {
  active?.openModal?.();
}

export function renderChangelog(markdown) {
  if (!markdown) return `<p class="version-changelog-empty">${escapeHtml(t('version.noReleaseNotes'))}</p>`;
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (heading) {
      closeList();
      out.push(`<h4>${inline(heading[1])}</h4>`);
    } else if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else if (line === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('');
}

function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  return s;
}

export function stripV(v) {
  return String(v || '').replace(/^v/, '');
}

export function cleanVersion(v) {
  const s = stripV(v);
  return s ? 'v' + s : '';
}

export function shortVersion(v) {
  const base = stripV(v)
    .replace(/-\d+-g[0-9a-f]{7,}.*$/, '')
    .replace(/-dirty$/, '');
  return base ? 'v' + base : '';
}

export function versionLabel(info) {
  if (!info || !info.current) return '…';
  if (info.hasUpdate && info.latest) return `${shortVersion(info.current)} → ${shortVersion(info.latest)}`;
  return shortVersion(info.current);
}

export async function fetchVersionInfo({ fetchImpl = fetch, force = false } = {}) {
  const url = force ? '/api/check-update' : '/api/version';
  const res = await fetchImpl(url, {
    method: force ? 'POST' : 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
