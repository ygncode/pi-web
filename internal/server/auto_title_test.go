package server

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf8"

	"pi-web/internal/rpc"
	"pi-web/internal/sessions"
)

func TestSanitizeTitle(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Fix Flaky Login Test", "Fix Flaky Login Test"},
		{"  Fix Flaky Login Test  ", "Fix Flaky Login Test"},
		{"\"Quoted Title\"", "Quoted Title"},
		{"Title\nwith a second line", "Title"},
		{"one two three four five six seven", "one two three four five"},
		{"", ""},
		{"   ", ""},
		{"`backticked`", "backticked"},
	}
	for _, c := range cases {
		if got := sanitizeTitle(c.in); got != c.want {
			t.Errorf("sanitizeTitle(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestDeriveTitleFromInput(t *testing.T) {
	cases := []struct{ in, want string }{
		{"", ""},
		{"   ", ""},
		{"the and for", "The And For"},
		{"add a new feature for the dashboard", "Add New Feature Dashboard"},
		{"fix ```js\nconst x = 1;\n``` bug", "Fix Bug"},
		{"check https://example.com/foo for updates", "Check Updates"},
		{"pi-web api ui", "Pi-Web API UI"},
	}
	for _, c := range cases {
		if got := deriveTitleFromInput(c.in); got != c.want {
			t.Errorf("deriveTitleFromInput(%q) = %q, want %q", c.in, got, c.want)
		}
	}

	long := "one two three four five six seven eight"
	if got := deriveTitleFromInput(long); len(strings.Fields(got)) > titleWordLimit {
		t.Errorf("deriveTitleFromInput capped at %d words, got %q", titleWordLimit, got)
	}
}

func TestDeriveTitlePreservesMultibyte(t *testing.T) {
	// Burmese (caseless, 3-byte runes) must survive title-casing without being
	// corrupted into U+FFFD replacement characters.
	in := "yolo ဆိုတာ ဘဝ"
	got := deriveTitleFromInput(in)
	if !utf8.ValidString(got) {
		t.Fatalf("title is not valid UTF-8: %q", got)
	}
	if strings.ContainsRune(got, '�') {
		t.Fatalf("title corrupted with replacement chars: %q", got)
	}
	if !strings.Contains(got, "ဆိုတာ") || !strings.Contains(got, "ဘဝ") {
		t.Fatalf("expected Burmese words preserved, got %q", got)
	}
}

// writeSessionFile creates a minimal session JSONL under sessionsDir and returns
// its id (filename). userText="" writes no user message; name!="" adds a
// session_info name line.
func writeAutoTitleSession(t *testing.T, sessionsDir, userText, name string) string {
	t.Helper()
	project := filepath.Join(sessionsDir, "proj")
	if err := os.MkdirAll(project, 0o755); err != nil {
		t.Fatal(err)
	}
	id := "2026-06-03T00-00-00.000Z_test.jsonl"
	var b strings.Builder
	b.WriteString(`{"type":"session","version":3,"id":"test","cwd":"` + project + `"}` + "\n")
	if userText != "" {
		b.WriteString(`{"type":"message","message":{"role":"user","content":"` + userText + `"}}` + "\n")
	}
	if name != "" {
		b.WriteString(`{"type":"session_info","name":"` + name + `"}` + "\n")
	}
	if err := os.WriteFile(filepath.Join(project, id), []byte(b.String()), 0o644); err != nil {
		t.Fatal(err)
	}
	return id
}

func newAutoTitleServer(t *testing.T, settings map[string]string) *Server {
	t.Helper()
	s := &Server{
		sessionsDir:    t.TempDir(),
		titleInFlight:  make(map[string]bool),
		titledName:     make(map[string]string),
		titledCount:    make(map[string]int),
		titleUserOwned: make(map[string]bool),
	}
	if settings != nil {
		s.db = newSettingsTestDB(t)
		for k, v := range settings {
			if _, err := s.db.Exec(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`, k, v); err != nil {
				t.Fatal(err)
			}
		}
	}
	return s
}

func sessionNameNow(t *testing.T, s *Server, id string) string {
	t.Helper()
	resolved, err := sessions.ResolveByID(s.sessionsDir, id)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	return resolved.Session.Name
}

func TestMaybeAutoTitleHeuristicOnce(t *testing.T) {
	s := newAutoTitleServer(t, map[string]string{"pi-web:v1:auto-title:mode": "once"}) // model="" → heuristic
	id := writeAutoTitleSession(t, s.sessionsDir, "fix the flaky login test", "")

	s.maybeAutoTitle(id)

	if got := sessionNameNow(t, s, id); got != "Fix Flaky Login Test" {
		t.Fatalf("expected heuristic title, got %q", got)
	}
	// Second pass is a no-op (already titled once).
	s.maybeAutoTitle(id)
	if got := sessionNameNow(t, s, id); got != "Fix Flaky Login Test" {
		t.Fatalf("title changed on second pass: %q", got)
	}
}

func TestMaybeAutoTitleUsesModel(t *testing.T) {
	s := newAutoTitleServer(t, map[string]string{"pi-web:v1:auto-title:model": "anthropic/sonnet"})
	id := writeAutoTitleSession(t, s.sessionsDir, "fix the flaky login test", "")

	calls := 0
	restore := autoTitleGenerate
	autoTitleGenerate = func(ctx context.Context, opts rpc.PromptOpts) (string, error) {
		calls++
		if opts.Model != "anthropic/sonnet" {
			t.Errorf("expected model passed through, got %q", opts.Model)
		}
		return "Model Title", nil
	}
	t.Cleanup(func() { autoTitleGenerate = restore })

	s.maybeAutoTitle(id)
	if got := sessionNameNow(t, s, id); got != "Model Title" {
		t.Fatalf("expected model title, got %q", got)
	}
	s.maybeAutoTitle(id)
	if calls != 1 {
		t.Fatalf("expected model called once (de-dupe), got %d", calls)
	}
}

func TestMaybeAutoTitleModelErrorFallsBack(t *testing.T) {
	s := newAutoTitleServer(t, map[string]string{"pi-web:v1:auto-title:model": "anthropic/sonnet"})
	id := writeAutoTitleSession(t, s.sessionsDir, "fix the flaky login test", "")

	restore := autoTitleGenerate
	autoTitleGenerate = func(ctx context.Context, opts rpc.PromptOpts) (string, error) {
		return "", errors.New("model unavailable")
	}
	t.Cleanup(func() { autoTitleGenerate = restore })

	s.maybeAutoTitle(id)
	if got := sessionNameNow(t, s, id); got != "Fix Flaky Login Test" {
		t.Fatalf("expected heuristic fallback, got %q", got)
	}
}

func TestMaybeAutoTitleDisabled(t *testing.T) {
	s := newAutoTitleServer(t, map[string]string{"pi-web:v1:auto-title:enabled": "false"})
	id := writeAutoTitleSession(t, s.sessionsDir, "fix the flaky login test", "")

	s.maybeAutoTitle(id)
	if got := sessionNameNow(t, s, id); got == "Fix Flaky Login Test" {
		t.Fatalf("disabled titling should not rename, got %q", got)
	}
}

func TestMaybeAutoTitleSkipsUserNamed(t *testing.T) {
	s := newAutoTitleServer(t, nil)
	id := writeAutoTitleSession(t, s.sessionsDir, "fix the flaky login test", "My Own Name")

	s.maybeAutoTitle(id)
	if got := sessionNameNow(t, s, id); got != "My Own Name" {
		t.Fatalf("should not clobber user name, got %q", got)
	}
}

func TestMaybeAutoTitleEachTurnUsesLatestMessage(t *testing.T) {
	s := newAutoTitleServer(t, map[string]string{
		"pi-web:v1:auto-title:mode":  "each-turn",
		"pi-web:v1:auto-title:model": "anthropic/sonnet",
	})
	// Two user messages: each-turn should title from the latest one.
	project := filepath.Join(s.sessionsDir, "proj")
	if err := os.MkdirAll(project, 0o755); err != nil {
		t.Fatal(err)
	}
	id := "2026-06-03T00-00-00.000Z_each.jsonl"
	content := `{"type":"session","version":3,"id":"e","cwd":"` + project + `"}` + "\n" +
		`{"type":"message","message":{"role":"user","content":"first task"}}` + "\n" +
		`{"type":"message","message":{"role":"user","content":"second different task"}}` + "\n"
	if err := os.WriteFile(filepath.Join(project, id), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	var seen string
	restore := autoTitleGenerate
	autoTitleGenerate = func(ctx context.Context, opts rpc.PromptOpts) (string, error) {
		seen = opts.Message
		return "Latest Title", nil
	}
	t.Cleanup(func() { autoTitleGenerate = restore })

	s.maybeAutoTitle(id)
	if !strings.Contains(seen, "second different task") {
		t.Fatalf("each-turn should title from the latest message, prompt was %q", seen)
	}
	if got := sessionNameNow(t, s, id); got != "Latest Title" {
		t.Fatalf("expected 'Latest Title', got %q", got)
	}
}

func TestMaybeAutoTitleReTitlesOwnAutoTitleAcrossRestart(t *testing.T) {
	// A fresh server (empty in-memory maps) seeing a session it previously
	// auto-titled must NOT treat it as user-owned, and should re-title in
	// each-turn mode when a new message has arrived.
	s := newAutoTitleServer(t, map[string]string{"pi-web:v1:auto-title:mode": "each-turn"})
	project := filepath.Join(s.sessionsDir, "proj")
	if err := os.MkdirAll(project, 0o755); err != nil {
		t.Fatal(err)
	}
	id := "2026-06-03T00-00-00.000Z_restart.jsonl"
	// Prior auto-title marker + two user messages (a new turn since titling).
	content := `{"type":"session","version":3,"id":"r","cwd":"` + project + `"}` + "\n" +
		`{"type":"message","message":{"role":"user","content":"old task"}}` + "\n" +
		`{"type":"session_info","name":"Old Task","autoTitle":true}` + "\n" +
		`{"type":"message","message":{"role":"user","content":"brand new request"}}` + "\n"
	if err := os.WriteFile(filepath.Join(project, id), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	s.maybeAutoTitle(id)
	if got := sessionNameNow(t, s, id); got != "Brand New Request" {
		t.Fatalf("expected re-title from new message, got %q", got)
	}
}

func TestMaybeAutoTitleNoUserMessage(t *testing.T) {
	s := newAutoTitleServer(t, nil)
	id := writeAutoTitleSession(t, s.sessionsDir, "", "")

	s.maybeAutoTitle(id) // must not panic or rename
	if got := sessionNameNow(t, s, id); got != id {
		t.Fatalf("expected fallback to filename when no user text, got %q", got)
	}
}
