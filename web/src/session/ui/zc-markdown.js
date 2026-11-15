// zcode-style chrome for rendered markdown: tables and code blocks become
// rounded cards with copy / download / expand buttons. The HTML comes from
// safeMarkedParse (raw HTML in markdown is disabled), so literal <table> and
// <pre> tags can only originate from the renderer itself.
import { icon, Copy, Download, Maximize2, Check } from '../../shared/icons.js';
import { copyToClipboard } from '../../shared/clipboard.js';

const btn = (action, title, node) =>
  `<button type="button" class="zc-mdbtn" data-zc-md="${action}" title="${title}" aria-label="${title}">${icon(node, { size: 14 })}</button>`;

const TABLE_BAR =
  '<div class="zc-mdbar">' +
  btn('copy', 'Copiar tabela', Copy) +
  btn('csv', 'Baixar CSV', Download) +
  btn('expand', 'Expandir', Maximize2) +
  '</div>';
const CODE_BAR = '<div class="zc-mdbar zc-mdbar-code">' + btn('copy', 'Copiar código', Copy) + '</div>';

export function enhanceMarkdownHtml(html) {
  if (typeof html !== 'string') return html;
  // a paragraph that is only a bold label ending in ':' ("Em português simples:")
  // reads as a sub-heading, like zcode's green section labels.
  if (html.includes('<p><strong>'))
    html = html.replace(/<p><strong>([^<]{1,80}:)<\/strong><\/p>/g, '<p class="zc-lead"><strong>$1</strong></p>');
  if (!html.includes('<table') && !html.includes('<pre')) return html;
  return html
    .replace(/<table>/g, `<div class="zc-table">${TABLE_BAR}<div class="zc-table-scroll"><table>`)
    .replace(/<\/table>/g, '</table></div></div>')
    .replace(/<pre>/g, `<div class="zc-code">${CODE_BAR}<pre>`)
    .replace(/<\/pre>/g, '</pre></div>');
}

function tableRows(table) {
  return [...table.querySelectorAll('tr')].map((tr) =>
    [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
  );
}

function toMarkdown(rows) {
  if (!rows.length) return '';
  const line = (r) => '| ' + r.map((c) => c.replace(/\|/g, '\\|')).join(' | ') + ' |';
  return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n');
}

function toCsv(rows) {
  return rows
    .map((r) => r.map((c) => (/[",\n;]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\n');
}

function flash(button) {
  const prev = button.innerHTML;
  button.innerHTML = icon(Check, { size: 14 });
  button.classList.add('zc-ok');
  setTimeout(() => {
    button.innerHTML = prev;
    button.classList.remove('zc-ok');
  }, 1200);
}

let installed = false;
export function installMarkdownActions(doc = typeof document !== 'undefined' ? document : null) {
  if (installed || !doc) return;
  installed = true;
  doc.addEventListener('click', async (e) => {
    const button = e.target?.closest?.('[data-zc-md]');
    if (!button) return;
    e.preventDefault();
    e.stopPropagation();
    const action = button.dataset.zcMd;
    const table = button.closest('.zc-table');
    const code = button.closest('.zc-code');
    if (table) {
      const t = table.querySelector('table');
      const rows = t ? tableRows(t) : [];
      if (action === 'copy') {
        if (await copyToClipboard(toMarkdown(rows))) flash(button);
      } else if (action === 'csv') {
        const blob = new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
        const a = doc.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'tabela.csv';
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } else if (action === 'expand') {
        table.classList.toggle('zc-expanded');
        doc.documentElement.classList.toggle('zc-has-expanded', !!doc.querySelector('.zc-table.zc-expanded'));
      }
    } else if (code && action === 'copy') {
      const pre = code.querySelector('pre');
      if (pre && (await copyToClipboard(pre.innerText.replace(/\n$/, '')))) flash(button);
    }
  });
  doc.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    doc.querySelectorAll('.zc-table.zc-expanded').forEach((t) => t.classList.remove('zc-expanded'));
    doc.documentElement.classList.remove('zc-has-expanded');
  });
}

installMarkdownActions();
