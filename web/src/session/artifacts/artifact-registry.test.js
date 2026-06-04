import { describe, expect, it } from 'vitest';
import { collectArtifacts, __test__ } from './artifact-registry.js';

function assistant(id, content) {
  return { id, type: 'message', message: { role: 'assistant', content } };
}
function writeCall(callId, file_path, content) {
  return { type: 'toolCall', id: callId, name: 'write', arguments: { file_path, content } };
}
function editCall(callId, path, edits) {
  return { type: 'toolCall', id: callId, name: 'edit', arguments: { path, edits } };
}
function bashCall(callId, command) {
  return { type: 'toolCall', id: callId, name: 'bash', arguments: { command } };
}
function toolResult(callId, isError = false) {
  return { id: `r-${callId}`, type: 'message', message: { role: 'toolResult', toolCallId: callId, isError, content: [] } };
}
function text(t) {
  return { type: 'text', text: t };
}

describe('collectArtifacts — write tool calls', () => {
  it('captures a written file as a code artifact', () => {
    const entries = [assistant('e1', [writeCall('c1', 'src/util.go', 'package main\n')])];
    const [a] = collectArtifacts(entries);
    expect(a).toMatchObject({
      id: 'art-c1', kind: 'code', title: 'util.go', lang: 'go',
      content: 'package main\n', filePath: 'src/util.go',
      entryId: 'e1', anchorId: 'entry-e1', source: 'write'
    });
  });

  it('marks .html and .svg writes as preview kind', () => {
    const entries = [
      assistant('e1', [writeCall('c1', 'page.html', '<h1>hi</h1>')]),
      assistant('e2', [writeCall('c2', 'icon.svg', '<svg></svg>')])
    ];
    const arts = collectArtifacts(entries);
    expect(arts.map(a => a.kind)).toEqual(['preview', 'preview']);
    expect(arts.map(a => a.previewType)).toEqual(['html', 'svg']);
  });

  it('marks markdown writes as a markdown-preview artifact', () => {
    const [a] = collectArtifacts([assistant('e1', [writeCall('c1', 'README.md', '# Title\n')])]);
    expect(a).toMatchObject({ kind: 'preview', previewType: 'markdown', lang: 'markdown' });
  });

  it('treats short markdown fenced blocks as previewable too', () => {
    const [a] = collectArtifacts([assistant('e1', [text('```md\n# Hi\n```')])]);
    expect(a).toMatchObject({ kind: 'preview', previewType: 'markdown' });
  });

  it('accepts path arg alias and ignores writes with non-string content', () => {
    const ok = collectArtifacts([assistant('e1', [{ type: 'toolCall', id: 'c1', name: 'write', arguments: { path: 'a.js', content: 'x' } }])]);
    expect(ok).toHaveLength(1);
    expect(ok[0].title).toBe('a.js');

    const bad = collectArtifacts([assistant('e2', [{ type: 'toolCall', id: 'c2', name: 'write', arguments: { file_path: 'a.js', content: { not: 'a string' } } }])]);
    expect(bad).toHaveLength(0);
  });

  it('ignores non-write tool calls', () => {
    const entries = [assistant('e1', [{ type: 'toolCall', id: 'c1', name: 'bash', arguments: { command: 'ls' } }])];
    expect(collectArtifacts(entries)).toHaveLength(0);
  });
});

describe('collectArtifacts — fenced code blocks', () => {
  it('captures previewable fenced blocks regardless of length', () => {
    const entries = [assistant('e1', [text('Here:\n\n```html\n<p>hi</p>\n```')])];
    const [a] = collectArtifacts(entries);
    expect(a).toMatchObject({ kind: 'preview', lang: 'html', source: 'fenced', anchorId: 'entry-e1' });
    expect(a.content).toBe('<p>hi</p>');
  });

  it('captures long code blocks but skips short non-previewable ones', () => {
    const short = '```js\na();\nb();\n```';
    const long = '```js\n' + Array.from({ length: 8 }, (_, i) => `line${i};`).join('\n') + '\n```';
    const arts = collectArtifacts([assistant('e1', [text(`${short}\n\n${long}`)])]);
    expect(arts).toHaveLength(1);
    expect(arts[0].lang).toBe('js');
    expect(arts[0].content.split('\n')).toHaveLength(8);
  });

  it('respects a custom minCodeBlockLines threshold', () => {
    const block = '```js\na;\nb;\n```';
    expect(collectArtifacts([assistant('e1', [text(block)])], { minCodeBlockLines: 2 })).toHaveLength(1);
    expect(collectArtifacts([assistant('e1', [text(block)])], { minCodeBlockLines: 3 })).toHaveLength(0);
  });

  it('handles ~~~ fences and tildes do not close backtick fences', () => {
    const blocks = __test__.fencedBlocks('~~~svg\n<svg/>\n~~~');
    expect([...blocks]).toEqual([{ lang: 'svg', content: '<svg/>' }]);
  });

  it('gives each artifact a stable distinct id and keeps document order', () => {
    const entries = [
      assistant('e1', [writeCall('c1', 'a.go', 'package a'), text('```html\n<i>x</i>\n```')])
    ];
    const arts = collectArtifacts(entries);
    expect(arts.map(a => a.id)).toEqual(['art-c1', 'art-e1-1-0']);
    expect(new Set(arts.map(a => a.id)).size).toBe(2);
  });
});

