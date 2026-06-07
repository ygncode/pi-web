package ui

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"pi-web/internal/sessions"
)

func TestSessionViteSourceIncludesChatPreviewSSEHandling(t *testing.T) {
	preview, err := os.ReadFile(repoPath("web/src/session/live/chat-preview.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/chat-preview.js: %v", err)
	}
	// The live-reload runner + SSE primitives were absorbed into <LiveReload>.
	runner, err := os.ReadFile(repoPath("web/src/components/session/LiveReload.svelte"))
	if err != nil {
		t.Fatalf("read web/src/components/session/LiveReload.svelte: %v", err)
	}
	combined := string(preview) + string(runner)
	for _, want := range []string{
		"chat-preview",
		"renderChatPreview",
		"clearChatPreview",
	} {
		if !strings.Contains(combined, want) {
			t.Fatalf("live reload source missing %q", want)
		}
	}
}

func TestSessionViteSourceForcesFollowOnChatSendAndScrollsNewEntries(t *testing.T) {
	// Follow/scroll + SSE primitives now live in <LiveReload> (absorbed from
	// live-scroll.js / live-events.js).
	runner, err := os.ReadFile(repoPath("web/src/components/session/LiveReload.svelte"))
	if err != nil {
		t.Fatalf("read web/src/components/session/LiveReload.svelte: %v", err)
	}
	combined := string(runner)
	for _, want := range []string{
		"pi-chat-message-sent",
		"forcePreviewFollowUntil",
		"Date.now() < forcePreviewFollowUntil",
		"forceFollowToBottom",
		"scrollAfterLayout",
		"scrollElementAboveComposer",
		"chatComposerHeight",
		"showFollowButton",
	} {
		if !strings.Contains(combined, want) {
			t.Fatalf("live reload source missing %q", want)
		}
	}
}

func TestSessionViteSourceShowsAnimatedWorkingPreviewLabel(t *testing.T) {
	preview, err := os.ReadFile(repoPath("web/src/session/live/chat-preview.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/chat-preview.js: %v", err)
	}
	runner, err := os.ReadFile(repoPath("web/src/components/session/LiveReload.svelte"))
	if err != nil {
		t.Fatalf("read web/src/components/session/LiveReload.svelte: %v", err)
	}
	combined := string(preview) + string(runner)
	for _, want := range []string{
		"working<span class=\"working-dots\"",
		"chat-preview-working-dots",
		"animation: chat-preview-working-dots",
	} {
		if !strings.Contains(combined, want) && !strings.Contains(liveSessionCss, want) {
			t.Fatalf("session frontend source missing %q", want)
		}
	}
}

func TestGenerateExportHtmlOmitsChatComposerForShare(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Filename: "s.jsonl"}, Entries: []map[string]any{{"id": "aaaaaaaa"}}}
	html := RenderExportSessionPage(session, "dark")
	if strings.Contains(html, `id="pi-chat-composer"`) {
		t.Fatalf("chat composer should not be included in share export")
	}
}

func TestPrepareSessionPageDataUsesLastNonLabelEntryWithIDAsLeaf(t *testing.T) {
	session := sessions.Session{Entries: []map[string]any{
		{"id": "root"},
		{"id": "leaf"},
		{"id": "label1", "type": "label", "targetId": "leaf", "label": "Done"},
		{"type": "session_info", "name": "Renamed"},
	}}
	dataBase64, _, _ := prepareSessionPageData(session, liveSessionCss)
	dataJSON, err := base64.StdEncoding.DecodeString(dataBase64)
	if err != nil {
		t.Fatalf("decode session data: %v", err)
	}
	var payload struct {
		LeafID string `json:"leafId"`
	}
	if err := json.Unmarshal(dataJSON, &payload); err != nil {
		t.Fatalf("unmarshal session data: %v", err)
	}
	if payload.LeafID != "leaf" {
		t.Fatalf("leafId = %q, want leaf", payload.LeafID)
	}
}

