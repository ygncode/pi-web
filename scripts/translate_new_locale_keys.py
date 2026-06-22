#!/usr/bin/env python3
"""One-off translator for newly-added composer.* locale keys.

Calls `pi --provider opencode-go --model deepseek-v4-pro` once per non-English
locale, asking deepseek to translate the keys we just added to en.js. The
script feeds a few of the locale's existing composer.* entries as style
reference so the new translations match register, then patches the file by
inserting the translated entries right after the existing `composer.removeQueued`
line.

Idempotent: re-running on a locale that already has the keys is a no-op.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
LOCALES_DIR = REPO / "web" / "src" / "shared" / "locales"

# (code, native name) pairs, matching the rest of the project's lists.
LANGS = [
    ("de", "Deutsch"),
    ("es", "Español"),
    ("fil", "Filipino"),
    ("fr", "Français"),
    ("id", "Bahasa Indonesia"),
    ("ja", "日本語"),
    ("km", "ខ្មែរ"),
    ("lo", "ລາວ"),
    ("ms", "Bahasa Melayu"),
    ("my", "မြန်မာ"),
    ("th", "ไทย"),
    ("vi", "Tiếng Việt"),
    ("zh", "中文"),
]

# Keys to translate (order matters — preserved when patching the file).
# Re-translates the two queue-panel hint keys after the localStorage → server
# rewrite (autonomous backend drainer).
NEW_KEYS = [
    ("composer.queueSavedLocally", "auto-sending"),
    (
        "composer.queueSavedLocallyHint",
        "Queued messages are saved on the server and will be sent automatically when the worker is idle — even if you close the browser",
    ),
]

# Style-reference keys: existing composer.* entries the locale already has
# translated. Sending these grounds deepseek in the locale's register.
REFERENCE_KEYS = [
    "composer.steer",
    "composer.queue",
    "composer.queueHint",
    "composer.steering",
    "composer.removeQueued",
    "composer.cancel",
    "composer.idle",
]

ANCHOR_KEY = "composer.queueExit"

KEY_LINE_RE = re.compile(r"^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)'\s*,?\s*$")


def read_existing_strings(locale_path: Path) -> dict[str, str]:
    """Naive single-line parser sufficient for these locale files."""
    out: dict[str, str] = {}
    for line in locale_path.read_text(encoding="utf-8").splitlines():
        m = KEY_LINE_RE.match(line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


def js_escape(value: str) -> str:
    """Match the project's single-quoted style: only ' and \\ need escaping."""
    return value.replace("\\", "\\\\").replace("'", "\\'")


def build_prompt(code: str, native: str, references: dict[str, str]) -> str:
    # Send reference EN -> LOCAL pairs as JSON so deepseek can pattern-match
    # the locale's existing register against the new English source.
    pairs = [
        {"key": key, "local": references[key]} for key in REFERENCE_KEYS if key in references
    ]

    new_payload = [{"key": key, "english": english} for key, english in NEW_KEYS]

    return (
        f"You translate English UI strings for a chat composer panel into {native} "
        f"(locale code `{code}`). The panel sits above a chat textarea; it shows "
        f"queued and in-flight ('steer') messages while an AI response is running, "
        f"with Pause/Resume controls and keyboard shortcut hints.\n\n"
        f"Match the register and tone of these existing translations in the same "
        f"locale (English -> {native}):\n"
        f"{json.dumps(pairs, ensure_ascii=False, indent=2)}\n\n"
        f"Now translate each of the following keys into {native}. Keep entries "
        f"short — most are button labels or short status lines. 'steering' as a "
        f"tag should be a brief lowercase noun/adjective in the target language "
        f"that means 'currently steering the response'. The hint strings can be "
        f"a full sentence.\n\n"
        f"Keys to translate:\n"
        f"{json.dumps(new_payload, ensure_ascii=False, indent=2)}\n\n"
        f"Respond with ONE JSON object: keys are the dotted key names "
        f"(e.g. 'composer.queueActive'), values are the translated string for "
        f"that key in {native}. Do not add any prose, fences, or commentary — "
        f"only the JSON object.\n"
    )


def call_pi(prompt: str) -> str:
    result = subprocess.run(
        [
            "pi",
            "--provider", "opencode-go",
            "--model", "deepseek-v4-pro",
            "--print",
            "--no-session",
            prompt,
        ],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"pi failed (exit {result.returncode}): {result.stderr.strip()}"
        )
    return result.stdout


def parse_translations(raw: str) -> dict[str, str]:
    # The model occasionally wraps JSON in ```json fences; strip them.
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        first = text.find("{")
        last = text.rfind("}")
        if first == -1 or last == -1:
            raise ValueError("no JSON object in pi output")
        text = text[first : last + 1]
    data = json.loads(text)
    return {str(k): str(v) for k, v in data.items()}


def patch_locale(locale_path: Path, translations: dict[str, str]) -> bool:
    lines = locale_path.read_text(encoding="utf-8").splitlines(keepends=True)

    # Strip any existing rows for the keys we're about to (re-)write. Lets us
    # re-translate without manual cleanup when the English source changes.
    new_keys_set = {key for key, _ in NEW_KEYS}
    filtered: list[str] = []
    for line in lines:
        m = KEY_LINE_RE.match(line)
        if m and m.group(1) in new_keys_set:
            continue
        filtered.append(line)
    lines = filtered

    anchor_idx = None
    indent = "  "
    for idx, line in enumerate(lines):
        m = KEY_LINE_RE.match(line)
        if m and m.group(1) == ANCHOR_KEY:
            anchor_idx = idx
            # Match indent from the anchor.
            ws_match = re.match(r"(\s*)", line)
            if ws_match:
                indent = ws_match.group(1)
            break
    if anchor_idx is None:
        raise RuntimeError(f"anchor key {ANCHOR_KEY!r} not found in {locale_path}")

    new_lines = []
    for key, english in NEW_KEYS:
        value = translations.get(key)
        if not value:
            print(f"  ! missing translation for {key}, falling back to English",
                  file=sys.stderr)
            value = english
        new_lines.append(f"{indent}'{key}': '{js_escape(value)}',\n")

    lines[anchor_idx + 1 : anchor_idx + 1] = new_lines
    locale_path.write_text("".join(lines), encoding="utf-8")
    return True


def main(argv: list[str]) -> int:
    requested = set(argv[1:]) or {code for code, _ in LANGS}
    for code, native in LANGS:
        if code not in requested:
            continue
        locale_path = LOCALES_DIR / f"{code}.js"
        if not locale_path.exists():
            print(f"[{code}] missing {locale_path}, skipping", file=sys.stderr)
            continue
        existing = read_existing_strings(locale_path)
        prompt = build_prompt(code, native, existing)
        print(f"[{code}] asking pi for translations…", flush=True)
        raw = call_pi(prompt)
        try:
            translations = parse_translations(raw)
        except (ValueError, json.JSONDecodeError) as err:
            print(f"[{code}] failed to parse JSON ({err}); raw output saved below",
                  file=sys.stderr)
            print(raw, file=sys.stderr)
            continue
        if patch_locale(locale_path, translations):
            print(f"[{code}] inserted {len(NEW_KEYS)} keys")
        else:
            print(f"[{code}] no changes (already up to date)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
