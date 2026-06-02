package ui

import (
	"fmt"
	"html/template"
	"strings"
)

type liveDocumentData struct {
	Title     string
	Preload   template.HTML
	Styles    template.HTML
	BodyAttrs template.HTMLAttr
}

// themeProvider returns the server-persisted theme so it can be injected into
// the HTML shell before any JS runs (no flash of the wrong theme). It defaults
// to "dark"; app wiring overrides it via SetThemeProvider to read the DB.
var themeProvider = func() string { return "dark" }

// SetThemeProvider installs the function used to resolve the current
// server-backed theme for server-side injection.
func SetThemeProvider(fn func() string) {
	if fn != nil {
		themeProvider = fn
	}
}

const defaultMonoStack = "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace"

// fontProvider returns the resolved CSS font-family stacks and pixel sizes for
// the interface (--font-sans / --font-size-ui) and content (--font-content /
// --font-content-size). Injected into the shell so the page paints with the
// chosen fonts/sizes before any JS runs. Defaults to the monospace stack; app
// wiring overrides it via SetFontProvider to read the DB.
var fontProvider = func() (uiStack, contentStack, uiSize, contentSize string) {
	return defaultMonoStack, defaultMonoStack, "12", "13"
}

// SetFontProvider installs the function used to resolve the current
// server-backed interface/content font stacks and sizes for server-side
// injection.
func SetFontProvider(fn func() (string, string, string, string)) {
	if fn != nil {
		fontProvider = fn
	}
}

// wcoBootScript toggles a `wco` class on <html> when the PWA is running with
// Window Controls Overlay so the app can paint its own header into the OS title
// bar. Runs in <head> (before <body> exists) so the class is set on the root
// element with no flash, and tracks runtime changes via geometrychange.
// wcoBootScript runs in <head> before any CSS loads.
// It does two things:
//   1. Sets an inline background-color on <html> from localStorage so the
//      correct theme colour is present from the very first paint, eliminating
//      the white/gray flash visible in the WCO title-bar area during navigation.
//   2. Toggles the `wco` class when Window Controls Overlay is active.
// wcoBootScript runs in <head> before any CSS loads.
// It does two things:
//   1. Sets an inline background-color on <html> matching the current theme
//      and WCO state so the correct colour is present from the very first
//      paint, eliminating the white/gray flash in the title-bar area.
//   2. Toggles the `wco` class when Window Controls Overlay is active.
const wcoBootScript = `<script>
(function(){
  var chromeBgs = {dark:'#0f0f14',light:'#ddddda',nord:'#292f3a',dracula:'#242631'};
  var bodyBgs   = {dark:'#111116',light:'#f6f5f2',nord:'#2e3440',dracula:'#282a36'};
  var o = navigator.windowControlsOverlay;
  function serverTheme(){
    var m = document.querySelector('meta[name="pi-web-theme"]');
    return m && m.content ? m.content : '';
  }
  function applyBg(){
    var t = serverTheme();
    if(!t){ try{ t = localStorage.getItem('pi-web-theme') || 'dark'; }catch(e){ t = 'dark'; } }
    var isWCO = o && o.visible;
    var map = isWCO ? chromeBgs : bodyBgs;
    document.documentElement.style.backgroundColor = map[t] || map.dark;
  }
  applyBg();
  if(!o) return;
  function sync(){
    document.documentElement.classList.toggle('wco', !!o.visible);
    applyBg();
  }
  sync();
  try{ o.addEventListener('geometrychange', sync); }catch(e){}
})();
</script>`

func renderLiveDocumentStart(data liveDocumentData) string {
	var b strings.Builder
	b.WriteString("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n")
	b.WriteString("<meta charset=\"UTF-8\">\n")
	b.WriteString("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, interactive-widget=resizes-content\">\n")
	b.WriteString("<title>")
	b.WriteString(template.HTMLEscapeString(data.Title))
	b.WriteString("</title>\n")
	if data.Preload != "" {
		b.WriteString(string(data.Preload))
		b.WriteByte('\n')
	}
	b.WriteString("<link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon.svg\">\n")
	b.WriteString("<link rel=\"apple-touch-icon\" href=\"/icon.svg\">\n")
	b.WriteString("<link rel=\"manifest\" href=\"/manifest.webmanifest\">\n")
	b.WriteString("<meta name=\"theme-color\" content=\"#0e0e13\">\n")
	b.WriteString("<meta name=\"mobile-web-app-capable\" content=\"yes\">\n")
	b.WriteString("<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\">\n")
	b.WriteString("<meta name=\"apple-mobile-web-app-title\" content=\"Pi Sessions\">\n")
	b.WriteString("<meta name=\"pi-web-theme\" content=\"")
	b.WriteString(template.HTMLEscapeString(themeProvider()))
	b.WriteString("\">\n")
	b.WriteString(wcoBootScript)
	b.WriteByte('\n')
	if data.Styles != "" {
		b.WriteString(string(data.Styles))
		b.WriteByte('\n')
	}
	b.WriteString("<link rel=\"stylesheet\" href=\"/custom-themes.css\">\n")
	fontUI, fontContent, fontUISize, fontContentSize := fontProvider()
	b.WriteString("<style id=\"pi-web-fonts\">:root{--font-sans:")
	b.WriteString(fontUI)
	b.WriteString(";--font-content:")
	b.WriteString(fontContent)
	b.WriteString(";--font-size-ui:")
	b.WriteString(fontUISize)
	b.WriteString("px;--font-content-size:")
	b.WriteString(fontContentSize)
	b.WriteString("px;}</style>\n")
	b.WriteString("</head>\n<body")
	if data.BodyAttrs != "" {
		b.WriteString(string(data.BodyAttrs))
	}
	b.WriteString(">\n")
	return b.String()
}

