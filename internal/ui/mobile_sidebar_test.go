package ui

import (
	"strings"
	"testing"

	"pi-web/internal/sessions"
)

func TestMobileSidebarClosesWhenNavigatingTree(t *testing.T) {
	checks := []string{
		"function setSidebarOpen(open)",
		"document.body.classList.toggle('sidebar-open', open);",
		"if (isMobileLayout()) closeSidebar();",
	}
	for _, check := range checks {
		if !strings.Contains(exportJs, check) {
			t.Fatalf("template JS missing %q; mobile sidebar can remain stuck over chat", check)
		}
	}
}

func TestMobileSessionActionsStayAtTopAndHideBehindSidebar(t *testing.T) {
	checks := []string{
		`class="session-header-bar"`,
		"@media (max-width: 900px)",
		".session-header-bar {",
		"position: fixed;",
		"top: 0;",
	}
	combined := liveSessionCss + liveSessionHtml + exportJs + chatComposerHtmlForSession(sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl"}}) + renderLiveSessionPage(sessions.Session{SessionSummary: sessions.SessionSummary{ID: "s.jsonl"}})
	for _, check := range checks {
		if !strings.Contains(combined, check) {
			t.Fatalf("mobile action UI missing %q", check)
		}
	}
	// The unified header bar should use top positioning, not bottom.
	cssAfterMobile := liveSessionCss[strings.Index(liveSessionCss, "@media (max-width: 900px)"):]
	headerIdx := strings.Index(cssAfterMobile, ".session-header-bar")
	if headerIdx == -1 {
		t.Fatalf("missing .session-header-bar in mobile media query")
	}
	blockIdx := strings.Index(cssAfterMobile[headerIdx:], "}")
	if blockIdx == -1 {
		t.Fatalf("unclosed .session-header-bar block in mobile media query")
	}
	headerBlock := cssAfterMobile[headerIdx : headerIdx+blockIdx+1]
	if strings.Contains(headerBlock, "\nbottom:") && !strings.Contains(headerBlock, "\nbottom: auto") {
		t.Fatalf("mobile header bar should use top positioning, not bottom, to avoid overlapping chat composer")
	}
}

func TestMobileSessionActionsDoNotCoverHeaderToggleButtons(t *testing.T) {
	checks := []string{
		"padding: calc(52px + env(safe-area-inset-top) + var(--line-height))",
		".header-toggle-btn",
		"data-action=\"toggle-thinking\"",
		"data-action=\"toggle-tools\"",
	}
	combined := liveSessionCss + exportJs
	for _, check := range checks {
		if !strings.Contains(combined, check) {
			t.Fatalf("mobile session header controls missing %q; fixed session actions can cover toggle buttons", check)
		}
	}
}
