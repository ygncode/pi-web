package ui

import (
	"bytes"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"html/template"
	"strings"

	"pi-web/internal/git"
	"pi-web/internal/sessions"
)

//go:embed live_templates/session.html
var liveSessionHtml string

var liveSessionTmpl = template.Must(template.New("live_session").Parse(liveSessionHtml))

//go:embed live_templates/styles/theme.css
var liveThemeCss string

//go:embed live_templates/styles/session.css
var liveSessionCss string

//go:embed live_templates/styles/menu.css
var liveMenuCss string

//go:embed live_templates/styles/palette.css
var livePaletteCss string

//go:embed live_templates/chat_composer.html
var chatComposerTmplStr string

var chatComposerTmpl = template.Must(template.New("chat_composer").Parse(chatComposerTmplStr))

// prepareSessionPageData computes the shared payload (base64-encoded session
// data, themed CSS, and body attributes) used by both live and export renders.
func prepareSessionPageData(session sessions.Session, cssTemplate string) (dataBase64, css, bodyAttrs string) {
	leafID := ""
	for i := len(session.Entries) - 1; i >= 0; i-- {
		if id, ok := session.Entries[i]["id"].(string); ok && id != "" {
			leafID = id
			break
		}
	}

	sessionData := map[string]any{
		"header":        session.Header,
		"entries":       session.Entries,
		"name":          session.Name,
		"leafId":        leafID,
		"systemPrompt":  nil,
		"tools":         nil,
		"renderedTools": nil,
	}

	dataJSON, _ := json.Marshal(sessionData)
	dataBase64 = base64.StdEncoding.EncodeToString(dataJSON)

	css = cssTemplate

	if session.SessionUUID != "" {
		bodyAttrs = ` data-session-uuid="` + session.SessionUUID + `"`
	}
	return
}

// renderLiveSessionPage renders the interactive session viewer served at
// /session. It loads the Vite-built session module and includes the chat composer.
func RenderLiveSessionPage(session sessions.Session, scratchpad string) string {
	dataBase64, css, bodyAttrs := prepareSessionPageData(session, liveThemeCss+"\n"+liveSessionCss+"\n"+liveMenuCss+"\n"+livePaletteCss)

	scriptSrc := template.HTMLEscapeString(sessionScriptPath)
	preload := `<link rel="modulepreload" href="` + scriptSrc + `">`
	styles := "<style>\n" + css + "\n  </style>"

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
		Scratchpad         string
		LiveDocumentEnd    template.HTML
	}{
		IsLive:             true,
		Title:              session.Name,
		LiveDocumentStart: template.HTML(renderLiveDocumentStart(liveDocumentData{
			Title:     session.Name,
			Preload:   template.HTML(preload),
			Styles:    template.HTML(styles),
			BodyAttrs: template.HTMLAttr(bodyAttrs),
		})),
		ThemeBoot:          themeBootScript("nord"),
		ServiceWorker:      liveServiceWorkerScript(),
		SessionCommandMenu: sessionDesktopMenuHTML(),
		MobileCommandMenu:  sessionMobileMenuHTML(),
		SessionPalette: renderPalette(paletteData{
			ID:       "sessionPalette",
			Label:    "List sessions",
			SearchID: "session-palette-search",
			Actions:  true,
		}),
		SessionData:      template.JS(dataBase64),
		SessionScript:    template.HTML(`<script type="module" src="` + scriptSrc + `"></script>`),
		FirstMessageStub: template.HTML(firstMessageStub(session)),
		ChatComposer:     template.HTML(chatComposerHtmlForSession(session)),
		Scratchpad:       scratchpad,
		LiveDocumentEnd:  liveDocumentEnd(),
	}

	var buf bytes.Buffer
	if err := liveSessionTmpl.Execute(&buf, data); err != nil {
		return ""
	}
	return buf.String()
}

func renderLiveSessionPage(session sessions.Session) string {
	return RenderLiveSessionPage(session, "")
}

// firstMessageStub returns a minimal HTML stub for the first user message so
// the browser has an LCP candidate before the JS bundle finishes loading.
// The navigator clears #messages and re-renders everything when JS runs.
func firstMessageStub(session sessions.Session) string {
	for _, entry := range session.Entries {
		if entry["type"] != "message" {
			continue
		}
		msg, ok := entry["message"].(map[string]any)
		if !ok {
			continue
		}
		if role, _ := msg["role"].(string); role != "user" {
			continue
		}
		text := sessions.ExtractMessageText(msg["content"])
		if text == "" {
			continue
		}
		if len(text) > 500 {
			text = text[:500]
		}
		return `<div class="user-message" aria-hidden="true"><div class="markdown-content"><p>` +
			template.HTMLEscapeString(text) + `</p></div></div>`
	}
	return ""
}

func chatComposerHtmlForSession(session sessions.Session) string {
	var buf strings.Builder
	chatAvailable := session.ChatAvailable || session.ChatDisabledReason == ""
	cwd := ""
	if session.Header != nil {
		if c, ok := session.Header["cwd"].(string); ok {
			cwd = c
		}
	}
	// Pre-render the model badge from the last-known model in the session so
	// the user doesn't see a flash when the worker-status fetch completes.
	modelLabel := ""
	if session.Model != "" {
		modelLabel = session.Model
		if session.ModelProvider != "" {
			modelLabel = modelLabel + " @ " + session.ModelProvider
		}
	}
	// Pre-render the branch + the correct action control from fast, local git
	// calls so the footer doesn't pop in after the async /api/git/info fetch.
	// PR detection (which can hit the network via gh) stays in that async call.
	gitIsRepo, gitBranch, gitIsDefault, gitHasChanges := false, "", false, false
	if cwd != "" {
		if b, err := git.CurrentBranch(cwd); err == nil {
			gitIsRepo, gitBranch = true, b
			if def := git.DefaultBranch(cwd); def != "" && def == b {
				gitIsDefault = true
			}
			gitHasChanges = git.HasLocalChanges(cwd)
		}
	}
	data := struct {
		SessionID          string
		ChatAvailable      bool
		ChatDisabledReason string
		Cwd                string
		ModelLabel         string
		GitIsRepo          bool
		GitBranch          string
		GitIsDefault       bool
		GitHasChanges      bool
	}{
		SessionID:          session.ID,
		ChatAvailable:      chatAvailable,
		ChatDisabledReason: session.ChatDisabledReason,
		Cwd:                cwd,
		ModelLabel:         modelLabel,
		GitIsRepo:          gitIsRepo,
		GitBranch:          gitBranch,
		GitIsDefault:       gitIsDefault,
		GitHasChanges:      gitHasChanges,
	}
	if !data.ChatAvailable && data.ChatDisabledReason == "" {
		data.ChatDisabledReason = "This session can be viewed, but chat is disabled because its working directory no longer exists."
	}
	if err := chatComposerTmpl.Execute(&buf, data); err != nil {
		return ""
	}
	return buf.String()
}

func replaceRequired(s, placeholder, value string) string {
	if !strings.Contains(s, placeholder) {
		panic("template placeholder " + placeholder + " not found")
	}
	return strings.Replace(s, placeholder, value, 1)
}
