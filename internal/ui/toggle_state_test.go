package ui

import (
	"os"
	"strings"
	"testing"
)

// Toggle-state behavior is owned by the shared modules (toggle-state.js,
// session-ui-runner.js) plus the header markup (SessionInfoHeader.svelte) and
// session CSS. Live and static export both reuse these, so assert against the
// source rather than the minified export bundle.
func readSrc(t *testing.T, rel string) string {
	t.Helper()
	data, err := os.ReadFile(repoPath(rel))
	if err != nil {
		t.Fatalf("read %s: %v", rel, err)
	}
	return string(data)
}

func TestSessionToggleButtonsReflectPersistedActiveState(t *testing.T) {
	toggleSrc := readSrc(t, "web/src/session/ui/toggle-state.js")
	runnerSrc := readSrc(t, "web/src/session/ui/session-ui-runner.js")
	// The header toggle-button markup now lives in the Svelte header card.
	headerSrc := readSrc(t, "web/src/components/session/SessionInfoHeader.svelte")

	srcChecks := map[string][]string{
		toggleSrc: {
			"const TOGGLE_STATE_STORAGE_KEY = 'pi.sessionDetail.toggleState';",
			"toolsVisible: true",
			"toolOutputsExpanded: false",
			"storage?.getItem(TOGGLE_STATE_STORAGE_KEY)",
			"storage?.setItem(TOGGLE_STATE_STORAGE_KEY, JSON.stringify(state));",
			"btn.classList.toggle('active', isActive);",
			"btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');",
		},
		runnerSrc: {"windowImpl.sessionToggleState = toggleController;"},
		headerSrc: {`data-action="toggle-tool-output"`, "show/hide thinking"},
	}
	for src, checks := range srcChecks {
		for _, check := range checks {
			if !strings.Contains(src, check) {
				t.Fatalf("session toggle controls missing persisted active-state behavior %q", check)
			}
		}
	}
	if !strings.Contains(liveSessionCss, ".header-toggle-btn.active") {
		t.Fatal("session CSS missing .header-toggle-btn.active styling")
	}
}

func TestToolsVisibilityAndOutputExpansionAreSeparateStates(t *testing.T) {
	src := readSrc(t, "web/src/session/ui/toggle-state.js")
	checks := []string{
		"node.querySelectorAll('.tool-execution, .compaction').forEach(el => {",
		"el.style.display = state.toolsVisible ? '' : 'none';",
		"node.querySelectorAll('.tool-output.expandable').forEach(el => {",
		"el.classList.toggle('expanded', state.toolOutputsExpanded);",
		"toggleToolsVisibility: () => toggle('toolsVisible'),",
		"toggleToolOutputs: () => toggle('toolOutputsExpanded'),",
	}
	for _, check := range checks {
		if !strings.Contains(src, check) {
			t.Fatalf("tools visibility and output expansion are not separate; missing %q", check)
		}
	}
}

func TestNavigationReappliesCurrentToggleStateAfterRenderingMessages(t *testing.T) {
	// The message pane is now rendered by the reactive <SessionContent>, which
	// runs an afterRender(container) hook after each (re)render; session.js wires
	// that hook to re-apply persisted toggle state via applyToggleStateToNode.
	contentSrc := readSrc(t, "web/src/components/session/SessionContent.svelte")
	sessionSrc := readSrc(t, "web/src/session/session.js")
	srcChecks := map[string][]string{
		contentSrc: {"afterRender(containerEl)"},
		sessionSrc: {
			"contentRuntime.afterRender =",
			"target.applyToggleStateToNode?.(container)",
		},
	}
	for src, checks := range srcChecks {
		for _, check := range checks {
			if !strings.Contains(src, check) {
				t.Fatalf("message pane does not reapply persisted toggle state after rendering; missing %q", check)
			}
		}
	}
}

func TestLiveReloadUpdatesExistingAssistantWhenToolResultsArrive(t *testing.T) {
	entriesSrc, err := os.ReadFile(repoPath("web/src/session/live/live-entries.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-entries.js: %v", err)
	}
	eventsSrc, err := os.ReadFile(repoPath("web/src/session/live/live-events.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-events.js: %v", err)
	}
	combined := string(entriesSrc) + string(eventsSrc)
	checks := []string{
		"export function upsertEntry(",
		".replaceWith(node)",
		"state.liveRendered.add(entry.id)",
		"liveRendered.has(entry.id)",
		"export function refreshEntriesAffectedByToolResult(",
		"block.type === 'toolCall'",
		"block.id === toolResultEntry.message.toolCallId",
		"refreshEntriesAffectedByToolResult(entry, entries)",
	}
	for _, check := range checks {
		if !strings.Contains(combined, check) {
			t.Fatalf("live reload does not refresh existing assistant entries when tool results arrive; missing %q", check)
		}
	}
}

func TestLiveReloadEntriesInheritCurrentToggleState(t *testing.T) {
	// A single shared applyToggleStateToNode hook is reused by the controller,
	// the live reload path, and static export — assert it exists in source.
	toggleSrc := readSrc(t, "web/src/session/ui/toggle-state.js")
	runnerSrc := readSrc(t, "web/src/session/ui/session-ui-runner.js")
	hookChecks := map[string][]string{
		toggleSrc: {
			"export function applyToggleStateToNode(node, state) {",
			"const applyToNode = (node) => applyToggleStateToNode(node, state);",
		},
		runnerSrc: {"windowImpl.applyToggleStateToNode = (node) => toggleController.applyToNode(node);"},
	}
	for src, checks := range hookChecks {
		for _, check := range checks {
			if !strings.Contains(src, check) {
				t.Fatalf("template JS missing reusable toggle-state hook %q", check)
			}
		}
	}

	liveReloadChecks := []string{
		"applyToggleStateToNode: window.applyToggleStateToNode",
		"applyToggleStateToNode?.(node)",
	}
	liveRunner, err := os.ReadFile(repoPath("web/src/session/live/live-reload-runner.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-reload-runner.js: %v", err)
	}
	liveEntries, err := os.ReadFile(repoPath("web/src/session/live/live-entries.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-entries.js: %v", err)
	}
	combined := string(liveRunner) + string(liveEntries)
	for _, check := range liveReloadChecks {
		if !strings.Contains(combined, check) {
			t.Fatalf("live reload JS does not apply current toggle state to appended or replaced entries; missing %q", check)
		}
	}
}

func TestLiveReloadRendererUsesToggleableThinkingAndToolMarkup(t *testing.T) {
	source, err := os.ReadFile(repoPath("web/src/session/live/live-renderer.js"))
	if err != nil {
		t.Fatalf("read web/src/session/live/live-renderer.js: %v", err)
	}
	checks := []string{
		`<div class="thinking-block"><div class="thinking-text">`,
		`<div class="thinking-collapsed">Thinking ...</div>`,
		`tool-output expandable`,
		`output-preview`,
		`output-full`,
	}
	for _, check := range checks {
		if !strings.Contains(string(source), check) {
			t.Fatalf("live reload renderer missing toggle-compatible markup %q", check)
		}
	}
}
