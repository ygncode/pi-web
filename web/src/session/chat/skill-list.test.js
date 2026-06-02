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
    expect(renderSkillList([], { workerReady: false })).toContain('Send a message first');
    expect(renderSkillList([], { workerReady: true })).toContain('No skills loaded');
    const html = renderSkillList([{ displayName: 'foo', description: 'Foo skill' }], { workerReady: true });
    expect(html).toContain('foo');
    expect(html).toContain('Foo skill');
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
    expect(chatApi.getCommands).toHaveBeenCalledWith('s.jsonl');
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

  it('shows a hint when the worker is not ready', async () => {
    const chatApi = {
      getCommands: vi.fn(() => Promise.resolve(new Response(
        JSON.stringify({ workerReady: false, commands: [] }),
        { status: 200 }
      ))),
    };
    const api = setupSkillList({ documentImpl, sessionId: 's.jsonl', chatApi });
    await api.maybeShow('/skill');
    expect(list.innerHTML).toContain('Send a message first');
  });
});
