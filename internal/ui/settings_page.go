package ui

import (
	_ "embed"
	"html/template"
	"io"
)

//go:embed live_templates/settings.html
var settingsTmplStr string

var settingsTmpl = template.Must(template.New("settings").Funcs(funcMap).Parse(settingsTmplStr))

// RenderSettings renders the global /settings page. Controls are populated and
// persisted client-side via /api/settings; the theme is injected server-side
// (shared meta tag) so the page paints in the correct theme before JS runs.
func RenderSettings(w io.Writer) error {
	return settingsTmpl.Execute(w, nil)
}
