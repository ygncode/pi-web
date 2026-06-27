#!/usr/bin/env python3
"""Assemble the VitePress source tree (website/src) for the docs site.

Source of truth stays in user-docs/ — prose in user-docs/<lang>/*.md and the
hero in user-docs/<lang>/hero.json (translated by build_userdocs.py). This
script produces the generated, gitignored srcDir VitePress builds from, so docs
are never duplicated by hand.

For every language it:
  1. Renders a localized hero home page (index.md) from user-docs/<lang>/hero.json
     (falling back to the English user-docs/en/hero.json if a locale lacks one).
  2. Transforms each user-docs/<lang>/*.md into a localized VitePress page
     (README -> guide), copies shared images into public/.
  3. Emits .vitepress/locales.generated.json (labels + per-locale sidebars)
     consumed by config.js to wire up the language switcher.

The language list is imported from build_userdocs so a new language is added in
one place (its LANGS list), exactly like the rest of the docs pipeline.
"""

import json
import re
import shutil
from pathlib import Path

from build_userdocs import LANGS

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "website"
SRC = SITE / "src"
USER_DOCS = ROOT / "user-docs"
ASSETS = USER_DOCS / "assets"
LOCALES_JSON = SITE / ".vitepress" / "locales.generated.json"

PACKAGE_URL = "https://pi.dev/packages/@ygncode/pi-web?name=pi-web"

# Browser/SEO <title> for the home page (titleTemplate:false keeps it verbatim).
HOME_TITLE = "pi-web - Web UI for Pi (Access pi via Remote, Mobile)"

# Reading order for the sidebar. README becomes the "guide" page per locale.
DOC_ORDER = [
    "README",
    "why",
    "install",
    "personal-assistant",
    "keyboard-shortcuts",
    "llm-debug",
    "roadmap",
]

# BCP-47 tags for the <html lang> attribute, keyed by user-docs dir name.
LANG_TAGS = {
    "en": "en-US",
    "es": "es",
    "fr": "fr",
    "de": "de",
    "zh": "zh-Hans",
    "ja": "ja",
    "id": "id",
    "ms": "ms",
    "vi": "vi",
    "th": "th",
    "fil": "fil",
    "my": "my",
    "km": "km",
    "lo": "lo",
}

# Sidebar title for docs with no Markdown heading to derive one from.
FALLBACK_TITLES = {"llm-debug": "LLM Debugging"}

# The language-switcher nav block authored for GitHub rendering: the only
# <div align="center"> in a README, recognizable by its README.md) links.
NAV_BLOCK_RE = re.compile(
    r'<div align="center">\s*\n.*?README\.md\).*?</div>\n*',
    re.DOTALL,
)


def slug(code: str, doc: str) -> str:
    name = "guide" if doc == "README" else doc
    return f"/{name}" if code == "en" else f"/{code}/{name}"


def transform(text: str, doc: str, code: str) -> str:
    if doc == "README":
        text = NAV_BLOCK_RE.sub("", text, count=1)
    # Shared images: ../assets/x -> /assets/x (served from public/, base-prefixed).
    text = text.replace("](../assets/", "](/assets/")
    # The lone cross-doc link to the README (in roadmap). English slugs match the
    # English headings; translated headings slugify differently, so drop the
    # fragment for locales to avoid a dead anchor.
    if code == "en":
        text = re.sub(r"\]\(README\.md#([^)]*)\)", r"](/guide#\1)", text)
    else:
        text = re.sub(r"\]\(README\.md#[^)]*\)", f"](/{code}/guide)", text)
    return re.sub(r"\n{3,}", "\n\n", text).lstrip("\n")


def page_title(text: str, doc: str) -> str:
    match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return FALLBACK_TITLES.get(doc, doc.replace("-", " ").title())


def yaml_scalar(value: str) -> str:
    # JSON strings are valid double-quoted YAML scalars (escaping + emoji safe).
    return json.dumps(value, ensure_ascii=False)


def render_hero(code: str) -> str:
    path = USER_DOCS / code / "hero.json"
    if not path.exists():
        path = USER_DOCS / "en" / "hero.json"
    hero = json.loads(path.read_text())

    lines = [
        "---",
        "layout: home",
        f"title: {yaml_scalar(HOME_TITLE)}",
        "titleTemplate: false",
        "",
        "hero:",
        '  name: "pi-web"',
        f"  text: {yaml_scalar(hero['text'])}",
        f"  tagline: {yaml_scalar(hero['tagline'])}",
        "  actions:",
    ]
    for action in hero["actions"]:
        link = action.get("link") or (
            f"/{action['to']}" if code == "en" else f"/{code}/{action['to']}"
        )
        lines += [
            f"    - theme: {action.get('theme', 'brand')}",
            f"      text: {yaml_scalar(action['text'])}",
            f"      link: {yaml_scalar(link)}",
        ]
    # The hero image (demo GIF + caption) is rendered for every locale by the
    # home-hero-image theme slot (HeroImage.vue), not via per-locale frontmatter.
    lines += ["", "features:"]
    for feature in hero["features"]:
        lines += [
            f"  - icon: {yaml_scalar(feature['icon'])}",
            f"    title: {yaml_scalar(feature['title'])}",
            f"    details: {yaml_scalar(feature['details'])}",
        ]
    lines += ["---", ""]
    return "\n".join(lines)


def main() -> None:
    if SRC.exists():
        shutil.rmtree(SRC)
    SRC.mkdir(parents=True)

    dest_assets = SRC / "public" / "assets"
    dest_assets.mkdir(parents=True, exist_ok=True)
    for path in ASSETS.glob("*"):
        if path.is_file():
            shutil.copy2(path, dest_assets / path.name)

    locales = {}
    for code, label in LANGS:
        out_dir = SRC if code == "en" else SRC / code
        out_dir.mkdir(parents=True, exist_ok=True)

        (out_dir / "index.md").write_text(render_hero(code))

        sidebar = []
        for doc in DOC_ORDER:
            text = transform((USER_DOCS / code / f"{doc}.md").read_text(), doc, code)
            name = "guide" if doc == "README" else doc
            (out_dir / f"{name}.md").write_text(text)
            sidebar.append({"text": page_title(text, doc), "link": slug(code, doc)})

        theme = {
            "nav": [
                {"text": "Guide", "link": slug(code, "README")},
                {"text": "pi.dev", "link": PACKAGE_URL},
            ],
            "sidebar": sidebar,
        }
        key = "root" if code == "en" else code
        entry = {"label": label, "lang": LANG_TAGS[code], "themeConfig": theme}
        if code != "en":
            entry["link"] = f"/{code}/"
        locales[key] = entry

    LOCALES_JSON.write_text(json.dumps(locales, ensure_ascii=False, indent=2) + "\n")
    print(f"Assembled VitePress src at {SRC.relative_to(ROOT)} ({len(LANGS)} locales)")


if __name__ == "__main__":
    main()
