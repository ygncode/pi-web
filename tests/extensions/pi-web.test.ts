import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';

// Mock node:fs before importing the module under test
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    chmodSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn((path: string, content: string, options?: unknown) => {
      const tokenEnvPath = `${homedir()}/.config/pi-web/env`;
      if (typeof path === 'string' && path === tokenEnvPath) {
        (globalThis as any).__MOCK_PI_WEB_ENV_CONTENT__ = content;
        return undefined;
      }
      return (actual as any).writeFileSync(path, content, options);
    }),
    readFileSync: vi.fn((path: string, encoding: BufferEncoding) => {
      // Delegate to actual unless it's the token env file
      const tokenEnvPath = `${homedir()}/.config/pi-web/env`;
      if (typeof path === 'string' && path === tokenEnvPath) {
        const content = (globalThis as any).__MOCK_PI_WEB_ENV_CONTENT__;
        if (content !== undefined) return content;
        const token = (globalThis as any).__MOCK_PI_WEB_TOKEN__;
        if (token === undefined) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        if (token === null) return '';
        return `PI_WEB_TOKEN=${token}\n`;
      }
      return (actual as any).readFileSync(path, encoding);
    }),
  };
});

import piWebExtension, {
  isTailscaleHost,
  isSSH,
  normalizeCommandArgs,
  titleCaseWord,
  deriveTitleFromInput,
  TITLE_WORD_LIMIT,
  TITLE_STOP_WORDS,
  withToken,
  readPiWebToken,
  writePiWebToken,
} from '../../.pi/extensions/pi-web.ts';

declare global {
  var __MOCK_PI_WEB_TOKEN__: string | null | undefined;
  var __MOCK_PI_WEB_ENV_CONTENT__: string | undefined;
}

function createExtensionHarness() {
  const tools = new Map<string, any>();
  const handlers = new Map<string, Function[]>();
  const pi = {
    registerTool: vi.fn((tool: any) => tools.set(tool.name, tool)),
    registerCommand: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    setSessionName: vi.fn(),
    exec: vi.fn(),
  };

  piWebExtension(pi as any);

  const ctx = {
    hasUI: true,
    ui: {
      setTitle: vi.fn(),
      notify: vi.fn(),
    },
    sessionManager: {
      getSessionFile: vi.fn(() => '/tmp/pi-session.jsonl'),
    },
  };

  return { pi, ctx, tools, handlers };
}

// ── isSSH ───────────────────────────────────────────────────────────
describe('isSSH', () => {
  const orig = { ...process.env };

  beforeEach(() => {
    delete process.env.SSH_TTY;
    delete process.env.SSH_CONNECTION;
    delete process.env.SSH_CLIENT;
  });

  afterEach(() => {
    process.env = { ...orig };
  });

  it('returns false when no SSH env vars are set', () => {
    expect(isSSH()).toBe(false);
  });

  it('returns true when SSH_TTY is set', () => {
    process.env.SSH_TTY = '/dev/pts/0';
    expect(isSSH()).toBe(true);
  });

  it('returns true when SSH_CONNECTION is set', () => {
    process.env.SSH_CONNECTION = '192.168.1.1 1234 10.0.0.1 22';
    expect(isSSH()).toBe(true);
  });

  it('returns true when SSH_CLIENT is set', () => {
    process.env.SSH_CLIENT = '192.168.1.1 1234 22';
    expect(isSSH()).toBe(true);
  });
});

// ── isTailscaleHost ─────────────────────────────────────────────────
describe('isTailscaleHost', () => {
  it('detects Tailscale IPv4 CGNAT range', () => {
    expect(isTailscaleHost('100.64.0.1')).toBe(true);
    expect(isTailscaleHost('100.100.50.25')).toBe(true);
    expect(isTailscaleHost('100.127.255.254')).toBe(true);
  });

  it('rejects non-Tailscale IPv4 addresses', () => {
    expect(isTailscaleHost('127.0.0.1')).toBe(false);
    expect(isTailscaleHost('192.168.1.1')).toBe(false);
    expect(isTailscaleHost('10.0.0.1')).toBe(false);
    expect(isTailscaleHost('100.63.255.255')).toBe(false);
    expect(isTailscaleHost('100.128.0.0')).toBe(false);
  });

  it('rejects IPv6 addresses (only checks first : segment)', () => {
    // isTailscaleHost splits on ':' so IPv6 host:port strings like
    // '[fd7a:115c:a1e0::1]:31415' would have the '[' bracket as ip.
    // Pure IPv6 without brackets/port is not the expected input.
    expect(isTailscaleHost('::1')).toBe(false);
    expect(isTailscaleHost('fe80::1')).toBe(false);
  });
});

