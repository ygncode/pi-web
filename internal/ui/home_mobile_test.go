package ui

import (
	"bytes"
	"strings"
	"testing"

	"pi-web/internal/sessions"
)

func TestHomePageMobilePreventsHorizontalOverflow(t *testing.T) {
	checks := []string{
		"overflow-x: hidden;",
		"min-width: 0;",
		"overflow-wrap: anywhere;",
	}
	for _, check := range checks {
		if !strings.Contains(indexCSS, check) {
			t.Fatalf("home page CSS missing %q; mobile home page can create horizontal scrollbar", check)
		}
	}
}

func TestHomePageRunningCountHasWorkspaceSummary(t *testing.T) {
	html := indexTmpl.Tree.Root.String()
	htmlChecks := []string{
		`<div class="workspace-summary">`,
		`<span class="stat-running" id="statRunning" data-running-stat>`,
	}
	for _, check := range htmlChecks {
		if !strings.Contains(html, check) {
			t.Fatalf("home running-count workspace UI missing %q", check)
		}
	}
	cssChecks := []string{
		".workspace-summary {",
		".stat-running.visible { display: inline-flex; }",
		".status-dot {",
	}
	for _, check := range cssChecks {
		if !strings.Contains(indexCSS, check) {
			t.Fatalf("home running-count workspace CSS missing %q", check)
		}
	}
}

func TestHomePageNewSessionEntryPointsExist(t *testing.T) {
	var buf bytes.Buffer
	if err := indexTmpl.Execute(&buf, []sessions.Session{}); err != nil {
		t.Fatalf("failed to render index template: %v", err)
	}
	html := buf.String()
	htmlChecks := []string{
		`data-new-session-btn`,
		`class="new-session-btn new-session-btn-mobile"`,
		`Start a new session`,
		`New Session`,
		`New session`,
	}
	for _, check := range htmlChecks {
		if !strings.Contains(html, check) {
			t.Fatalf("home new-session entry point missing %q", check)
		}
	}
	// palette is rendered via {{ paletteHTML }} — check rendered output
	paletteChecks := []string{
		`id="sessionPalette"`,
		`id="web-menu"`,
	}
	for _, check := range paletteChecks {
		if !strings.Contains(html, check) {
			t.Fatalf("home palette/menu entry point missing %q", check)
		}
	}
	css := indexCSS + "\n" + menuCSS + "\n" + paletteCSS
	cssChecks := []string{
		".command-palette-overlay {",
		".web-menu {",
		".palette-action",
		".new-session-btn-mobile",
		"position: fixed;",
	}
	for _, check := range cssChecks {
		if !strings.Contains(css, check) {
			t.Fatalf("home new-session entry point CSS missing %q", check)
		}
	}
}

func TestHomePageLayoutToggleExists(t *testing.T) {
	var buf bytes.Buffer
	if err := indexTmpl.Execute(&buf, []sessions.Session{}); err != nil {
		t.Fatalf("failed to render index template: %v", err)
	}
	html := buf.String()
	checks := []string{
		`data-layout-btn="timeline"`,
		`data-layout-btn="projects"`,
		`Session layout`,
		`dataset.sessionLayout`,
		`pi-sessions:view-layout`,
	}
	for _, check := range checks {
		if !strings.Contains(html, check) {
			t.Fatalf("home layout toggle missing %q", check)
		}
	}
	cssChecks := []string{
		`.layout-toggle`,
		`.layout-toggle button[aria-pressed="true"]`,
		`[data-session-layout="projects"] [data-sessions-content]:not(.index-layout-ready)`,
	}
	for _, check := range cssChecks {
		if !strings.Contains(indexCSS, check) {
			t.Fatalf("home layout toggle CSS missing %q", check)
		}
	}
}

func TestCommandPaletteSearchExists(t *testing.T) {
	var buf bytes.Buffer
	if err := indexTmpl.Execute(&buf, []sessions.Session{}); err != nil {
		t.Fatalf("failed to render index template: %v", err)
	}
	html := buf.String()
	checks := []string{
		`id="open-search"`,
		`id="session-palette-search"`,
		`Search sessions...`,
		`⌘K`,
	}
	for _, check := range checks {
		if !strings.Contains(html, check) {
			t.Fatalf("index template rendered output missing %q", check)
		}
	}
}

func TestNewSessionModalExists(t *testing.T) {
	checks := []string{
		`id="modalOverlay"`,
		`class="modal-overlay"`,
		`id="modalBackBtn"`,
		`Start a new session`,
		`id="sessionPath"`,
		`id="createBtn"`,
		`id="cancelBtn"`,
	}
	for _, check := range checks {
		if !strings.Contains(indexTmpl.Tree.Root.String(), check) {
			t.Fatalf("index template missing %q", check)
		}
	}
	cssChecks := []string{
		`.modal-sheet-header`,
		`height: 100%;`,
		`max-height: none;`,
		`transform: translateY(100%);`,
		`.modal-overlay.open .modal { transform: translateY(0); }`,
		`.modal input {`,
		`order: 1;`,
		`.recent-locations {`,
		`order: 2;`,
		`.modal-actions .btn-secondary { display: none; }`,
		`.modal-actions .btn-primary`,
	}
	for _, check := range cssChecks {
		if !strings.Contains(indexCSS, check) {
			t.Fatalf("index CSS missing mobile new-session sheet style %q", check)
		}
	}
}

func TestHomePageMobileSheetsFillOverlayHeight(t *testing.T) {
	checks := []struct {
		name string
		css  string
	}{
		{name: "new session modal", css: indexCSS},
		{name: "command palette", css: paletteCSS},
	}
	for _, check := range checks {
		if !strings.Contains(check.css, `height: 100%;`) {
			t.Fatalf("%s mobile sheet should fill its fixed overlay height", check.name)
		}
		if strings.Contains(check.css, `height: 100svh;`) {
			t.Fatalf("%s mobile sheet should not rely on 100svh, which can leave a top gap on iOS", check.name)
		}
	}
}

func TestHomePageSessionCardsExposeRunningStatusHook(t *testing.T) {
	if !strings.Contains(indexTmplStr, `data-session-id="{{ .ID }}"`) {
		t.Fatal("homepage should expose session ids for running-status cards")
	}
}
