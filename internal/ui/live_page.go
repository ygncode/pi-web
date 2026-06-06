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
  // Detect WCO via the display-mode media query — the reliable, synchronous
  // signal. navigator.windowControlsOverlay.visible is commonly false during
  // initial load (and the SPA shell renders an empty body first), so relying on
  // it left the .wco class unset and the header showing the standalone body-bg.
  var mql = window.matchMedia('(display-mode: window-controls-overlay)');
  var o = navigator.windowControlsOverlay;
  function isWCO(){ return mql.matches || !!(o && o.visible); }
  function serverTheme(){
    var m = document.querySelector('meta[name="pi-web-theme"]');
    return m && m.content ? m.content : '';
  }
  function applyBg(){
    var t = serverTheme();
    if(!t){ try{ t = localStorage.getItem('pi-web-theme') || 'dark'; }catch(e){ t = 'dark'; } }
    var map = isWCO() ? chromeBgs : bodyBgs;
    document.documentElement.style.backgroundColor = map[t] || map.dark;
  }
  function sync(){
    document.documentElement.classList.toggle('wco', isWCO());
    applyBg();
  }
  sync();
  try{ mql.addEventListener('change', sync); }catch(e){ try{ mql.addListener(sync); }catch(e2){} }
  if(o){ try{ o.addEventListener('geometrychange', sync); }catch(e){} }
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
  // Lucide theme icons, inlined so the indicator is painted before the JS
  // bundle loads. Must match themeIcon() in web/src/shared/icons.js exactly.
  var themeIcons = {
    dark: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" /></svg>',
    light: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>',
    nord: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="m10 20-1.25-2.5L6 18" /><path d="M10 4 8.75 6.5 6 6" /><path d="m14 20 1.25-2.5L18 18" /><path d="m14 4 1.25 2.5L18 6" /><path d="m17 21-3-6h-4" /><path d="m17 3-3 6 1.5 3" /><path d="M2 12h6.5L10 9" /><path d="m20 10-1.5 2 1.5 2" /><path d="M22 12h-6.5L14 15" /><path d="m4 10 1.5 2L4 14" /><path d="m7 21 3-6-1.5-3" /><path d="m7 3 3 6h4" /></svg>',
    dracula: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M9 10h.01" /><path d="M15 10h.01" /><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" /></svg>',
    custom: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" /></svg>'
  };
  function updateBtn(){
    var t = currentTheme();
    var iconSvg = themeIcons[t] || themeIcons.dark;
    document.querySelectorAll('[data-theme-icon]').forEach(function(el){ el.innerHTML = iconSvg; });
    document.querySelectorAll('[data-command-theme-icon]').forEach(function(el){ el.innerHTML = iconSvg; });
    var isWCO = (window.matchMedia && window.matchMedia('(display-mode: window-controls-overlay)').matches) || (navigator.windowControlsOverlay && navigator.windowControlsOverlay.visible);
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
  // Keep theme-color/html background in sync if WCO turns on/off after load.
  try{ window.matchMedia('(display-mode: window-controls-overlay)').addEventListener('change', updateBtn); }catch(e){}
})();
</script>`, defaultTheme))
}

func liveServiceWorkerScript() template.HTML {
	return template.HTML(`<script>if('serviceWorker' in navigator && window.isSecureContext){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});});}</script>`)
}

func liveDocumentEnd() template.HTML { return template.HTML("</body>\n</html>") }