// ── normalizeCommandArgs ────────────────────────────────────────────
describe('normalizeCommandArgs', () => {
  it('returns empty for undefined', () => {
    expect(normalizeCommandArgs(undefined)).toEqual([]);
  });

  it('returns empty for empty string', () => {
    expect(normalizeCommandArgs('')).toEqual([]);
  });

  it('returns empty for whitespace string', () => {
    expect(normalizeCommandArgs('   ')).toEqual([]);
  });

  it('splits a string into words', () => {
    expect(normalizeCommandArgs('hello world')).toEqual(['hello', 'world']);
  });

  it('handles array input', () => {
    expect(normalizeCommandArgs(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('converts numbers to strings', () => {
    expect(normalizeCommandArgs([1, 2])).toEqual(['1', '2']);
  });

  it('set-token destructure: [, token] from [subcommand, token]', () => {
    const [, token] = normalizeCommandArgs('set-token my-secret');
    expect(token).toBe('my-secret');
  });

  it('set-token destructure: token with special chars', () => {
    const [, token] = normalizeCommandArgs('set-token sec=ret&val');
    expect(token).toBe('sec=ret&val');
  });
});

// ── titleCaseWord ───────────────────────────────────────────────────
describe('titleCaseWord', () => {
  it('preserves known acronyms', () => {
    expect(titleCaseWord('pi')).toBe('Pi');
    expect(titleCaseWord('pi-web')).toBe('Pi-Web');
    expect(titleCaseWord('api')).toBe('API');
    expect(titleCaseWord('ui')).toBe('UI');
    expect(titleCaseWord('ux')).toBe('UX');
    expect(titleCaseWord('sse')).toBe('SSE');
    expect(titleCaseWord('rpc')).toBe('RPC');
    expect(titleCaseWord('tui')).toBe('TUI');
  });

  it('title-cases regular words', () => {
    expect(titleCaseWord('hello')).toBe('Hello');
    expect(titleCaseWord('WORLD')).toBe('World');
    expect(titleCaseWord('foo-bar')).toBe('Foo-Bar');
  });

  it('handles empty string', () => {
    expect(titleCaseWord('')).toBe('');
  });
});

// ── deriveTitleFromInput ────────────────────────────────────────────
describe('deriveTitleFromInput', () => {
  it('returns null for empty input', () => {
    expect(deriveTitleFromInput('')).toBeNull();
    expect(deriveTitleFromInput('   ')).toBeNull();
  });

  it('falls back to stop words when they are the only words', () => {
    // When all words are stop words, falls back to original words
    expect(deriveTitleFromInput('the and for')).toBe('The And For');
  });

  it('returns title from meaningful words', () => {
    expect(deriveTitleFromInput('add a new feature for the dashboard')).toBe(
      'Add New Feature Dashboard',
    );
  });

  it('caps at TITLE_WORD_LIMIT words', () => {
    const long = 'one two three four five six seven eight';
    expect(
      deriveTitleFromInput(long)?.split(' ').length,
    ).toBeLessThanOrEqual(TITLE_WORD_LIMIT);
  });

  it('strips code blocks', () => {
    expect(deriveTitleFromInput('fix ```js\nconst x = 1;\n``` bug')).toBe(
      'Fix Bug',
    );
  });

  it('strips URLs', () => {
    expect(
      deriveTitleFromInput('check https://example.com/foo for updates'),
    ).toBe('Check Updates');
  });
});

// ── pi_web_set_tab_title tool ───────────────────────────────────────
describe('pi_web_set_tab_title tool', () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
    vi.restoreAllMocks();
  });

  it('keeps the default synchronous response shape', async () => {
    delete process.env.PI_WEB_BACKGROUND_TAB_TITLE;
    const { pi, ctx, tools } = createExtensionHarness();
    const tool = tools.get('pi_web_set_tab_title');

    expect(tool).toBeDefined();
    const result = await tool.execute(
      'call-1',
      { title: ' Test Session ' },
      undefined,
      undefined,
      ctx,
    );

    expect(ctx.ui.setTitle).toHaveBeenCalledWith('Test Session');
    expect(pi.setSessionName).toHaveBeenCalledWith('Test Session');
    expect(ctx.ui.notify).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Session title set to Test Session.' }],
      details: { title: 'Test Session' },
    });
  });

  it('queues title updates when PI_WEB_BACKGROUND_TAB_TITLE is set', async () => {
    process.env.PI_WEB_BACKGROUND_TAB_TITLE = '1';
    const { pi, ctx, tools } = createExtensionHarness();
    const tool = tools.get('pi_web_set_tab_title');

    expect(tool).toBeDefined();
    const result = await tool.execute(
      'call-1',
      { title: 'Background Session' },
      undefined,
      undefined,
      ctx,
    );

    expect(ctx.ui.setTitle).toHaveBeenCalledWith('Background Session');
    expect(pi.setSessionName).toHaveBeenCalledWith('Background Session');
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      'Session title set to Background Session.',
      'info',
    );
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Session title update queued.' }],
      details: { queued: true, title: 'Background Session' },
    });
  });
});

