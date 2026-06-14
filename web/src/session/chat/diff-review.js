// Builds the chat prompt sent to pi from a set of review comments, grouped by
// file and ordered by line. Kept separate from DiffModal so it can be unit
// tested without the diff renderer.
export function buildReviewPrompt(comments) {
  if (!comments || comments.length === 0) return '';
  const byFile = new Map();
  for (const c of comments) {
    if (!byFile.has(c.file)) byFile.set(c.file, []);
    byFile.get(c.file).push(c);
  }
  const out = [
    'Please address the following review comments on the current working-tree changes:',
    '',
  ];
  for (const [file, list] of byFile) {
    out.push(`### ${file}`);
    for (const c of [...list].sort((a, b) => a.startLine - b.startLine)) {
      const range =
        c.startLine === c.endLine ? `Line ${c.startLine}` : `Lines ${c.startLine}-${c.endLine}`;
      const side = c.side === 'old' ? ' (old)' : '';
      out.push(`- ${range}${side}: ${c.body}`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}
