package ui

import (
	_ "embed"
	"fmt"
	"html/template"
	"io"
	"time"

	"pi-web/internal/sessions"
)

//go:embed live_templates/index.html
var indexTmplStr string

// indexScriptPath is the URL path at which the index page's Vite module is
// served. It defaults to a stable path and is overwritten at startup if a
// hashed asset is found in the Vite manifest. The index template reads it via
// funcMap so the rendered <script src> tracks the build hash.
var indexScriptPath = "/static/assets/index.js"
var sessionScriptPath = "/static/assets/session.js"
var settingsScriptPath = "/static/assets/settings.js"

func SetIndexScriptPath(path string)    { indexScriptPath = path }
func SetSessionScriptPath(path string)  { sessionScriptPath = path }
func SetSettingsScriptPath(path string) { settingsScriptPath = path }

func fmtRelativeTime(ts string) string {
	if ts == "" {
		return "—"
	}
	then, err := time.Parse(time.RFC3339Nano, ts)
	if err != nil {
		return ts
	}
	seconds := int(time.Since(then).Seconds())
	if seconds < 60 {
		return "just now"
	}
	units := []struct {
		name    string
		seconds int
	}{
		{"year", 365 * 24 * 60 * 60},
		{"month", 30 * 24 * 60 * 60},
		{"week", 7 * 24 * 60 * 60},
		{"day", 24 * 60 * 60},
		{"hour", 60 * 60},
		{"minute", 60},
	}
	for _, unit := range units {
		if count := seconds / unit.seconds; count >= 1 {
			if count == 1 {
				return "1 " + unit.name + " ago"
			}
			return fmt.Sprintf("%d %ss ago", count, unit.name)
		}
	}
	return "just now"
}

var funcMap = template.FuncMap{
	"fmtRelativeTime": fmtRelativeTime,
	"indexScript":     func() string { return indexScriptPath },
	"indexPreload": func() template.HTML {
		return template.HTML(`<link rel="modulepreload" href="` + template.HTMLEscapeString(indexScriptPath) + `">`)
	},
	"homeMenu": homeMenuHTML,
	"paletteHTML": func() template.HTML {
		return renderPalette(paletteData{
			ID:       "sessionPalette",
			Label:    "List sessions",
			SearchID: "session-palette-search",
			Actions:  true,
		})
	},
	"liveDocumentStart":       liveDocumentStart,
	"liveThemeBootScript":     liveThemeBootScript,
	"liveServiceWorkerScript": liveServiceWorkerScript,
	"liveDocumentEnd":         liveDocumentEnd,
	"indexStylesheets":        indexStylesheets,
	"settingsScript":          func() string { return settingsScriptPath },
	"settingsPreload": func() template.HTML {
		return template.HTML(`<link rel="modulepreload" href="` + template.HTMLEscapeString(settingsScriptPath) + `">`)
	},
	"settingsStylesheets": settingsStylesheets,
}

func settingsStylesheets() template.HTML {
	return template.HTML(`<link rel="stylesheet" href="/theme.css">
<link rel="stylesheet" href="/menu.css">
<link rel="stylesheet" href="/settings.css">`)
}

var indexTmpl = template.Must(template.New("index").Funcs(funcMap).Parse(indexTmplStr))

func RenderIndex(w io.Writer, summaries []sessions.SessionSummary) error {
	return indexTmpl.Execute(w, summaries)
}