func liveDocumentStart(title string, preload, styles template.HTML) template.HTML {
	return template.HTML(renderLiveDocumentStart(liveDocumentData{
		Title:   title,
		Preload: preload,
		Styles:  styles,
	}))
}

func liveThemeBootScript() template.HTML {
	return themeBootScript("dark")
}

func themeBootScript(defaultTheme string) template.HTML {
	if defaultTheme == "" {
		defaultTheme = "dark"
	}
	return template.HTML(fmt.Sprintf(`<script>
(function(){
  var STORAGE_KEY = 'pi-web-theme';
  var themes = ['dark', 'light', 'nord', 'dracula', 'custom'];
  function applyTheme(t){ document.documentElement.dataset.theme = t || 'dark'; }
  function currentTheme(){ return document.documentElement.dataset.theme || 'dark'; }
  function updateBtn(){
    var t = currentTheme();
    var icon = '◐';
    if(t === 'light') icon = '☀';
    else if(t === 'nord') icon = '❄';
    else if(t === 'dracula') icon = '🧛';
    else if(t === 'custom') icon = '⚙';
    document.querySelectorAll('[data-theme-icon]').forEach(function(el){ el.textContent = icon; });
    document.querySelectorAll('[data-command-theme-icon]').forEach(function(el){ el.textContent = icon; });
    var isWCO = navigator.windowControlsOverlay && navigator.windowControlsOverlay.visible;
    var chromeBg = '#0f0f14', bodyBg = '#111116';
    if(t === 'light')   { chromeBg = '#ddddda'; bodyBg = '#f6f5f2'; }
    else if(t === 'nord')    { chromeBg = '#292f3a'; bodyBg = '#2e3440'; }
    else if(t === 'dracula') { chromeBg = '#242631'; bodyBg = '#282a36'; }
    var color = isWCO ? chromeBg : bodyBg;
    document.documentElement.style.backgroundColor = color;
    var meta = document.querySelector('meta[name="theme-color"]');
    if(meta) { meta.content = color; }
  }
  function toggleTheme(){
    var idx = themes.indexOf(currentTheme());
    if(idx === -1) idx = 0;
    var next = themes[(idx + 1) %% themes.length];
    applyTheme(next);
    try{ localStorage.setItem(STORAGE_KEY, next); }catch(e){}
    try{ document.cookie = 'pi-web-theme=' + next + ';path=/;SameSite=Lax;max-age=31536000'; }catch(e){}
    updateBtn();
  }
  var defaultTheme = '%s';
  function serverTheme(){
    var m = document.querySelector('meta[name="pi-web-theme"]');
    return m && m.content ? m.content : '';
  }
  // The server-injected meta tag is the source of truth (shared across
  // browsers). Fall back to localStorage, then the build-time default. Sync the
  // resolved value back into localStorage so other modules stay consistent.
  var resolved = serverTheme();
  try{ if(!resolved) resolved = localStorage.getItem(STORAGE_KEY) || defaultTheme; }catch(e){ if(!resolved) resolved = defaultTheme; }
  applyTheme(resolved);
  try{ localStorage.setItem(STORAGE_KEY, resolved); }catch(e){}
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      updateBtn();
      var btn = document.getElementById('theme-toggle');
      if(btn) btn.addEventListener('click', toggleTheme);
    });
  } else {
    updateBtn();
    var btn = document.getElementById('theme-toggle');
    if(btn) btn.addEventListener('click', toggleTheme);
  }
})();
</script>`, defaultTheme))
}

func liveServiceWorkerScript() template.HTML {
	return template.HTML(`<script>if('serviceWorker' in navigator && window.isSecureContext){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});});}</script>`)
}

func liveDocumentEnd() template.HTML { return template.HTML("</body>\n</html>") }

func indexStylesheets() template.HTML {
	return template.HTML(`<link rel="stylesheet" href="/theme.css">
<link rel="stylesheet" href="/index.css">
<link rel="stylesheet" href="/menu.css">
<link rel="stylesheet" href="/palette.css">`)
}
