package ui

import (
	"os"
	"strings"
	"testing"
)

// Mobile sidebar close-on-navigate is implemented in the shared sidebar module
// plus the tree node-click handler. After the tree-renderer.js -> Svelte
// <SessionTreeNodes> migration, that handler lives in SessionTree.svelte (live)
// and export-entry.js (static export). Assert against the source.
func TestMobileSidebarClosesWhenNavigatingTree(t *testing.T) {
	sidebarSrc, err := os.ReadFile(repoPath("web/src/session/ui/sidebar.js"))
	if err != nil {
		t.Fatalf("read sidebar.js: %v", err)
	}
	liveTreeSrc, err := os.ReadFile(repoPath("web/src/components/session/SessionTree.svelte"))
	if err != nil {
		t.Fatalf("read SessionTree.svelte: %v", err)
	}
	exportSrc, err := os.ReadFile(repoPath("web/src/export/export-entry.js"))
	if err != nil {
		t.Fatalf("read export-entry.js: %v", err)
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
	if !strings.Contains(string(liveTreeSrc), "sessionRuntime.layout?.closeSidebar") {
		t.Fatal("SessionTree.svelte missing mobile close-on-navigate; sidebar can remain stuck over chat")
	}
	if !strings.Contains(string(exportSrc), "ui.closeSidebar()") {
		t.Fatal("export-entry.js missing mobile close-on-navigate; sidebar can remain stuck over chat")
	}
}

func TestMobileSessionActionsStayAtTopAndHideBehindSidebar(t *testing.T) {
	checks := []string{
		`class="session-header-bar export-only"`,
		"@media (max-width: 900px)",
		".session-header-bar {",
		"position: fixed;",
		"top: 0;",
	}
	combined := liveSessionCss + exportSessionHtml + exportJs
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
