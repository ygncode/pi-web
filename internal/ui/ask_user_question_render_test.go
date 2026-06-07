package ui

import (
	"strings"
	"testing"
)

// These tests assert that the ask_user_question tool renders via the dedicated
// <AskQuestion> component (dispatched from <ToolCall>), shared by the live app
// and the static export. The source is the single source of truth (the export
// bundle is minified), so we check the component source.
func readAskQuestionSrc(t *testing.T) string {
	t.Helper()
	return readSrc(t, "web/src/components/session/ToolCall.svelte") +
		readSrc(t, "web/src/components/session/AskQuestion.svelte")
}

func TestAskUserQuestionToolHasDedicatedRenderer(t *testing.T) {
	src := readAskQuestionSrc(t)
	jsChecks := []string{
		"'ask_user_question'",
		"'pi_web_ask_user_question'",
		"<AskQuestion",
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
	src := readAskQuestionSrc(t)
	checks := []string{
		"questions.some((q) => q && q.multiSelect === true)",
		"isMulti || anyMultiSelect",
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
	src := readAskQuestionSrc(t)
	checks := []string{
		"result?.details?.awaitingChatReply === true",
		"|| awaitingChatReply",
	}
	for _, check := range checks {
		if !strings.Contains(src, check) {
			t.Fatalf("missing %q; pi-ask awaitingChatReply results must render as pending/clickable, not answered", check)
		}
	}
}

func TestErroredAskUserQuestionKeepsFallbackOptionsClickable(t *testing.T) {
	src := readAskQuestionSrc(t)
	checks := []string{
		"result?.isError === true",
		"question UI failed",
		"!result || questionToolFailed || awaitingChatReply",
		"Use these options as a fallback",
	}
	for _, check := range checks {
		if !strings.Contains(src, check) {
			t.Fatalf("missing %q; errored multi-question cards should remain answerable", check)
		}
	}
}
