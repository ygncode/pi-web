package server

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"pi-web/internal/rpc"
	"pi-web/internal/sessions"
)

const (
	autoTitleSystemPrompt = "You write short session titles. Reply with ONLY a 2-5 word Title Case title summarizing the user's task. No punctuation, no quotes, no extra words."
	autoTitleTimeout      = 25 * time.Second
)

// autoTitleGenerate is the model call, injectable for tests.
var autoTitleGenerate = func(ctx context.Context, opts rpc.PromptOpts) (string, error) {
	return rpc.OneShotPrompt(ctx, opts)
}

func (s *Server) autoTitleEnabled() bool {
	return s.getSetting("pi-web:v1:auto-title:enabled", "true") == "true"
}

// autoTitleEachTurn reports whether titles should refresh on every new user
// message (vs. titling a session just once).
func (s *Server) autoTitleEachTurn() bool {
	return s.getSetting("pi-web:v1:auto-title:mode", "each-turn") == "each-turn"
}

func (s *Server) autoTitleModel() string {
	return strings.TrimSpace(s.getSetting("pi-web:v1:auto-title:model", ""))
}

// maybeAutoTitle generates and applies a session title when appropriate. It is
// safe to call on every observed file change: it cheaply bails when titling is
// disabled or already handled, and runs the (slow) model call off the caller's
// goroutine is the caller's responsibility — invoke it with `go`.
func (s *Server) maybeAutoTitle(sessID string) {
	if sessID == "" || !s.autoTitleEnabled() {
		return
	}
	eachTurn := s.autoTitleEachTurn()

	// Cheap pre-parse gate.
	s.titleMu.Lock()
	if s.titleInFlight[sessID] || s.titleUserOwned[sessID] {
		s.titleMu.Unlock()
		return
	}
	_, titledBefore := s.titledName[sessID]
	if !eachTurn && titledBefore {
		s.titleMu.Unlock()
		return
	}
	s.titleMu.Unlock()

	resolved, err := sessions.ResolveByID(s.sessionsDir, sessID)
	if err != nil {
		return
	}
	inputs, err := sessions.ReadTitleInputs(resolved.Path)
	if err != nil || inputs.UserMsgCount == 0 || strings.TrimSpace(inputs.FirstUserText) == "" {
		return
	}

	s.titleMu.Lock()
	// An explicit name pi-web didn't write (a manual rename or a header name)
	// means the user owns the title — back off for good.
	if inputs.HasExplicitName && !inputs.AutoTitled {
		s.titleUserOwned[sessID] = true
		s.titleMu.Unlock()
		return
	}
	if !eachTurn {
		// Title once: skip if already titled this run, or marked on disk.
		if _, done := s.titledName[sessID]; done || inputs.AutoTitled {
			s.titleMu.Unlock()
			return
		}
	} else if inputs.UserMsgCount <= s.titledCount[sessID] {
		// Each turn: only re-title when a new user message has arrived.
		s.titleMu.Unlock()
		return
	}
	if s.titleInFlight[sessID] {
		s.titleMu.Unlock()
		return
	}
	s.titleInFlight[sessID] = true
	s.titleMu.Unlock()

	// In each-turn mode the title tracks the current focus (latest message);
	// otherwise it summarizes the opening message.
	basis := inputs.FirstUserText
	if eachTurn && inputs.LastUserText != "" {
		basis = inputs.LastUserText
	}
	title := strings.ToValidUTF8(s.generateTitle(basis), "")

	s.titleMu.Lock()
	delete(s.titleInFlight, sessID)
	if title != "" {
		s.titledName[sessID] = title
		s.titledCount[sessID] = inputs.UserMsgCount
	}
	s.titleMu.Unlock()

	if title == "" {
		return
	}
	if err := sessions.AutoTitleSession(resolved.Path, title, s.now); err != nil {
		if !isBrokenPipe(err) {
			fmt.Fprintf(os.Stderr, "auto-title rename failed for %s: %v\n", sessID, err)
		}
		return
	}
	s.broadcast(sessID, "reload")
	s.broadcast(globalSessID, "reload")
}

// generateTitle asks the configured model for a concise title, falling back to
// a local heuristic when the model is unset, errors, or returns nothing usable.
func (s *Server) generateTitle(firstUserText string) string {
	model := s.autoTitleModel()
	if model != "" {
		ctx, cancel := context.WithTimeout(context.Background(), autoTitleTimeout)
		raw, err := autoTitleGenerate(ctx, rpc.PromptOpts{
			Message:      autoTitlePrompt(firstUserText),
			Model:        model,
			SystemPrompt: autoTitleSystemPrompt,
		})
		cancel()
		if err == nil {
			if title := sanitizeTitle(raw); title != "" {
				return title
			}
		} else if !isBrokenPipe(err) {
			fmt.Fprintf(os.Stderr, "auto-title model call failed: %v\n", err)
		}
	}
	return deriveTitleFromInput(firstUserText)
}

func autoTitlePrompt(firstUserText string) string {
	text := strings.TrimSpace(firstUserText)
	if len(text) > 2000 {
		text = text[:2000]
	}
	return "Summarize this task into a 2-5 word Title Case title. Reply with ONLY the title.\n\nTask: " + text
}

// sanitizeTitle trims model output down to a clean title: first non-empty line,
// stripped of surrounding quotes, capped to TitleWordLimit words.
func sanitizeTitle(raw string) string {
	line := strings.TrimSpace(raw)
	if i := strings.IndexByte(line, '\n'); i >= 0 {
		line = strings.TrimSpace(line[:i])
	}
	line = strings.Trim(line, "\"'`")
	line = strings.TrimSpace(line)
	if line == "" {
		return ""
	}
	words := strings.Fields(line)
	if len(words) > titleWordLimit {
		words = words[:titleWordLimit]
	}
	return strings.Join(words, " ")
}
