import { describe, it, expect } from 'vitest';
import {
  isRpcMode,
  buildAwaitingResult,
  extractToolNames,
  findPiWebOverlaps,
  buildSteeringNote,
  redirectTwin,
  OWN_PI_WEB_TOOLS,
} from '../../.pi/extensions/pi-ask.ts';

describe('isRpcMode', () => {
  it('detects `--mode rpc`', () => {
    expect(isRpcMode(['pi', '--mode', 'rpc'])).toBe(true);
  });

  it('detects `--mode=rpc`', () => {
    expect(isRpcMode(['pi', '--mode=rpc'])).toBe(true);
  });

  it('is false for interactive (no mode flag)', () => {
    expect(isRpcMode(['pi'])).toBe(false);
  });

  it('is false for other modes', () => {
    expect(isRpcMode(['pi', '--mode', 'json'])).toBe(false);
    expect(isRpcMode(['pi', '-p'])).toBe(false);
  });

  it('does not treat an `rpc` value of an unrelated flag as rpc mode', () => {
    expect(isRpcMode(['pi', '--name', 'rpc'])).toBe(false);
  });
});

describe('buildAwaitingResult', () => {
  it('marks the result as awaiting a chat reply with the question count', () => {
    const result = buildAwaitingResult([
      { question: 'Pick a color', options: [{ label: 'Red' }, { label: 'Blue' }] },
      { question: 'Pick a size', options: [{ label: 'S' }, { label: 'L' }] },
    ]);
    expect(result.details.awaitingChatReply).toBe(true);
    expect(result.details.questionCount).toBe(2);
    expect(result.content[0].type).toBe('text');
  });

  it('tells the model to stop and wait for the user message', () => {
    const text = buildAwaitingResult([{ question: 'Proceed?', options: [] }]).content[0].text;
    expect(text).toContain('Stop now');
    expect(text).toContain('"Question" = "Answer"');
    expect(text).toContain('Proceed?');
  });

  it('handles a missing/blank question with a positional fallback', () => {
    const text = buildAwaitingResult([{ options: [] }]).content[0].text;
    expect(text).toContain('Question 1');
  });

  it('tolerates non-array input', () => {
    const result = buildAwaitingResult(undefined as unknown as []);
    expect(result.details.questionCount).toBe(0);
  });
});

describe('extractToolNames', () => {
  it('reads an array of name strings', () => {
    expect(extractToolNames(['bash', 'ask_user_question'])).toEqual([
      'bash',
      'ask_user_question',
    ]);
  });

  it('reads tool-definition objects (name/toolName/id)', () => {
    expect(
      extractToolNames([{ name: 'bash' }, { toolName: 'read' }, { id: 'write' }]),
    ).toEqual(['bash', 'read', 'write']);
  });

  it('returns [] for non-arrays', () => {
    expect(extractToolNames(undefined)).toEqual([]);
    expect(extractToolNames(null)).toEqual([]);
    expect(extractToolNames('bash')).toEqual([]);
  });
});

describe('findPiWebOverlaps', () => {
  it('finds bare names whose pi_web_ twin is also active', () => {
    const overlaps = findPiWebOverlaps([
      'ask_user_question',
      'pi_web_ask_user_question',
      'bash',
    ]);
    expect(overlaps).toEqual(['ask_user_question']);
  });

  it('treats our own registered tools as twins even if not in the active list', () => {
    // ghoseb's bare tool active, but pi_web twin only known via OWN_PI_WEB_TOOLS
    expect(findPiWebOverlaps(['ask_user_question'])).toEqual([
      'ask_user_question',
    ]);
    expect(OWN_PI_WEB_TOOLS).toContain('pi_web_ask_user_question');
  });

  it('returns [] when there is no overlap', () => {
    expect(findPiWebOverlaps(['bash', 'read', 'pi_web_set_tab_title'])).toEqual([]);
  });
});

describe('buildSteeringNote', () => {
  it('names the affected tools and directs to the prefixed twin', () => {
    const note = buildSteeringNote(['ask_user_question']);
    expect(note).toContain('"ask_user_question" -> "pi_web_ask_user_question"');
    expect(note).toContain('not supported');
  });
});

describe('redirectTwin', () => {
  const tools = new Set(['pi_web_ask_user_question']);

  it('redirects a bare call whose twin is registered', () => {
    expect(redirectTwin('ask_user_question', tools)).toBe('pi_web_ask_user_question');
  });

  it('does not redirect the prefixed tool itself', () => {
    expect(redirectTwin('pi_web_ask_user_question', tools)).toBeNull();
  });

  it('does not redirect tools without a registered twin', () => {
    expect(redirectTwin('bash', tools)).toBeNull();
  });

  it('tolerates non-string input', () => {
    expect(redirectTwin(undefined, tools)).toBeNull();
  });
});
