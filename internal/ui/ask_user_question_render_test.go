package ui

import (
	"strings"
	"testing"
)

func TestAskUserQuestionToolHasDedicatedRenderer(t *testing.T) {
	checks := []string{
		"case 'ask_user_question':",
		"case 'pi_web_ask_user_question':",
		"renderAskUserQuestionTool(args, result)",
		"ask-question-card",
		"ask-question-option",
	}
	for _, check := range checks {
		if !strings.Contains(exportJs+liveSessionCss, check) {
			t.Fatalf("missing %q; ask_user_question should not render as raw JSON", check)
		}
	}
}

func TestAskUserQuestionHonorsMultiSelect(t *testing.T) {
	checks := []string{
		"const anyMultiSelect = questions.some(q => q && q.multiSelect === true);",
		"const needsSubmit = isMulti || anyMultiSelect;",
		"data-needs-submit=",
		"data-multi-select=",
	}
	for _, check := range checks {
		if !strings.Contains(exportJs, check) {
			t.Fatalf("missing %q; multi-select questions must be answerable via collect-then-submit", check)
		}
	}
}

func TestAskUserQuestionAwaitingChatReplyStaysClickable(t *testing.T) {
	checks := []string{
		"const awaitingChatReply = result?.details?.awaitingChatReply === true;",
		"|| awaitingChatReply",
	}
	for _, check := range checks {
		if !strings.Contains(exportJs, check) {
			t.Fatalf("missing %q; pi-ask awaitingChatReply results must render as pending/clickable, not answered", check)
		}
	}
}

func TestErroredAskUserQuestionKeepsFallbackOptionsClickable(t *testing.T) {
	checks := []string{
		"const questionToolFailed = result?.isError === true;",
		"question UI failed",
		"const canClick = !result || questionToolFailed || awaitingChatReply;",
		"Use these options as a fallback",
	}
	for _, check := range checks {
		if !strings.Contains(exportJs, check) {
			t.Fatalf("missing %q; errored multi-question cards should remain answerable", check)
		}
	}
}