func TestShareResultCopyButtonsUseClipboardFallbackAndToast(t *testing.T) {
	// Share UI now lives in the <ShareDialog> Svelte component (absorbed from the
	// former live/share-overlay.js in migration Phase 3).
	source, err := os.ReadFile(repoPath("web/src/components/session/ShareDialog.svelte"))
	if err != nil {
		t.Fatalf("read web/src/components/session/ShareDialog.svelte: %v", err)
	}
	for _, want := range []string{
		"function copyShareUrl(",
		"navigator.clipboard && navigator.clipboard.writeText",
		"document.execCommand('copy')",
		"share-copy-notice",
		"t('share.copiedSuffix', { label })",
	} {
		if !strings.Contains(string(source), want) {
			t.Fatalf("share copy source missing %q", want)
		}
	}
}

func TestResumeButtonClipboardGuardAndFallback(t *testing.T) {
	// Resume behavior now lives in the <SessionHeader> Svelte component
	// (absorbed from the former live/resume-button.js in migration Phase 3).
	source, err := os.ReadFile(repoPath("web/src/components/session/SessionHeader.svelte"))
	if err != nil {
		t.Fatalf("read web/src/components/session/SessionHeader.svelte: %v", err)
	}
	if !strings.Contains(string(source), "navigator.clipboard && navigator.clipboard.writeText") {
		t.Fatalf("resume clipboard code should guard navigator.clipboard before writeText")
	}
	if !strings.Contains(string(source), "document.execCommand('copy')") {
		t.Fatalf("resume clipboard code should include execCommand fallback")
	}
}

func TestResumeButtonShowsToastWithoutChangingButtonText(t *testing.T) {
	source, err := os.ReadFile(repoPath("web/src/components/session/SessionHeader.svelte"))
	if err != nil {
		t.Fatalf("read web/src/components/session/SessionHeader.svelte: %v", err)
	}
	src := string(source)
	if strings.Contains(src, `resumeBtn.textContent = 'Copied!'`) {
		t.Fatalf("resume button text should not change to Copied")
	}
	if strings.Contains(src, `Copied — tap to view`) || strings.Contains(src, `notice.onclick`) {
		t.Fatalf("resume copy notification should be a passive toast, not tap-to-expand")
	}
	if !strings.Contains(src, `Copied`) || !strings.Contains(liveSessionCss, `.toast-notice`) {
		t.Fatalf("resume copy should show an accent-colored toast notification")
	}
	if !strings.Contains(src, `document.body.dataset.sessionUuid`) {
		t.Fatalf("resume copy should read real session UUID from body data attribute")
	}
	if !strings.Contains(src, `resumeSessionArg`) {
		t.Fatalf("resume copy should derive UUID-only session argument")
	}
}

func TestGenerateExportHtmlOmitsResumeButtonForShare(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Filename: "s.jsonl"}, Entries: []map[string]any{{"id": "aaaaaaaa"}}}
	html := RenderExportSessionPage(session, "dark")
	if strings.Contains(html, `id="resume-btn"`) {
		t.Fatalf("resume button should not be included in share export")
	}
}

func TestSanitizeTheme(t *testing.T) {
	valid := []string{"dark", "light", "nord", "dracula", "custom"}
	for _, theme := range valid {
		if got := sanitizeTheme(theme); got != theme {
			t.Errorf("sanitizeTheme(%q) = %q, want %q", theme, got, theme)
		}
	}

	// Anything outside the allowlist must return "dark" to prevent
	// user-controlled cookie values from being injected into the export <script>.
	malicious := []string{
		"'; alert(1); //",
		"dark\"; alert(1); //",
		"unknown",
		"",
		"DARK",
	}
	for _, theme := range malicious {
		if got := sanitizeTheme(theme); got != "dark" {
			t.Errorf("sanitizeTheme(%q) = %q, want \"dark\"", theme, got)
		}
	}
}
