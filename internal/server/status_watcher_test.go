package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSessionStatusWatcherEmitsDelta(t *testing.T) {
	root := t.TempDir()
	sessionsDir := filepath.Join(root, "sessions")
	statusDir := filepath.Join(root, "session-status")
	if err := os.MkdirAll(sessionsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(statusDir, 0o755); err != nil {
		t.Fatal(err)
	}

	s := &Server{
		agentDir:    root,
		sessionsDir: sessionsDir,
		clients:     make([]*sseClient, 0),
		lastKnown:   make(map[string]struct{}),
		chatSender:  &fakeSender{},
		now:         time.Now,
	}
	if err := s.startSessionStatusWatcher(); err != nil {
		t.Skipf("fsnotify unavailable: %v", err)
	}

	c := s.addClient(globalSessID)
	defer s.removeClient(c)

	time.Sleep(20 * time.Millisecond)

	payload, _ := json.Marshal(sessionStatusFile{
		State:     "running",
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	})
	if err := os.WriteFile(filepath.Join(statusDir, "term.jsonl"), payload, 0o644); err != nil {
		t.Fatal(err)
	}

	select {
	case msg := <-c.ch:
		if !strings.Contains(msg, "status-delta") || !strings.Contains(msg, "term.jsonl") || !strings.Contains(msg, "true") {
			t.Fatalf("unexpected msg: %q", msg)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("expected status-delta after status-file write")
	}
}
