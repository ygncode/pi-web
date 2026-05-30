package ui

import (
	_ "embed"
	"net/http"
)

//go:embed live_templates/assets/manifest.webmanifest
var manifestJSON string

//go:embed live_templates/assets/sw.js
var swJS string

//go:embed live_templates/assets/icon.svg
var iconSVG string

//go:embed live_templates/assets/icon-maskable.svg
var iconMaskableSVG string

//go:embed live_templates/assets/pi-logo.svg
var piLogoSVG string

//go:embed live_templates/assets/done.mp3
var doneMP3 []byte

//go:embed live_templates/styles/theme.css
var themeCSS string

//go:embed live_templates/styles/index.css
var indexCSS string

//go:embed live_templates/styles/menu.css
var menuCSS string

//go:embed live_templates/styles/palette.css
var paletteCSS string

// registerPWAHandlers serves the manifest, service worker, and icons.
// Routes are registered without auth: a manifest/icon leaks nothing
// sensitive, and the service worker must be reachable for installability
// even before the user authenticates.
func RegisterPWAHandlers(mux *http.ServeMux) {
	mux.HandleFunc("/manifest.webmanifest", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/manifest+json")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write([]byte(manifestJSON))
	})
	mux.HandleFunc("/sw.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		// Allow the SW to control the whole origin.
		w.Header().Set("Service-Worker-Allowed", "/")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write([]byte(swJS))
	})
	mux.HandleFunc("/icon.svg", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write([]byte(iconSVG))
	})
	mux.HandleFunc("/icon-maskable.svg", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write([]byte(iconMaskableSVG))
	})
	mux.HandleFunc("/pi-logo.svg", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write([]byte(piLogoSVG))
	})
	mux.HandleFunc("/done.mp3", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "audio/mpeg")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write(doneMP3)
	})
	mux.HandleFunc("/theme.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write([]byte(themeCSS))
	})
	mux.HandleFunc("/index.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write([]byte(indexCSS))
	})
	mux.HandleFunc("/menu.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write([]byte(menuCSS))
	})
	mux.HandleFunc("/palette.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write([]byte(paletteCSS))
	})
}
