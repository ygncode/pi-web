package ui

import (
	"strings"
	"testing"
)

func TestAskUserQuestionToolHasDedicatedRenderer(t *testing.T) {
	checks := []string{
		"case 'ask_user_question':",
		"renderAskUserQuestionTool(args, result)",
		"ask-question-card",
		"ask-question-option",
		"data-multiple",
		"ask-question-multiselect",
	}
	for _, check := range checks {
		if !strings.Contains(exportJs+liveSessionCss, check) {
			t.Fatalf("missing %q; ask_user_question should not render as raw JSON", check)
		}
	}
}

func TestErroredAskUserQuestionKeepsFallbackOptionsClickable(t *testing.T) {
	checks := []string{
		"const questionToolFailed = result?.isError === true;",
		"question UI failed",
		"const canClick = !result || questionToolFailed;",
		"Use these options as a fallback",
	}
	for _, check := range checks {
		if !strings.Contains(exportJs, check) {
			t.Fatalf("missing %q; errored multi-question cards should remain answerable", check)
		}
	}
}
