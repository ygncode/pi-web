#!/usr/bin/env node
// npm lifecycle dispatcher: npm runs scripts through cmd.exe on Windows, where
// `bash install.sh` is unavailable. Route to the PowerShell port there and to
// the bash scripts everywhere else.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const action = process.argv[2];
if (action !== 'install' && action !== 'uninstall') {
  console.error('usage: run-lifecycle.mjs install|uninstall');
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result =
  process.platform === 'win32'
    ? spawnSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, `${action}.ps1`)],
        { stdio: 'inherit' },
      )
    : spawnSync('bash', [join(root, `${action}.sh`)], { stdio: 'inherit' });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
