package ui

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"pi-web/internal/sessions"
)

func minimalSessionForExport() sessions.Session {
	return sessions.Session{
		SessionSummary: sessions.SessionSummary{ID: "test.jsonl", Filename: "test.jsonl", ChatAvailable: true},
		Header:         map[string]any{"cwd": "/tmp", "name": "Test"},
		Entries:        []map[string]any{},
	}
}

func TestSessionViteSourceIncludesChatPreviewSSEHandling(t *testing.T) {
	events, err := os.ReadFile(repoPath("web/src/session/live/live-events.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-events.js: %v", err)
	}
	preview, err := os.ReadFile(repoPath("web/src/session/live/chat-preview.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/chat-preview.js: %v", err)
	}
	runner, err := os.ReadFile(repoPath("web/src/session/live/live-reload-runner.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-reload-runner.js: %v", err)
	}
	combined := string(events) + string(preview) + string(runner)
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
	runner, err := os.ReadFile(repoPath("web/src/session/live/live-reload-runner.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-reload-runner.js: %v", err)
	}
	scroll, err := os.ReadFile(repoPath("web/src/session/live/live-scroll.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-scroll.js: %v", err)
	}
	events, err := os.ReadFile(repoPath("web/src/session/live/live-events.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-events.js: %v", err)
	}
	combined := string(runner) + string(scroll) + string(events)
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
	for _, want := range []string{
		"working<span class=\"working-dots\"",
		"chat-preview-working-dots",
		"animation: chat-preview-working-dots",
	} {
		if !strings.Contains(string(preview), want) && !strings.Contains(liveSessionCss, want) {
			t.Fatalf("session frontend source missing %q", want)
		}
	}
}

func TestGenerateExportHtmlIncludesChatComposerWhenButtonsShown(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Filename: "s.jsonl"}, Entries: []map[string]any{{"id": "aaaaaaaa"}}}
	html := renderLiveSessionPage(session)
	if !strings.Contains(html, `id="pi-chat-composer"`) {
		t.Fatalf("chat composer missing from local session page")
	}
	if !strings.Contains(html, `data-session-id="s.jsonl"`) {
		t.Fatalf("session id missing from composer")
	}
}

func TestGenerateExportHtmlOmitsChatComposerForShare(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Filename: "s.jsonl"}, Entries: []map[string]any{{"id": "aaaaaaaa"}}}
	html := RenderExportSessionPage(session, "dark")
	if strings.Contains(html, `id="pi-chat-composer"`) {
		t.Fatalf("chat composer should not be included in share export")
	}
}

func TestPrepareSessionPageDataUsesLastEntryWithIDAsLeaf(t *testing.T) {
	session := sessions.Session{Entries: []map[string]any{
		{"id": "root"},
		{"id": "leaf"},
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

func TestGenerateExportHtmlIncludesResumeButtonWhenButtonsShown(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Filename: "s.jsonl", SessionUUID: "019e122d-bcc4-7308-8a30-7ef83dae1983"}, Entries: []map[string]any{{"id": "aaaaaaaa"}}}
	html := renderLiveSessionPage(session)
	if !strings.Contains(html, `id="resume-btn"`) {
		t.Fatalf("resume button missing from local session page")
	}
	if !strings.Contains(html, `Terminal`) {
		t.Fatalf("resume button text missing from local session page")
	}
	if !strings.Contains(html, `data-session-uuid="019e122d-bcc4-7308-8a30-7ef83dae1983"`) {
		t.Fatalf("real session UUID missing from body data attribute")
	}
}

func TestShareResultCopyButtonsUseClipboardFallbackAndToast(t *testing.T) {
	source, err := os.ReadFile(repoPath("web/src/session/live/share-overlay.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/share-overlay.js: %v", err)
	}
	for _, want := range []string{
		"export function copyShareUrl(",
		"navigatorImpl.clipboard && navigatorImpl.clipboard.writeText",
		"documentImpl.execCommand('copy')",
		"share-copy-notice",
		"label + ' copied'",
	} {
		if !strings.Contains(string(source), want) {
			t.Fatalf("share copy source missing %q", want)
		}
	}
}

func TestResumeButtonClipboardGuardAndFallback(t *testing.T) {
	source, err := os.ReadFile(repoPath("web/src/session/live/resume-button.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/resume-button.js: %v", err)
	}
	if !strings.Contains(string(source), "navigatorImpl.clipboard && navigatorImpl.clipboard.writeText") {
		t.Fatalf("resume clipboard code should guard navigator.clipboard before writeText")
	}
	if !strings.Contains(string(source), "documentImpl.execCommand('copy')") {
		t.Fatalf("resume clipboard code should include execCommand fallback")
	}
}

func TestResumeButtonShowsToastWithoutChangingButtonText(t *testing.T) {
	source, err := os.ReadFile(repoPath("web/src/session/live/resume-button.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/resume-button.js: %v", err)
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
	if !strings.Contains(src, `documentImpl.body.dataset.sessionUuid`) {
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

func TestGenerateExportHtmlShowsDisabledChatNoticeForBrokenSession(t *testing.T) {
	session := sessions.Session{
		SessionSummary: sessions.SessionSummary{
			ID:                 "s.jsonl",
			Filename:           "s.jsonl",
			ChatAvailable:      false,
			ChatDisabledReason: "This session can be viewed, but chat is disabled because its working directory no longer exists.",
		},
		Entries: []map[string]any{{"id": "aaaaaaaa"}},
	}
	html := renderLiveSessionPage(session)
	if !strings.Contains(html, `data-chat-available="false"`) {
		t.Fatalf("broken session should mark chat unavailable")
	}
	if !strings.Contains(html, session.ChatDisabledReason) {
		t.Fatalf("broken session notice missing from html")
	}
	if !strings.Contains(html, `disabled`) {
		t.Fatalf("broken session should disable chat controls")
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

