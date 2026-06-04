# Sequence Flow: Artifacts

Artifacts are substantial, self-contained outputs surfaced from a session into
the right-sidebar **Artifacts** tab: files the agent wrote/edited, plus sizeable
fenced code blocks. They are **derived from the transcript at render time** — not
a new message type the agent emits — so the registry is pure and re-runs on every
session reload.

Artifacts are **live-only**: the panel host exists only on the live session page
(`IsLive`), never in exported Gist snapshots.

Frontend modules (`web/src/session/artifacts/`):

- `artifact-registry.js` — pure, DOM-free detection → an array of descriptors
- `artifact-filter.js` — pure, DOM-free narrowing of that array by the user's
  Artifacts settings (enable toggle + include-glob list)
- `artifact-panel.js` — the right-sidebar panel (list, source view, preview,
  copy/download, help modal)

Wired in `session.js` (`refreshArtifacts`): `collectArtifacts(dataModel.entries)`
detects everything, `filterArtifacts(...)` narrows it by settings, and the result
feeds the panel on load and again on every live-reload (`syncDataModelEntries`).

## Detection: path-keyed, edit-aware

The registry reconstructs each file's **latest state** by replaying the
*structured* tool calls in order. File artifacts are keyed by **path** (not by
tool-call id), so multiple operations on one file collapse into one card.

| Tool call | Effect on the path-keyed artifact |
|-----------|-----------------------------------|
| `write` `{path, content}` | create the artifact, or replace its content if the path already exists |
| `edit` `{path, edits:[{oldText,newText}]}` | apply each edit (first-match) to the current content; ignored if the path was never written in-session (no baseline) |
| `bash` `{command}` | only plain `mv` / `git mv` / `rm` (see below) rename or remove the artifact, and only once the tool result lands without error |
| `bashExecution` (user-run) | same `mv`/`rm` recognition, gated on `exitCode === 0` |

Sizeable fenced code blocks in assistant text become **snippet** artifacts
(previewable languages always; others only at ≥ `minCodeBlockLines`, default 6).
Snippets are keyed per occurrence, not by path.

### The bash recognizer (and why it's conservative)

`parseFileOps(command)` recognizes only the plain forms — `mv a b`,
`git mv a b`, `mv a b c… dir/`, `rm a b…` — honoring `'…'`/`"…"` quotes. It
**bails entirely** (returns `[]`) if the command contains any shell feature it
won't interpret:

```
UNSAFE_SHELL = /[|&;<>$`*?(){}\n]/
```

So `mv a b && echo`, `sed -i …`, redirects, globs, variables, loops, and
multi-source moves without a directory destination are all left alone. Matches
are by **exact path** against a known artifact, and only applied on success.

The result:

- **write / edit → always accurate** (structured, machine-readable).
- **simple mv / git mv / rm → correctly tracked** (recognized patterns).
- **arbitrary shell → silently skipped** — a file changed via `sed`/redirects can
  go stale. This tradeoff is surfaced to users in the Artifacts **help (?)**
  modal ("changes made through other shell commands … may show an older version
  … check the file on disk").

This is intentional: pi-web is a read-only transcript viewer and does **not**
read the working directory (the files may differ or not exist when viewing an old
or exported session), so the transcript's structured calls are the only ground
truth.

### Descriptor shape

```
{ id, kind: 'code'|'preview', previewType: ''|'html'|'svg'|'markdown',
  title, lang, content, filePath, entryId, anchorId, source }
```

`id` stays stable across edits/renames (it's the first write's `art-<callId>`),
so an artifact's source-view anchor (`artifact-<id>`) and any annotations on it
survive in-place changes.

## Rendering pipeline

```
┌─────────┐   ┌────────────────────┐   ┌──────────────────────────┐
│ session │   │ artifact-registry  │   │ artifact-panel           │
│  .js    │   │ (pure)             │   │ (right-sidebar host)     │
└────┬────┘   └─────────┬──────────┘   └────────────┬─────────────┘
     │ load / reload    │                           │
     │─ collectArtifacts(entries) ─▶                │
     │   [descriptors]  │                           │
     │─ panel.setArtifacts(descriptors) ───────────▶│
     │                  │                           │── render list + selected source
     │                  │                           │   (hljs highlight, lazy)
     │ user clicks list item ──────────────────────▶│── selectArtifact(id) → source view
     │ user clicks "Preview" (preview-kind) ───────▶│── Source ⇄ Preview toggle
