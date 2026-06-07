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
		runnerSrc: {"sessionRuntime.toggleState = toggleController;"},
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
	// runs an afterRender(container) hook after each (re)render; the live content
	// runtime wires that hook to re-apply persisted toggle state via
	// applyToggleStateToNode.
	contentSrc := readSrc(t, "web/src/components/session/SessionContent.svelte")
	runtimeSrc := readSrc(t, "web/src/session/session-content-runtime.js")
	srcChecks := map[string][]string{
		contentSrc: {"afterRender(containerEl)"},
		runtimeSrc: {
			"contentRuntime.afterRender =",
			"sessionRuntime.toggleState?.applyToNode(container)",
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

func TestLiveReloadEntriesInheritCurrentToggleState(t *testing.T) {
	// A single shared applyToggleStateToNode hook is reused by the controller and
	// static export. Live reload no longer patches the DOM (the reactive model +
	// <SessionContent>'s afterRender re-apply toggle state — see
	// TestNavigationReappliesCurrentToggleStateAfterRenderingMessages), so only
	// the shared hook's existence is asserted here.
	toggleSrc := readSrc(t, "web/src/session/ui/toggle-state.js")
	runnerSrc := readSrc(t, "web/src/session/ui/session-ui-runner.js")
	hookChecks := map[string][]string{
		toggleSrc: {
			"export function applyToggleStateToNode(node, state) {",
			"const applyToNode = (node) => applyToggleStateToNode(node, state);",
		},
		runnerSrc: {"sessionRuntime.toggleState = toggleController;"},
	}
	for src, checks := range hookChecks {
		for _, check := range checks {
			if !strings.Contains(src, check) {
				t.Fatalf("template JS missing reusable toggle-state hook %q", check)
			}
		}
	}
}

func TestLiveReloadRendererUsesToggleableThinkingAndToolMarkup(t *testing.T) {
	// The message pane is rendered by <SessionEntry> (thinking blocks) + its
	// <ToolOutput> child (expandable tool output) for both live reload and export;
	// assert the toggle-compatible markup classes survive the decomposition.
	entrySrc := readSrc(t, "web/src/components/session/SessionEntry.svelte")
	outputSrc := readSrc(t, "web/src/components/session/ToolOutput.svelte")
	srcChecks := map[string][]string{
		entrySrc: {`thinking-block`, `Thinking ...`},
		outputSrc: {`tool-output expandable`, `output-preview`, `output-full`},
	}
	for src, checks := range srcChecks {
		for _, check := range checks {
			if !strings.Contains(src, check) {
				t.Fatalf("entry markup missing toggle-compatible class %q", check)
			}
		}
	}
}
