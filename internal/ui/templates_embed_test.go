package ui

import (
	"os"
	"regexp"
	"strings"
	"testing"

	"pi-web/internal/sessions"
)

func TestRenderedExportPageReplacesKnownPlaceholders(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Name: "Session"}}
	placeholders := []string{
		"{{TITLE}}", "{{SESSION_PRELOAD}}", "{{CSS}}", "{{BODY_ATTRS}}",
		"{{SESSION_DATA}}", "{{SESSION_SCRIPT}}", "{{FIRST_MESSAGE_STUB}}",
		"{{LIVE_DOCUMENT_START}}", "{{LIVE_THEME_BOOT}}", "{{LIVE_SERVICE_WORKER}}", "{{LIVE_DOCUMENT_END}}",
		"{{CHAT_COMPOSER}}", "{{THEME_VARS_DARK}}", "{{THEME_VARS_LIGHT}}",
		"{{BODY_BG}}", "{{CONTAINER_BG}}", "{{INFO_BG}}",
		"{{BODY_BG_LIGHT}}", "{{CONTAINER_BG_LIGHT}}", "{{INFO_BG_LIGHT}}",
		"{{SESSION_PALETTE}}",
	}
	html := RenderExportSessionPage(session, "dark")
	for _, placeholder := range placeholders {
		if strings.Contains(html, placeholder) {
			t.Fatalf("export render leaked template placeholder %s", placeholder)
		}
	}
}

func TestRenderedExportCSSDefinesUsedCustomProperties(t *testing.T) {
	html := RenderExportSessionPage(sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Name: "Session"}}, "dark")
	assertCSSCustomPropertiesDefined(t, "export", html)
}

func assertCSSCustomPropertiesDefined(t *testing.T, name, html string) {
	t.Helper()
	definedRE := regexp.MustCompile(`--([A-Za-z0-9_-]+)\s*:`)
	usedRE := regexp.MustCompile(`var\(--([A-Za-z0-9_-]+)`)
	defined := map[string]bool{}
	for _, match := range definedRE.FindAllStringSubmatch(html, -1) {
		defined[match[1]] = true
	}
	allowedRuntime := map[string]bool{
		"pi-chat-composer-height": true,
		"viewport-height":         true,
	}
	for _, match := range usedRE.FindAllStringSubmatch(html, -1) {
		if !defined[match[1]] && !allowedRuntime[match[1]] {
			t.Fatalf("%s CSS uses undefined custom property --%s", name, match[1])
		}
	}
}

// TestExportBundleIsSelfContained guards the static export runtime built by
// Vite (web/src/export/export-entry.js). The snapshot must run from a single
// inlined <script> with no server, so the bundle may not pull in any live-only
// machinery. If the export entry accidentally imports a module that reaches
// SSE/chat/live-reload, that symbol leaks into this bundle and fails here.
func TestExportBundleIsSelfContained(t *testing.T) {
	if strings.TrimSpace(exportJs) == "" {
		t.Fatal("embedded export.js is empty — run `npm run build:export` (or `make build`) first")
	}
	forbidden := []string{"EventSource", "runLiveReload", "live-reload-runner", "chatComposerRunner"}
	for _, sym := range forbidden {
		if strings.Contains(exportJs, sym) {
			t.Fatalf("export bundle contains live-only symbol %q — a live module leaked into the static export graph", sym)
		}
	}
}

func TestStaticExportKeepsInlineSessionRenderer(t *testing.T) {
	html := RenderExportSessionPage(sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Name: "Session"}}, "dark")
	// The export must inline its own self-contained runtime (the IIFE bundle is
	// exposed under the PiExport global), not pull a server-hosted Vite module.
	if !strings.Contains(html, "PiExport") {
		t.Fatal("static export missing inlined self-contained renderer bundle")
	}
	if strings.Contains(html, `src="/static/assets/session`) {
		t.Fatal("static export should not depend on external Vite session asset")
	}
}

func TestIndexJsSourceReferencesAPINewSession(t *testing.T) {
	data, err := os.ReadFile(repoPath("web/src/index/sessions-page.js"))
	if err != nil {
		t.Fatalf("read web/src/index/sessions-page.js: %v", err)
	}
	if !strings.Contains(string(data), "/api/new-session") {
		t.Fatal("web/src/index/sessions-page.js missing /api/new-session reference")
	}
}

func TestIndexJsSourceReferencesAPIRecentLocations(t *testing.T) {
	data, err := os.ReadFile(repoPath("web/src/index/sessions-page.js"))
	if err != nil {
		t.Fatalf("read web/src/index/sessions-page.js: %v", err)
	}
	if !strings.Contains(string(data), "/api/recent-locations") {
		t.Fatal("web/src/index/sessions-page.js missing /api/recent-locations reference")
	}
}
