#!/usr/bin/env python3
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "user-docs"
EN_DIR = DOCS_DIR / "en"

DOCS = [
    "README",
    "install",
    "keyboard-shortcuts",
    "llm-debug",
    "personal-assistant",
    "roadmap",
    "why",
]

# code -> native name (display order). en first.
LANGS = [
    ("en", "English"),
    ("es", "Español"),
    ("fr", "Français"),
    ("de", "Deutsch"),
    ("zh", "中文"),
    ("ja", "日本語"),
    ("id", "Bahasa Indonesia"),
    ("ms", "Bahasa Melayu"),
    ("vi", "Tiếng Việt"),
    ("th", "ไทย"),
    ("fil", "Filipino"),
    ("my", "မြန်မာ"),
    ("km", "ភាសាខ្មែរ"),
    ("lo", "ລາວ"),
]

TRANSLATE_TARGET = {
    "es": "Spanish (Español)",
    "fr": "French (Français)",
    "de": "German (Deutsch)",
    "zh": "Simplified Chinese (简体中文)",
    "ja": "Japanese (日本語)",
    "id": "Indonesian (Bahasa Indonesia)",
    "ms": "Malay (Bahasa Melayu)",
    "vi": "Vietnamese (Tiếng Việt)",
    "th": "Thai (ไทย)",
    "fil": "Filipino",
    "my": "Burmese (မြန်မာ)",
    "km": "Khmer (ភាសាខ្មែរ)",
    "lo": "Lao (ລາວ)",
}

NAV_RE = re.compile(r'\n\n<div align="center">\n\n\*\*English\*\*.*?\n\n</div>\n', re.DOTALL)


def nav_block(current: str) -> str:
    parts = []
    for code, name in LANGS:
        if code == current:
            parts.append(f"**{name}**")
        else:
            parts.append(f"[{name}](../{code}/README.md)")
    return '<div align="center">\n\n' + " · ".join(parts) + "\n\n</div>"


PROMPT = """You are translating a software project's documentation page from English into {target}.

Rules:
- Output ONLY the translated Markdown. No preamble, no commentary, no surrounding code fence.
- Preserve all Markdown structure exactly: headings, tables (keep the | column layout), blockquotes (>), lists, bold/italic, horizontal rules (---), HTML tags, and all emoji.
- Do NOT translate or alter: fenced code blocks and their contents, inline code in backticks, URLs, file paths, link targets in parentheses, image paths, and anchor fragments (#...).
- Translate visible prose, link text, table cell text, and image alt text.
- Keep these terms in English / as-is: pi, pi-web, Tailscale, PWA, SSE, JSONL, fsnotify, launchd, systemd, macOS, Linux, Windows, npm, QR, RPC, MagicDNS, Claude, Cowork, OpenClaw, Hermes, Git, GitHub, Gist, Vim, pomodoro, beta, Termius, Chrome, Edge, Safari.

Here is the Markdown to translate (begin your output directly with the translated content):

{body}
"""


def translate(body: str, code: str) -> str:
    prompt = PROMPT.format(target=TRANSLATE_TARGET[code], body=body)
    result = subprocess.run(
        ["pi", "-p", "--model", "opencode-go/deepseek-v4-pro", "--no-session", prompt],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0:
        raise RuntimeError(f"pi failed for {code}: {result.stderr}")
    out = result.stdout.strip()
    if out.startswith("```"):
        out = re.sub(r"^```[a-zA-Z]*\n", "", out)
        out = re.sub(r"\n```$", "", out)
    out = re.sub(r"^\s*---\s*\n+", "", out)  # drop a leading hr the model may echo
    return out.strip()


def build_readme(code: str, name: str) -> str:
    src = (EN_DIR / "README.md").read_text()
    src_no_nav = NAV_RE.sub("", src, count=1)
    if code == "en":
        translated = src_no_nav
    else:
        translated = translate(src_no_nav, code)
    title, _, rest = translated.partition("\n")
    return f"{title}\n\n{nav_block(code)}\n\n{rest.lstrip()}\n"


def build_doc(doc: str, code: str) -> str:
    src = (EN_DIR / f"{doc}.md").read_text()
    if code == "en":
        return src
    return translate(src, code) + "\n"


# hero.json drives the docs-site home page (see scripts/build_site.py). Only its
# string values are translated; keys, links, icons, and structure are preserved.
HERO_PROMPT = """Translate the string VALUES of this JSON object into {target}.

Rules:
- Output ONLY valid JSON with the exact same keys. No preamble, no commentary, no code fence.
- Translate every value into {target}.
- Keep these terms in English / as-is: pi, pi-web, PWA, SSE, Tailscale, GitHub, Gist, macOS, Linux, Windows, npm, Claude, Cowork, Termius.
- Preserve emoji, punctuation, and the em dash (—).

{payload}
"""


def hero_strings(hero: dict) -> list[tuple]:
    paths = [("text",), ("tagline",)]
    paths += [("actions", i, "text") for i in range(len(hero["actions"]))]
    for i in range(len(hero["features"])):
        paths += [("features", i, "title"), ("features", i, "details")]
    return paths


def build_hero(code: str) -> str:
    hero = json.loads((EN_DIR / "hero.json").read_text())
    if code == "en":
        return json.dumps(hero, ensure_ascii=False, indent=2) + "\n"
    paths = hero_strings(hero)
    payload = json.dumps(
        {str(i): _at(hero, p) for i, p in enumerate(paths)}, ensure_ascii=False, indent=2
    )
    prompt = HERO_PROMPT.format(target=TRANSLATE_TARGET[code], payload=payload)
    result = subprocess.run(
        ["pi", "-p", "--model", "opencode-go/deepseek-v4-pro", "--no-session", prompt],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0:
        raise RuntimeError(f"pi failed for {code} hero: {result.stderr}")
    out = re.sub(r"\n```$", "", re.sub(r"^```[a-zA-Z]*\n", "", result.stdout.strip()))
    data = json.loads(out)
    if len(data) != len(paths):
        raise RuntimeError(f"{code} hero: expected {len(paths)} strings, got {len(data)}")
    for i, path in enumerate(paths):
        _set(hero, path, data[str(i)])
    return json.dumps(hero, ensure_ascii=False, indent=2) + "\n"


def _at(obj, path):
    for key in path:
        obj = obj[key]
    return obj


def _set(obj, path, value):
    for key in path[:-1]:
        obj = obj[key]
    obj[path[-1]] = value


def main():
    only = sys.argv[1:]  # optional list of lang codes
    for code, name in LANGS:
        if code == "en":
            continue
        if only and code not in only:
            continue
        out_dir = DOCS_DIR / code
        out_dir.mkdir(parents=True, exist_ok=True)
        for doc in DOCS:
            print(f"[{code}] {doc}…", flush=True)
            if doc == "README":
                content = build_readme(code, name)
            else:
                content = build_doc(doc, code)
            (out_dir / f"{doc}.md").write_text(content)
        print(f"[{code}] hero…", flush=True)
        (out_dir / "hero.json").write_text(build_hero(code))
        print(f"[{code}] done ({len(DOCS)} docs + hero)", flush=True)


if __name__ == "__main__":
    main()
