#!/usr/bin/env node
// Sanitize a real pi session JSONL into a committable e2e fixture.
//
// Usage:
//   node scripts/sanitize-session.mjs <source.jsonl> [options]
//
// Options:
//   --out <dir>     output sessions dir   (default: e2e/fixtures/sessions)
//   --name <file>   output filename       (default: demo.jsonl)
//   --cwd <path>    replacement cwd        (default: /home/user/demo-project)
//   --home <path>   real home to scrub     (default: $HOME)
//   --user <name>   real username to scrub (default: basename of $HOME)
//
// Scrubs: real home paths + username, emails, and common secret shapes
// (OpenAI/GitHub/AWS keys, JWTs, bearer tokens). Preserves entry structure,
// ids, parentIds and timestamps so the session tree still renders faithfully.
//
// ALWAYS manually review the output before committing — automated redaction is
// a safety net, not a guarantee.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const source = args._[0];
if (!source) {
  console.error("error: source .jsonl path required");
  process.exit(1);
}

const HOME = args.home || process.env.HOME || "";
const USER = args.user || (HOME ? basename(HOME) : "");
const NEW_CWD = args.cwd || "/home/user/demo-project";
const OUT_DIR = args.out || join(import.meta.dirname, "..", "fixtures", "sessions");
const OUT_NAME = args.name || "demo.jsonl";

// pi encodes the session dir from the cwd: wrap in "--", drop the leading
// slash, and turn remaining "/" into "-". e.g. /a/b -> --a-b--
function encodeCwd(p) {
  return "--" + p.replace(/^\//, "").replace(/\//g, "-") + "--";
}

const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<REDACTED_JWT>"],
  [/sk-[A-Za-z0-9_-]{16,}/g, "<REDACTED_OPENAI_KEY>"],
  [/(gh[pousr]_[A-Za-z0-9]{20,})/g, "<REDACTED_GITHUB_TOKEN>"],
  [/AKIA[0-9A-Z]{16}/g, "<REDACTED_AWS_KEY>"],
  [/(?<=[Bb]earer )[A-Za-z0-9._-]{20,}/g, "<REDACTED_TOKEN>"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "redacted@example.com"],
];

function scrubString(s) {
  let out = s;
  if (HOME) out = out.split(HOME).join(NEW_CWD === "/home/user/demo-project" ? "/home/user" : NEW_CWD);
  if (USER) out = out.replace(new RegExp(`\\b${USER}\\b`, "g"), "user");
  for (const [re, repl] of SECRET_PATTERNS) out = out.replace(re, repl);
  return out;
}

function scrub(value) {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = scrub(v);
    return o;
  }
  return value;
}

const lines = readFileSync(source, "utf8").split("\n").filter((l) => l.trim());
const out = lines.map((line) => {
  const entry = JSON.parse(line);
  if (entry.type === "session" && typeof entry.cwd === "string") entry.cwd = NEW_CWD;
  return JSON.stringify(scrub(entry));
});

const destDir = join(OUT_DIR, encodeCwd(NEW_CWD));
mkdirSync(destDir, { recursive: true });
const destFile = join(destDir, OUT_NAME);
writeFileSync(destFile, out.join("\n") + "\n");

console.log(`sanitized ${lines.length} entries -> ${destFile}`);
console.log("REVIEW the output before committing.");
