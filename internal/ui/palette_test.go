package ui

import (
	"strings"
	"testing"
)

func TestRenderPalette_Index(t *testing.T) {
	html := string(renderPalette(paletteData{
		ID:       "sessionPalette",
		Label:    "List sessions",
		SearchID: "session-palette-search",
		Actions:  true,
	}))

	if !strings.Contains(html, `id="sessionPalette"`) {
		t.Error("missing palette id")
	}
	if !strings.Contains(html, `id="session-palette-search"`) {
		t.Error("missing search input id")
	}
	if !strings.Contains(html, `aria-label="List sessions"`) {
		t.Error("missing aria label")
	}
	if !strings.Contains(html, "Actions") {
		t.Error("missing actions section")
	}
	if !strings.Contains(html, "New session") {
		t.Error("missing new session button")
	}
}

func TestRenderPalette_Session(t *testing.T) {
	html := string(renderPalette(paletteData{
		ID:       "sessionPalette",
		Label:    "List sessions",
		SearchID: "session-palette-search",
		Actions:  false,
	}))

	if !strings.Contains(html, `id="sessionPalette"`) {
		t.Error("missing palette id")
	}
	if !strings.Contains(html, `id="session-palette-search"`) {
		t.Error("missing search input id")
	}
	if !strings.Contains(html, `aria-label="List sessions"`) {
		t.Error("missing aria label")
	}
	if strings.Contains(html, "Actions") {
		t.Error("actions should not appear when Actions=false")
	}
	if strings.Contains(html, "New session") {
		t.Error("new session button should not appear when Actions=false")
	}
}

func TestRenderPalette_Structure(t *testing.T) {
	html := string(renderPalette(paletteData{
		ID:       "test",
		Label:    "Test",
		SearchID: "test-search",
		Actions:  false,
	}))

	if !strings.Contains(html, `class="command-palette-overlay"`) {
		t.Error("missing overlay class")
	}
	if !strings.Contains(html, `role="dialog"`) {
		t.Error("missing dialog role")
	}
	if !strings.Contains(html, `aria-modal="true"`) {
		t.Error("missing aria-modal")
	}
	if !strings.Contains(html, `class="palette-results"`) {
		t.Error("missing results container")
	}
	if !strings.Contains(html, `data-palette-results`) {
		t.Error("missing results data attr")
	}
	if !strings.Contains(html, `placeholder="Search sessions..."`) {
		t.Error("missing placeholder")
	}
	if !strings.Contains(html, `autocomplete="off"`) {
		t.Error("missing autocomplete off")
	}
}