```

The list and source view live in the **Artifacts** tab of the right sidebar
(Scratchpad / Artifacts / Annotations switcher in `web/src/session/ui/`). A
count badge reflects the number of artifacts; the help (?) button appears only
on the Artifacts tab.

## Preview (Source ⇄ Preview), and its security model

Previewable artifacts carry a `previewType`. The toggle defaults to **Source**
(click-to-run — nothing executes on load):

| `previewType` | How it renders |
|---------------|----------------|
| `markdown` | rendered inline via the app's sanitizing markdown parser (strips raw HTML) — no iframe |
| `html` / `svg` | executed in a **sandboxed `<iframe>`** |

The HTML/SVG iframe is the load-bearing security boundary:

- `sandbox="allow-scripts"` **without** `allow-same-origin` → unique opaque
  origin: no access to the parent DOM, cookies, `localStorage`, or `PI_WEB_TOKEN`.
- Content is set via the `srcdoc` **property** (never concatenated into parent
  HTML), so it can't execute in the parent document.
- An injected CSP meta blocks all network: `default-src 'none'; img-src data:;
  style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'` — inline
  styles/scripts run so the preview is functional, but nothing can exfiltrate.
- `referrerpolicy="no-referrer"`.

## Filtering & settings

Two server-backed settings (mirrored to localStorage via `settings-store.js`,
defaults in `internal/server/settings.go`) control what the panel shows:

| Key | Default | Meaning |
|-----|---------|---------|
| `pi-web:v1:artifacts:enabled` | `true` | When `false`, the whole **Artifacts tab is hidden** (and if it was active, the sidebar falls back to Scratchpad). |
| `pi-web:v1:artifacts:include` | `*.md, *.html` | Comma/space-separated glob list. Empty = show everything. |

`filterArtifacts(artifacts, { enabled, include })` (pure) applies them:

- **Disabled** → returns nothing.
- **Empty include** → everything passes (all files + snippets).
- **Non-empty include** → file artifacts are kept only if their path matches a
  pattern; **chat snippets are dropped** (they have no `filePath` to match). This
  is the deliberate "filter hides snippets" rule.

Glob dialect is intentionally simple (not gitignore): a pattern without `/`
matches the **basename** (`*.md`); a pattern with `/` matches the **full path**
(`artifacts/**`); `*` is a non-slash run and `**` spans slashes; a bare `.md`
token is normalized to `*.md`.

The registry itself is unchanged — it always detects everything, so toggling the
filter never loses data. When the include list hides detected artifacts, the
panel's empty state shows a count + a link to Settings rather than a bare "no
artifacts" message. Settings live in the **Artifacts** section of `/settings`
(`internal/ui/live_templates/settings.html`).

## Annotating artifacts

The source `<pre>` carries `id="artifact-<id>"`, making it an annotation anchor.
The annotation layer registers the artifact panel host as a scope, so selecting
text in an artifact's source works exactly like annotating a transcript message
(offsets are measured against the `<pre>`'s text content). See
[annotations.md](./annotations.md).

## Live vs. export

| | Live (`/session`) | Export (Gist) |
|---|---|---|
| Artifacts host (`#artifact-panel-host`) | rendered (`IsLive`) | absent |
| Panel + registry | active, refreshes over SSE | not mounted (no-op) |

**Never** inject the artifacts panel into the export output — it depends on a
live backend. See [docs/dev/templates-vs-web.md](../dev/templates-vs-web.md).

---

**E2E coverage:** `e2e/tests/artifacts.spec.ts` covers listing (write + fenced
block), selecting source, the sandboxed HTML preview, inline Markdown preview, a
`bash mv` rename collapsing to one card, downloads, and the help (?) modal. See
[docs/dev/e2e-testing.md](../dev/e2e-testing.md).
