package ui

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"sort"
	"strings"

	"pi-web/internal/sessions"
)

//go:embed live_templates/export/app/*.js
var appJsFS embed.FS

//go:embed live_templates/export/vendor/marked.min.js
var markedJs string

//go:embed live_templates/export/vendor/highlight.min.js
var hljsJs string

// Explicit export app JS manifest. The static export runtime is intentionally
// not bundled by Vite, so keep load order here instead of relying on filename
// sorting to silently do the right thing.
var exportAppJSFiles = []string{
	"00-data.js",
	"10-tree.js",
	"20-filter.js",
	"30-format.js",
	"40-render-tree.js",
	"50-render-entry.js",
	"60-header.js",
	"70-navigation.js",
	"80-ui.js",
}

// Concatenated export app JS bundle, wrapped in a single IIFE so all modules
// share closure scope.
var exportJs = buildExportJsBundle()

func buildExportJsBundle() string {
	verifyExportAppManifest()

	var b strings.Builder
	b.WriteString("(function() {\n'use strict';\n")
	for _, name := range exportAppJSFiles {
		body, err := appJsFS.ReadFile("live_templates/export/app/" + name)
		if err != nil {
			panic(fmt.Errorf("read %s: %w", name, err))
		}
		b.WriteString("\n// ===== " + name + " =====\n")
		b.Write(body)
		b.WriteString("\n")
	}
	b.WriteString("})();\n")
	return b.String()
}

func verifyExportAppManifest() {
	entries, err := appJsFS.ReadDir("live_templates/export/app")
	if err != nil {
		panic(fmt.Errorf("read live_templates/export/app: %w", err))
	}

	seen := make(map[string]bool, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".js") {
			seen[e.Name()] = true
		}
	}
	for _, name := range exportAppJSFiles {
		if !seen[name] {
			panic(fmt.Errorf("export app manifest references missing file %s", name))
		}
		delete(seen, name)
	}
	if len(seen) > 0 {
		extra := make([]string, 0, len(seen))
		for name := range seen {
			extra = append(extra, name)
		}
		sort.Strings(extra)
		panic(fmt.Errorf("export app files missing from manifest: %s", strings.Join(extra, ", ")))
	}
}

// renderExportSessionPage renders a self-contained HTML snapshot suitable for
// GitHub Gist sharing. All JS is inlined and server-dependent chrome (buttons,
// chat composer) is stripped.
// sanitizeTheme returns the theme name if it is one of the recognised built-in
// values, or "dark" as a safe default. This prevents a user-controlled cookie
// value from being interpolated verbatim into the export <script> block.
func sanitizeTheme(t string) string {
	switch t {
	case "dark", "light", "nord", "dracula", "custom":
		return t
	}
	return "dark"
}

func RenderExportSessionPage(session sessions.Session, theme string) string {
	dataBase64, css, bodyAttrs := prepareSessionPageData(session, liveThemeCss+"\n"+liveSessionCss)

	styles := "<style>\n" + css + "\n</style>"
	inlineScript := "<script>\n" + markedJs + "\n</script>\n<script>\n" + hljsJs + "\n</script>\n<script>\n" + exportJs + "\n</script>"

	data := struct {
		IsLive             bool
		Title              string
		LiveDocumentStart  template.HTML
		ThemeBoot          template.HTML
		ServiceWorker      template.HTML
		SessionCommandMenu template.HTML
		MobileCommandMenu  template.HTML
		SessionPalette     template.HTML
		SessionData        template.JS
		SessionScript      template.HTML
		FirstMessageStub   template.HTML
		ChatComposer       template.HTML
		LiveDocumentEnd    template.HTML
	}{
		IsLive:             false,
		Title:              session.Name,
		LiveDocumentStart:  renderExportDocumentStart(session.Name, styles, bodyAttrs),
		ThemeBoot:          exportThemeBootScript(sanitizeTheme(theme)),
		ServiceWorker:      "",
		SessionCommandMenu: "",
		MobileCommandMenu:  "",
		SessionPalette:     "",
		SessionData:        template.JS(dataBase64),
		SessionScript:      template.HTML(inlineScript),
		FirstMessageStub:   "",
		ChatComposer:       "",
		LiveDocumentEnd:    template.HTML("</body>\n</html>"),
	}

	var buf bytes.Buffer
	if err := liveSessionTmpl.Execute(&buf, data); err != nil {
		log.Printf("export: template execution failed for session %q: %v", session.ID, err)
		return ""
	}
	return buf.String()
}

func renderExportDocumentStart(title string, styles string, bodyAttrs string) template.HTML {
	var b strings.Builder
	b.WriteString("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n")
	b.WriteString("<meta charset=\"UTF-8\">\n")
	b.WriteString("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1\">\n")
	b.WriteString("<title>")
	b.WriteString(template.HTMLEscapeString(title))
	b.WriteString("</title>\n")
	b.WriteString("<link rel=\"icon\" type=\"image/svg+xml\" href=\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgODAwIj48cGF0aCBmaWxsPSIjMDBkN2ZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNjUuMjkgMTY1LjI5IEg1MTcuMzYgVjQwMCBINDAwIFY1MTcuMzYgSDI4Mi42NSBWNjM0LjcyIEgxNjUuMjkgWiBNMjgyLjY1IDI4Mi42NSBWNDAwIEg0MDAgVjI4Mi42NSBaIi8+PHBhdGggZmlsbD0iIzAwZDdmZiIgZD0iTTUxNy4zNiA0MDAgSDYzNC43MiBWNjM0LjcyIEg1MTcuMzYgWiIvPjwvc3ZnPg==\">\n")
	if styles != "" {
		b.WriteString(styles)
		b.WriteByte('\n')
	}
	b.WriteString("</head>\n<body")
	if bodyAttrs != "" {
		b.WriteString(bodyAttrs)
	}
	b.WriteString(">\n")
	return template.HTML(b.String())
}

func exportThemeBootScript(defaultTheme string) template.HTML {
	return themeBootScript(defaultTheme)
}

func serveStaticJS(body string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		_, _ = w.Write([]byte(body))
	}
}
