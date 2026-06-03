import { describe, expect, it, vi } from 'vitest';
import {
  filterCommands,
  groupCommands,
  isPaletteCommand,
  parseSlashTrigger,
  renderCommandList,
  setupSlashCommands,
} from './slash-command.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const SAMPLE = [
  { name: 'btw', description: 'side chat', source: 'extension' },
  { name: 'workon', description: 'start a task', source: 'prompt' },
  { name: 'skill:memory', description: 'project memory', source: 'skill' },
];

describe('parseSlashTrigger', () => {
  it('triggers when the message starts with a slash', () => {
    expect(parseSlashTrigger('/', 1)).toEqual({ query: '', start: 0, end: 1 });
    expect(parseSlashTrigger('/sk', 3)).toEqual({ query: 'sk', start: 0, end: 3 });
    expect(parseSlashTrigger('/skill:m', 8)).toEqual({ query: 'skill:m', start: 0, end: 8 });
  });

  it('closes once the caret moves past the command token', () => {
    expect(parseSlashTrigger('/skill foo', 10)).toBeNull();
    expect(parseSlashTrigger('/skill ', 7)).toBeNull();
  });

  it('does not trigger for a slash that is not at the start', () => {
    expect(parseSlashTrigger('hello /skill', 12)).toBeNull();
    expect(parseSlashTrigger('src/foo', 7)).toBeNull();
    expect(parseSlashTrigger('', 0)).toBeNull();
  });
});

describe('isPaletteCommand', () => {
  it('keeps prompt and skill commands, drops extensions', () => {
    expect(isPaletteCommand({ source: 'prompt' })).toBe(true);
    expect(isPaletteCommand({ source: 'skill' })).toBe(true);
    expect(isPaletteCommand({ source: 'extension' })).toBe(false);
    expect(isPaletteCommand({ source: 'mystery' })).toBe(false);
    expect(isPaletteCommand(null)).toBe(false);
  });
});

describe('filterCommands', () => {
  it('returns all commands for an empty query', () => {
    expect(filterCommands(SAMPLE, '')).toHaveLength(3);
  });

  it('matches case-insensitive substrings of the name', () => {
    expect(filterCommands(SAMPLE, 'SKILL').map((c) => c.name)).toEqual(['skill:memory']);
    expect(filterCommands(SAMPLE, 'wor').map((c) => c.name)).toEqual(['workon']);
  });
});

describe('groupCommands', () => {
  it('orders groups prompts, skills', () => {
    const groups = groupCommands([
      { name: 'skill:memory', source: 'skill' },
      { name: 'workon', source: 'prompt' },
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Prompts', 'Skills']);
  });

  it('drops empty groups and buckets unknown sources into Other', () => {
    const groups = groupCommands([
      { name: 'x', source: 'skill' },
      { name: 'y', source: 'mystery' },
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Skills', 'Other']);
  });
});

describe('renderCommandList', () => {
  it('renders a loading state', () => {
    expect(renderCommandList([], { loading: true })).toContain('Loading');
  });

  it('renders an empty state when nothing matches', () => {
    expect(renderCommandList(SAMPLE, { query: 'zzz' })).toContain('No commands match');
  });

  it('renders group headers and insertable items', () => {
    const html = renderCommandList(SAMPLE, { query: '' });
    expect(html).toContain('data-insert="skill:memory"');
    expect(html).toContain('/skill:memory');
    expect(html).toContain('project memory');
    expect(html).toContain('Prompts');
  });

  it('escapes command fields', () => {
    const html = renderCommandList([{ name: 'x', description: '<b>', source: 'skill' }], {
      query: '',
      escapeHtml: (s) => String(s).replace('<', '&lt;'),
    });
    expect(html).toContain('&lt;b>');
  });
});

function createDom() {
  const div = document.createElement('div');
  div.innerHTML = `
    <textarea id="pi-chat-message"></textarea>
    <div id="pi-chat-slash-popup" style="display:none">
      <div id="pi-chat-slash-list"></div>
    </div>
  `;
  document.body.appendChild(div);
  return div;
}

function typeSlash(textarea, value) {
  textarea.value = value;
  textarea.selectionStart = value.length;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('setupSlashCommands controller', () => {
  function setup() {
    const el = createDom();
    const getCommands = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ commands: SAMPLE }) })
    );
    const api = setupSlashCommands({ documentImpl: document, sessionId: 's', chatApi: { getCommands } });
    return { el, api, getCommands, textarea: document.getElementById('pi-chat-message'), popup: document.getElementById('pi-chat-slash-popup') };
  }

  it('opens the palette and loads commands when a slash is typed', async () => {
    const { el, getCommands, textarea, popup } = setup();
    typeSlash(textarea, '/');
    expect(popup.style.display).toBe('block');
    await flush();
    expect(getCommands).toHaveBeenCalledWith('s', { load: true });
    // btw is an extension command and must be filtered out: only the prompt
    // and skill commands run an agent turn and reach the palette.
    const items = document.querySelectorAll('.slash-item');
    expect(items).toHaveLength(2);
    expect([...items].some((el) => el.dataset.insert === 'btw')).toBe(false);
    el.remove();
  });

  it('filters the list as the query narrows', async () => {
    const { el, textarea } = setup();
    typeSlash(textarea, '/sk');
    await flush();
    const items = document.querySelectorAll('.slash-item');
    expect(items).toHaveLength(1);
    expect(items[0].dataset.insert).toBe('skill:memory');
    el.remove();
  });

  it('closes when the message no longer starts with a slash', async () => {
    const { el, textarea, popup } = setup();
    typeSlash(textarea, '/');
    await flush();
    typeSlash(textarea, 'hello');
    expect(popup.style.display).toBe('none');
    el.remove();
  });

  it('navigates with arrow keys', async () => {
    const { el, api, textarea } = setup();
    typeSlash(textarea, '/');
    await flush();
    expect(api.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(true);
    const items = document.querySelectorAll('.slash-item');
    expect(items[1].classList.contains('active')).toBe(true);
    el.remove();
  });

  it('inserts the selected command on Enter', async () => {
    const { el, api, textarea, popup } = setup();
    typeSlash(textarea, '/sk');
    await flush();
    const consumed = api.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(consumed).toBe(true);
    expect(textarea.value).toBe('/skill:memory ');
    expect(popup.style.display).toBe('none');
    el.remove();
  });

  it('closes on Escape', async () => {
    const { el, api, textarea, popup } = setup();
    typeSlash(textarea, '/');
    await flush();
    expect(api.handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(true);
    expect(popup.style.display).toBe('none');
    el.remove();
  });

  it('ignores keys when the palette is closed', () => {
    const { el, api } = setup();
    expect(api.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
    el.remove();
  });
});