// ── withToken / readPiWebToken ──────────────────────────────────────
describe('token helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as any).__MOCK_PI_WEB_TOKEN__;
    delete (globalThis as any).__MOCK_PI_WEB_ENV_CONTENT__;
  });

  it('withToken appends token when available', () => {
    (globalThis as any).__MOCK_PI_WEB_TOKEN__ = 'my-token';

    expect(withToken('http://127.0.0.1:31415/session?id=abc')).toBe(
      'http://127.0.0.1:31415/session?id=abc&token=my-token',
    );
  });

  it('withToken adds token with ? when no existing query', () => {
    (globalThis as any).__MOCK_PI_WEB_TOKEN__ = 'my-token';

    expect(withToken('http://127.0.0.1:31415')).toBe(
      'http://127.0.0.1:31415?token=my-token',
    );
  });

  it('withToken returns URL unchanged when no token file', () => {
    // No mock set → ENOENT → no token
    (globalThis as any).__MOCK_PI_WEB_TOKEN__ = undefined;

    expect(withToken('http://127.0.0.1:31415/session?id=abc')).toBe(
      'http://127.0.0.1:31415/session?id=abc',
    );
  });

  it('withToken returns URL unchanged when env file has no token', () => {
    (globalThis as any).__MOCK_PI_WEB_TOKEN__ = null; // file exists but no token line

    expect(withToken('http://127.0.0.1:31415/session?id=abc')).toBe(
      'http://127.0.0.1:31415/session?id=abc',
    );
  });

  it('withToken URL-encodes the token value', () => {
    (globalThis as any).__MOCK_PI_WEB_TOKEN__ = 'tok en=val&ue';

    expect(withToken('http://127.0.0.1:31415')).toBe(
      'http://127.0.0.1:31415?token=tok%20en%3Dval%26ue',
    );
  });

  it('readPiWebToken reads token from env file', () => {
    (globalThis as any).__MOCK_PI_WEB_TOKEN__ = 'secret-123';

    expect(readPiWebToken()).toBe('secret-123');
  });

  it('readPiWebToken returns null when file does not exist', () => {
    (globalThis as any).__MOCK_PI_WEB_TOKEN__ = undefined;

    expect(readPiWebToken()).toBeNull();
  });

  it('readPiWebToken prefers process.env over env file', () => {
    process.env['PI_WEB_TOKEN'] = 'from-env';
    (globalThis as any).__MOCK_PI_WEB_TOKEN__ = 'from-file';

    expect(readPiWebToken()).toBe('from-env');

    delete process.env['PI_WEB_TOKEN'];
  });

  it('readPiWebToken returns token from env var even when no file exists', () => {
    process.env['PI_WEB_TOKEN'] = 'env-only';
    (globalThis as any).__MOCK_PI_WEB_TOKEN__ = undefined;

    expect(readPiWebToken()).toBe('env-only');

    delete process.env['PI_WEB_TOKEN'];
  });

  it('writePiWebToken creates a private env file and directory', () => {
    const path = `${homedir()}/.config/pi-web/env`;

    writePiWebToken('secret-123');

    expect(mkdirSync).toHaveBeenCalledWith(dirname(path), { recursive: true });
    expect(chmodSync).toHaveBeenCalledWith(dirname(path), 0o700);
    expect(writeFileSync).toHaveBeenCalledWith(path, 'PI_WEB_TOKEN=secret-123\n', {
      mode: 0o600,
    });
    expect(chmodSync).toHaveBeenCalledWith(path, 0o600);
  });
});
