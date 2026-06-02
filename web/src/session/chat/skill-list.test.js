import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractSkills, isSkillTrigger, renderSkillList, setupSkillList } from './skill-list.js';

describe('skill-list pure helpers', () => {
  it('detects the /skill trigger only on exact match', () => {
    expect(isSkillTrigger('/skill')).toBe(true);
    expect(isSkillTrigger('  /skill  ')).toBe(true);
    expect(isSkillTrigger('/skills')).toBe(false);
    expect(isSkillTrigger('/skill foo')).toBe(false);
    expect(isSkillTrigger('hello')).toBe(false);
  });

  it('filters skills and strips the skill: prefix', () => {
    const skills = extractSkills([
      { name: 'skill:foo', description: 'Foo', source: 'skill' },
      { name: 'my-ext', description: 'Ext', source: 'extension' },
      { name: 'my-prompt', description: 'P', source: 'prompt' },
      { name: 'skill:bar', description: '', source: 'skill' },
    ]);
    expect(skills).toEqual([
      { name: 'skill:foo', displayName: 'foo', description: 'Foo' },
      { name: 'skill:bar', displayName: 'bar', description: '' },
    ]);
  });

  it('renders states for not-ready, empty, and populated', () => {
    const notReady = renderSkillList([], { workerReady: false });
    expect(notReady).toContain('Load skills');
    expect(notReady).toContain('pi-chat-skill-load');
    expect(renderSkillList([], { workerReady: true })).toContain('No skills loaded');
    const html = renderSkillList([{ name: 'skill:foo', displayName: 'foo', description: 'Foo skill' }], { workerReady: true });
    expect(html).toContain('foo');
    expect(html).toContain('Foo skill');
    expect(html).toContain('data-skill="skill:foo"');
  });
});

describe('setupSkillList controller', () => {
  let popup;
  let list;
  let textarea;
  let documentImpl;

  beforeEach(() => {
    popup = { style: { display: 'none' }, contains: () => false };
    list = { innerHTML: '' };
    textarea = {};
    documentImpl = {
      getElementById: (id) => ({
        'pi-chat-skill-popup': popup,
        'pi-chat-skill-list': list,
        'pi-chat-message': textarea,
      }[id] || null),
      addEventListener: () => {},
    };
  });

  it('fetches and shows skills when input is /skill', async () => {
    const chatApi = {
      getCommands: vi.fn(() => Promise.resolve(new Response(
        JSON.stringify({ workerReady: true, commands: [{ name: 'skill:foo', description: 'Foo', source: 'skill' }] }),
        { status: 200 }
      ))),
    };
    const api = setupSkillList({ documentImpl, sessionId: 's.jsonl', chatApi });
    await api.maybeShow('/skill');
    expect(chatApi.getCommands).toHaveBeenCalledWith('s.jsonl', { load: false });
    expect(popup.style.display).toBe('block');
    expect(list.innerHTML).toContain('foo');
  });

  it('hides without fetching when input is not /skill', async () => {
    const chatApi = { getCommands: vi.fn() };
    const api = setupSkillList({ documentImpl, sessionId: 's.jsonl', chatApi });
    await api.maybeShow('hello world');
    expect(chatApi.getCommands).not.toHaveBeenCalled();
    expect(popup.style.display).toBe('none');
  });

  it('shows a load button when the worker is not ready', async () => {
    const chatApi = {
      getCommands: vi.fn(() => Promise.resolve(new Response(
        JSON.stringify({ workerReady: false, commands: [] }),
        { status: 200 }
      ))),
    };
    const api = setupSkillList({ documentImpl, sessionId: 's.jsonl', chatApi });
    await api.maybeShow('/skill');
    expect(chatApi.getCommands).toHaveBeenCalledWith('s.jsonl', { load: false });
    expect(list.innerHTML).toContain('Load skills');
  });

  it('load() requests a spawn and renders the skills', async () => {
    const chatApi = {
      getCommands: vi.fn(() => Promise.resolve(new Response(
        JSON.stringify({ workerReady: true, commands: [{ name: 'skill:bar', description: 'Bar', source: 'skill' }] }),
        { status: 200 }
      ))),
    };
    const api = setupSkillList({ documentImpl, sessionId: 's.jsonl', chatApi });
    await api.load();
    expect(chatApi.getCommands).toHaveBeenCalledWith('s.jsonl', { load: true });
    expect(popup.style.display).toBe('block');
    expect(list.innerHTML).toContain('bar');
  });

  it('insertSkill writes the slash invocation and closes the popup', () => {
    popup.style.display = 'block';
    const api = setupSkillList({ documentImpl, sessionId: 's.jsonl', chatApi: {} });
    api.insertSkill('skill:memory');
    expect(textarea.value).toBe('/skill:memory ');
    expect(popup.style.display).toBe('none');
  });
});
