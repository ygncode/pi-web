package main

import (
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
	source := liveReloadJsBody
	for _, want := range []string{
		"chat-preview",
		"renderChatPreview",
		"clearChatPreview",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("live reload source missing %q", want)
		}
	}
}

func TestSessionViteSourceForcesFollowOnChatSendAndScrollsNewEntries(t *testing.T) {
	source := liveReloadJsBody
	for _, want := range []string{
		"pi-chat-message-sent",
		"forcePreviewFollowUntil",
		"Date.now() < forcePreviewFollowUntil",
		"forceFollowToBottom",
		"scrollAfterLayout",
		"scrollElementAboveComposer",
		"chatComposerHeight",
		"if (FOLLOW) {\n            scrollAfterLayout(true);",
		"showFollowButton();",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("live reload source missing %q", want)
		}
	}
}

func TestSessionViteSourceShowsAnimatedWorkingPreviewLabel(t *testing.T) {
	for _, want := range []string{
		"working<span class=\"working-dots\"",
		"chat-preview-working-dots",
		"animation: chat-preview-working-dots",
	} {
		if !strings.Contains(liveReloadJsBody, want) && !strings.Contains(templateCss, want) {
			t.Fatalf("session frontend source missing %q", want)
		}
	}
}

func TestGenerateExportHtmlIncludesChatComposerWhenButtonsShown(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Filename: "s.jsonl"}, Entries: []map[string]any{{"id": "aaaaaaaa"}}}
	html := generateExportHtml(session, true)
	if !strings.Contains(html, `id="pi-chat-composer"`) {
		t.Fatalf("chat composer missing from local session page")
	}
	if !strings.Contains(html, `data-session-id="s.jsonl"`) {
		t.Fatalf("session id missing from composer")
	}
}

func TestGenerateExportHtmlOmitsChatComposerForShare(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Filename: "s.jsonl"}, Entries: []map[string]any{{"id": "aaaaaaaa"}}}
	html := generateExportHtml(session, false)
	if strings.Contains(html, `id="pi-chat-composer"`) {
		t.Fatalf("chat composer should not be included in share export")
	}
}

func TestGenerateExportHtmlIncludesResumeButtonWhenButtonsShown(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Filename: "s.jsonl", SessionUUID: "019e122d-bcc4-7308-8a30-7ef83dae1983"}, Entries: []map[string]any{{"id": "aaaaaaaa"}}}
	html := generateExportHtml(session, true)
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
	for _, want := range []string{
		"function copyShareUrl(text, label)",
		"navigator.clipboard && navigator.clipboard.writeText",
		"document.execCommand('copy')",
		"share-copy-notice",
		"label + ' copied'",
	} {
		if !strings.Contains(liveReloadJsBody, want) {
			t.Fatalf("share copy source missing %q", want)
		}
	}
}

func TestResumeButtonClipboardGuardAndFallback(t *testing.T) {
	if !strings.Contains(liveReloadJsBody, "if (navigator.clipboard && navigator.clipboard.writeText) {\n        navigator.clipboard.writeText(cmd)") {
		t.Fatalf("resume clipboard code should guard navigator.clipboard before writeText")
	}
	if !strings.Contains(liveReloadJsBody, `document.execCommand('copy')`) {
		t.Fatalf("resume clipboard code should include execCommand fallback")
	}
}

func TestResumeButtonShowsToastWithoutChangingButtonText(t *testing.T) {
	if strings.Contains(liveReloadJsBody, `resumeBtn.textContent = 'Copied!'`) {
		t.Fatalf("resume button text should not change to Copied")
	}
	if strings.Contains(liveReloadJsBody, `Copied — tap to view`) || strings.Contains(liveReloadJsBody, `notice.onclick`) {
		t.Fatalf("resume copy notification should be a passive toast, not tap-to-expand")
	}
	if !strings.Contains(liveReloadJsBody, `Copied`) || !strings.Contains(liveReloadJsBody, `background:var(--accent);color:var(--body-bg)`) {
		t.Fatalf("resume copy should show an accent-colored toast notification")
	}
	if !strings.Contains(liveReloadJsBody, `document.body.dataset.sessionUuid`) {
		t.Fatalf("resume copy should read real session UUID from body data attribute")
	}
	if !strings.Contains(liveReloadJsBody, `resumeSessionArg`) {
		t.Fatalf("resume copy should derive UUID-only session argument")
	}
}

func TestGenerateExportHtmlOmitsResumeButtonForShare(t *testing.T) {
	session := sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl", Filename: "s.jsonl"}, Entries: []map[string]any{{"id": "aaaaaaaa"}}}
	html := generateExportHtml(session, false)
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
	html := generateExportHtml(session, true)
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
