package ui

import (
	"os"
	"strings"
	"testing"

	"pi-web/internal/sessions"
)

// Mobile sidebar close-on-navigate is implemented in the shared sidebar and
// tree-renderer modules (used by both live and static export). Assert against
// the source rather than the minified export bundle.
func TestMobileSidebarClosesWhenNavigatingTree(t *testing.T) {
	sidebarSrc, err := os.ReadFile(repoPath("web/src/session/ui/sidebar.js"))
	if err != nil {
		t.Fatalf("read sidebar.js: %v", err)
	}
	treeSrc, err := os.ReadFile(repoPath("web/src/session/tree/tree-renderer.js"))
	if err != nil {
		t.Fatalf("read tree-renderer.js: %v", err)
	}
	sidebarChecks := []string{
		"export function setSidebarOpen(open, { documentImpl = document } = {}) {",
		"documentImpl.body?.classList.toggle('sidebar-open', open);",
	}
	for _, check := range sidebarChecks {
		if !strings.Contains(string(sidebarSrc), check) {
			t.Fatalf("sidebar.js missing %q; mobile sidebar can remain stuck over chat", check)
		}
	}
	if !strings.Contains(string(treeSrc), "if (isMobileLayout()) closeSidebar();") {
		t.Fatal("tree-renderer.js missing mobile close-on-navigate; sidebar can remain stuck over chat")
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
		"padding: calc(52px + env(safe-area-inset-top) + 8px)",
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