describe('collectArtifacts — path-keyed file state', () => {
  it('collapses repeated writes to the same path into one artifact (latest wins)', () => {
    const arts = collectArtifacts([
      assistant('e1', [writeCall('c1', 'a.md', 'v1')]),
      assistant('e2', [writeCall('c2', 'a.md', 'v2')])
    ]);
    expect(arts).toHaveLength(1);
    expect(arts[0]).toMatchObject({ id: 'art-c1', title: 'a.md', content: 'v2' });
  });

  it('folds edits into the current content', () => {
    const arts = collectArtifacts([
      assistant('e1', [writeCall('c1', 'hi.txt', 'hello world')]),
      assistant('e2', [editCall('c2', 'hi.txt', [{ oldText: 'world', newText: 'there' }])])
    ]);
    expect(arts).toHaveLength(1);
    expect(arts[0].content).toBe('hello there');
  });

  it('ignores edits to a file never written in-session', () => {
    const arts = collectArtifacts([
      assistant('e1', [editCall('c1', 'unknown.txt', [{ oldText: 'a', newText: 'b' }])])
    ]);
    expect(arts).toHaveLength(0);
  });

  it('renames an artifact on a successful mv (path, title, lang all update)', () => {
    const arts = collectArtifacts([
      assistant('e1', [writeCall('c1', 'daytrip.md', '# Trip')]),
      assistant('e2', [bashCall('c2', 'mv daytrip.md day-trip.md')]),
      toolResult('c2')
    ]);
    expect(arts).toHaveLength(1);
    expect(arts[0]).toMatchObject({ id: 'art-c1', title: 'day-trip.md', filePath: 'day-trip.md', content: '# Trip' });
  });

  it('handles git mv and mv into a directory', () => {
    const gitMv = collectArtifacts([
      assistant('e1', [writeCall('c1', 'a.go', 'x')]),
      assistant('e2', [bashCall('c2', 'git mv a.go b.go')]),
      toolResult('c2')
    ]);
    expect(gitMv[0].title).toBe('b.go');

    const intoDir = collectArtifacts([
      assistant('e1', [writeCall('c1', 'a.go', 'x')]),
      assistant('e2', [bashCall('c2', 'mv a.go src/')]),
      toolResult('c2')
    ]);
    expect(intoDir[0].filePath).toBe('src/a.go');
  });

  it('removes an artifact on a successful rm', () => {
    const arts = collectArtifacts([
      assistant('e1', [writeCall('c1', 'tmp.txt', 'junk')]),
      assistant('e2', [bashCall('c2', 'rm tmp.txt')]),
      toolResult('c2')
    ]);
    expect(arts).toHaveLength(0);
  });

  it('does NOT act on a failed mv', () => {
    const arts = collectArtifacts([
      assistant('e1', [writeCall('c1', 'a.md', 'x')]),
      assistant('e2', [bashCall('c2', 'mv a.md b.md')]),
      toolResult('c2', true) // isError
    ]);
    expect(arts[0].title).toBe('a.md'); // unchanged
  });

  it('leaves artifacts alone for shell it will not interpret', () => {
    const arts = collectArtifacts([
      assistant('e1', [writeCall('c1', 'a.md', 'x')]),
      assistant('e2', [bashCall('c2', 'mv a.md b.md && echo done')]),
      toolResult('c2')
    ]);
    expect(arts[0].title).toBe('a.md'); // unsafe (&&) → not parsed
  });

  it('tracks renames the user runs directly in the composer (bashExecution)', () => {
    const arts = collectArtifacts([
      assistant('e1', [writeCall('c1', 'a.md', 'x')]),
      { id: 'e2', type: 'message', message: { role: 'bashExecution', command: 'mv a.md b.md', exitCode: 0 } }
    ]);
    expect(arts[0].title).toBe('b.md');
  });
});

describe('parseFileOps', () => {
  const { parseFileOps } = __test__;
  it('recognizes plain mv / git mv / rm', () => {
    expect(parseFileOps('mv a b')).toEqual([{ op: 'mv', from: 'a', to: 'b' }]);
    expect(parseFileOps('git mv a b')).toEqual([{ op: 'mv', from: 'a', to: 'b' }]);
    expect(parseFileOps('rm a')).toEqual([{ op: 'rm', path: 'a' }]);
    expect(parseFileOps('rm -f a b')).toEqual([{ op: 'rm', path: 'a' }, { op: 'rm', path: 'b' }]);
  });
  it('honors quotes', () => {
    expect(parseFileOps('mv "a b.md" c.md')).toEqual([{ op: 'mv', from: 'a b.md', to: 'c.md' }]);
  });
  it('bails on shell features and unrelated commands', () => {
    expect(parseFileOps('mv a b | tee log')).toEqual([]);
    expect(parseFileOps('sed -i s/x/y/ a')).toEqual([]);
    expect(parseFileOps('ls -la')).toEqual([]);
    expect(parseFileOps('mv a b c')).toEqual([]); // ambiguous multi-src, non-dir dst
  });
});

describe('collectArtifacts — robustness', () => {
  it('returns [] for non-array input', () => {
    expect(collectArtifacts(null)).toEqual([]);
    expect(collectArtifacts(undefined)).toEqual([]);
  });

  it('ignores user messages and non-message entries', () => {
    const entries = [
      { id: 'u1', type: 'message', message: { role: 'user', content: 'write app.html' } },
      { id: 'm1', type: 'model_change', provider: 'anthropic', modelId: 'x' }
    ];
    expect(collectArtifacts(entries)).toEqual([]);
  });
});
