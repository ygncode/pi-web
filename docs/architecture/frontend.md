# Frontend Architecture

pi-web uses a Vite-built frontend embedded into the Go binary, plus a self-contained static export path.

## Vite App Frontends

Built with **Vite** + **Alpine.js / vanilla modules**, embedded into the Go binary.

### Build Pipeline

```
web/src/index/index.js      ──┐
web/src/session/session.js    │
web/src/live/live.js          ├──▶  vite build  ──▶  web/dist/  ──▶  //go:embed
web/src/shared/*.js           │                      │              (dist_embed.go)
web/src/session/**/*.js       │                      ▼
                              │                  .vite/manifest.json
```

At startup, `dist_embed.go` reads `.vite/manifest.json`, validates configured entrypoints, and registers their hashed asset routes under `/static/...`.

## Index Page (`/`)

`live_templates/index.html` renders the shell and injects the Vite `index` module path with `indexScript`.

The Alpine app is in `web/src/index/`:

- search/filter session cards
- new-session modal
- recent locations
- running-session live status via shared SSE helpers

## Session Page (`/session?id=…`)

Interactive session viewing is now owned by the Vite `session` entrypoint at `web/src/session/session.js`.

The Go template still renders the live HTML shell, CSS, chat form shell, and serialized initial data:

```
generateExportHtml(session, showButtons=true)
       │
       ├──▶ live_templates/session.html
       ├──▶ live_templates/session.css
       ├──▶ base64(sessionData) in #session-data
       ├──▶ live_templates/chat_composer.html
       └──▶ <script type="module" src="/static/assets/session-*.js">
```

Session frontend modules are split by ownership:

- `web/src/session/data/` — initial payload decoding, URL params, lookup maps
- `web/src/session/tree/` — tree building, filtering, flattening, tree DOM rendering
- `web/src/session/render/` — formatting helpers plus message/header renderers
- `web/src/session/navigation/` — session path rendering, header/message navigation, copy-link wiring
- `web/src/session/chat/` — chat composer, attachments, model and thinking controls
- `web/src/session/live/` — session SSE/live reload behavior
- `web/src/session/ui/` — session page interaction wiring and sidebar behavior

`export/app/*.js` is not the source of live interactive session runtime behavior. It is kept only for static/share exports.

## Static / Share Export

When `generateExportHtml(session, showButtons=false)` creates self-contained exported HTML, it still inlines:

- `export/app/*.js`
- `export/vendor/marked.min.js`
- `export/vendor/highlight.min.js`

This keeps exported/shared HTML independent from the Go server and Vite assets.

## Live Reload

Interactive session live reload is bundled directly by the Vite `session` entrypoint via modular `web/src/session/live/` helpers.

The session page listens to `/events?id=<sessionId>` for:

- `reload` / canonical session updates
- `chat-preview` streaming preview updates
- running worker/status-related UI updates

## Shared Frontend Modules

- `web/src/shared/api.js` — JSON fetch helpers
- `web/src/shared/status-events.js` — shared status SSE lifecycle
- `web/src/shared/storage.js` — localStorage helpers
- `web/src/shared/escape.js` — HTML escaping

## Static Assets

| Asset | Source | Served From |
|-------|--------|-------------|
| Vite index bundle | `web/dist/assets/index-*.js` | `/static/assets/index-*.js` |
| Vite session bundle | `web/dist/assets/session-*.js` | `/static/assets/session-*.js` |
| Vite live bundle | `web/dist/assets/live-*.js` | `/static/assets/live-*.js` |
| Static export JS | `export/app/*.js` + vendors | inline in exported HTML |

## Theme System

Session colors are still defined by `computeThemeVars()` in `export.go` and injected into both `live_templates/session.css` and `export/template.css`. Moving live CSS into Vite-owned files is a remaining cleanup step.
