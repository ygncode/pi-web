package ui

import (
	"bytes"
	_ "embed"
	"html/template"
	"io"
)

//go:embed live_templates/app.html
var appTmplStr string

var appTmpl = template.Must(template.New("app").Parse(appTmplStr))

func appStylesheets() template.HTML {
	return template.HTML("<style>\n" + liveThemeCss + "\n" + indexCSS + "\n" + settingsCSS + "\n" + liveSessionCss + "\n" + liveMenuCss + "\n" + livePaletteCss + "\n</style>")
}

// RenderAppShell renders the Svelte SPA host document. It deliberately reuses
// the same live-document boot path as the existing Go-rendered pages so the
// installed PWA keeps its viewport, theme, WCO, font, and service-worker
// behavior while routes migrate into Svelte incrementally.
func RenderAppShell(w io.Writer) error {
	scriptSrc := template.HTMLEscapeString(appScriptPath)
	preload := template.HTML(`<link rel="modulepreload" href="` + scriptSrc + `">`)
	data := struct {
		LiveDocumentStart template.HTML
		ThemeBoot         template.HTML
		AppScript         template.HTML
		ServiceWorker     template.HTML
		LiveDocumentEnd   template.HTML
	}{
		LiveDocumentStart: template.HTML(renderLiveDocumentStart(liveDocumentData{
			Title:   "pi-web",
			Preload: preload,
			Styles:  appStylesheets(),
		})),
		ThemeBoot:       liveThemeBootScript(),
		AppScript:       template.HTML(`<script type="module" src="` + scriptSrc + `"></script>`),
		ServiceWorker:   liveServiceWorkerScript(),
		LiveDocumentEnd: liveDocumentEnd(),
	}
	var buf bytes.Buffer
	if err := appTmpl.Execute(&buf, data); err != nil {
		return err
	}
	_, err := w.Write(buf.Bytes())
	return err
}
