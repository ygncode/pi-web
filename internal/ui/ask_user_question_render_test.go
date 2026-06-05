package ui

import (
	"os"
	"strings"
	"testing"
)

// These tests assert that the shared session entry renderer
// (web/src/session/render/session-entry-renderer.js) implements the
// ask_user_question behavior. Live and static export both bundle this module,
// so the source is the single source of truth — the export bundle is minified,
// so we check the source rather than grepping the built artifact.
func readEntryRendererSrc(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile(repoPath("web/src/session/render/session-entry-renderer.js"))
	if err != nil {
		t.Fatalf("read session-entry-renderer.js: %v", err)
	}
	return string(data)
}

func TestAskUserQuestionToolHasDedicatedRenderer(t *testing.T) {
	src := readEntryRendererSrc(t)
	jsChecks := []string{
		"case 'ask_user_question':",
		"case 'pi_web_ask_user_question':",
		"renderAskUserQuestionTool(args, result)",
	}
	for _, check := range jsChecks {
		if !strings.Contains(src, check) {
			t.Fatalf("missing %q; ask_user_question should not render as raw JSON", check)
		}
	}
	// The card/option chrome is styled in the shared session CSS.
	for _, check := range []string{"ask-question-card", "ask-question-option"} {
		if !strings.Contains(liveSessionCss, check) {
			t.Fatalf("missing %q in session CSS", check)
		}
	}
}

func TestAskUserQuestionHonorsMultiSelect(t *testing.T) {
	src := readEntryRendererSrc(t)
	checks := []string{
		"const anyMultiSelect = questions.some(q => q && q.multiSelect === true);",
		"const needsSubmit = isMulti || anyMultiSelect;",
		"data-needs-submit=",
		"data-multi-select=",
	}
	for _, check := range checks {
		if !strings.Contains(src, check) {
			t.Fatalf("missing %q; multi-select questions must be answerable via collect-then-submit", check)
		}
	}
}

func TestAskUserQuestionAwaitingChatReplyStaysClickable(t *testing.T) {
	src := readEntryRendererSrc(t)
	checks := []string{
		"const awaitingChatReply = result?.details?.awaitingChatReply === true;",
		"|| awaitingChatReply",
	}
	for _, check := range checks {
		if !strings.Contains(src, check) {
			t.Fatalf("missing %q; pi-ask awaitingChatReply results must render as pending/clickable, not answered", check)
		}
	}
}

func TestErroredAskUserQuestionKeepsFallbackOptionsClickable(t *testing.T) {
	src := readEntryRendererSrc(t)
	checks := []string{
		"const questionToolFailed = result?.isError === true;",
		"question UI failed",
		"const canClick = !result || questionToolFailed || awaitingChatReply;",
		"Use these options as a fallback",
	}
	for _, check := range checks {
		if !strings.Contains(src, check) {
			t.Fatalf("missing %q; errored multi-question cards should remain answerable", check)
		}
	}
}
