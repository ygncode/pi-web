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
	// Symbols that uniquely identify live-only machinery (SSE, live-reload, the
	// chat composer, and the tier-3 sidebar panels). If any appears, a shared
	// (tier-2) component imported a live-only module — fix the import, do not
	// loosen this list. See docs/dev/svelte-migration-plan.md §6.
	//
	// NOTE: "fetch(" and "/api/" are NOT yet forbidden — a pre-existing dead
	// (host-less) path still pulls them into the bundle. Add them here once the
	// live-only modules are gone (migration Phase 3 cleanup).
	forbidden := []string{
		"EventSource", "WebSocket",
		"runLiveReload", "live-reload-runner", "live-reload",
		"chatComposerRunner", "ChatComposer",
		"ArtifactPanel", "AnnotationLayer",
	}
	// NOTE: applyLiveUpdate is intentionally NOT forbidden — it is a pure
	// state-replacement method on the SHARED SessionDataModel, which the export
	// now bundles to render the Svelte tree. It touches no SSE/fetch/DOM, so it
	// is not a live-only leak indicator.
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

func TestIndexSourceReferencesAPINewSession(t *testing.T) {
	data, err := os.ReadFile(repoPath("web/src/index/sessions.js"))
	if err != nil {
		t.Fatalf("read web/src/index/sessions.js: %v", err)
	}
	if !strings.Contains(string(data), "/api/new-session") {
		t.Fatal("web/src/index/sessions.js missing /api/new-session reference")
	}
}

func TestIndexSourceReferencesAPIRecentLocations(t *testing.T) {
	data, err := os.ReadFile(repoPath("web/src/index/sessions.js"))
	if err != nil {
		t.Fatalf("read web/src/index/sessions.js: %v", err)
	}
	if !strings.Contains(string(data), "/api/recent-locations") {
		t.Fatal("web/src/index/sessions.js missing /api/recent-locations reference")
	}
}
