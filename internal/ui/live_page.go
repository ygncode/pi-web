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

func renderLiveDocumentStart(data liveDocumentData) string {
	var b strings.Builder
	b.WriteString("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n")
	b.WriteString("<meta charset=\"UTF-8\">\n")
	b.WriteString("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1\">\n")
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
	if data.Styles != "" {
		b.WriteString(string(data.Styles))
		b.WriteByte('\n')
	}
	b.WriteString("<link rel=\"stylesheet\" href=\"/custom-themes.css\">\n")
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
    var meta = document.querySelector('meta[name="theme-color"]');
    if(meta) {
      var color = '#111116';
      if(t === 'light') color = '#f6f5f2';
      else if(t === 'nord') color = '#2e3440';
      else if(t === 'dracula') color = '#282a36';
      meta.content = color;
    }
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
  try{ applyTheme(localStorage.getItem(STORAGE_KEY) || defaultTheme); }catch(e){ applyTheme(defaultTheme); }
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
