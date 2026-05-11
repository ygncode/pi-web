package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func drainBroadcast(t *testing.T, c *sseClient, timeout time.Duration) bool {
	t.Helper()
	select {
	case <-c.ch:
		return true
	case <-time.After(timeout):
		return false
	}
}

func TestFsnotifyWatcherBroadcastsOnAppend(t *testing.T) {
	root := t.TempDir()
	projectDir := filepath.Join(root, "--tmp--project--")
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatal(err)
	}
	sessionPath := filepath.Join(projectDir, "session.jsonl")
	if err := os.WriteFile(sessionPath, []byte("{}\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	s := &Server{sessionsDir: root, fileMod: make(map[string]time.Time), lastKnown: make(map[string]struct{}), now: time.Now}
	if err := s.watchFilesFsnotify(); err != nil {
		t.Skipf("fsnotify unavailable on this platform: %v", err)
	}

	client := s.addClient("session.jsonl")
	defer s.removeClient(client)

	time.Sleep(20 * time.Millisecond)

	future := time.Now().Add(2 * time.Second)
	if err := os.Chtimes(sessionPath, future, future); err != nil {
		t.Fatal(err)
	}
	f, err := os.OpenFile(sessionPath, os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		t.Fatal(err)
	}
	f.WriteString(`{"type":"message"}` + "\n")
	f.Close()

	if !drainBroadcast(t, client, 2*time.Second) {
		t.Fatalf("expected reload broadcast after file append")
	}
}

func TestPollingFallbackBroadcastsOnAppend(t *testing.T) {
	root := t.TempDir()
	projectDir := filepath.Join(root, "--tmp--project--")
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatal(err)
	}
	sessionPath := filepath.Join(projectDir, "session.jsonl")
	if err := os.WriteFile(sessionPath, []byte("{}\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	s := &Server{sessionsDir: root, fileMod: make(map[string]time.Time), lastKnown: make(map[string]struct{}), now: time.Now}
	s.scanForChanges()

	client := s.addClient("session.jsonl")
	defer s.removeClient(client)

	future := time.Now().Add(2 * time.Second)
	if err := os.Chtimes(sessionPath, future, future); err != nil {
		t.Fatal(err)
	}

	s.scanForChanges()

	if !drainBroadcast(t, client, 100*time.Millisecond) {
		t.Fatalf("expected reload broadcast after scanForChanges")
	}
}

func TestRecordModTimeBroadcastsStatusDelta(t *testing.T) {
	root := t.TempDir()
	now := time.Now()
	s := &Server{
		sessionsDir: root,
		fileMod:     map[string]time.Time{"session.jsonl": now.Add(-10 * time.Second)},
		clients:     make([]*sseClient, 0),
		lastKnown:   make(map[string]struct{}),
		chatSender:  &fakeSender{},
		now:         time.Now,
	}
	c := s.addClient(globalSessID)
	defer s.removeClient(c)

	// Advance modtime to "now"; this is a recent-activity flip from idle to running.
	s.recordModTime("session.jsonl", time.Now())

	// __all__ subscriber now also receives "reload" for any existing-session
	// modification, followed by the status-delta.
	if !drainBroadcast(t, c, time.Second) {
		t.Fatalf("expected reload broadcast on __all__")
	}

	select {
	case msg := <-c.ch:
		if !strings.Contains(msg, "status-delta") || !strings.Contains(msg, "session.jsonl") || !strings.Contains(msg, "true") {
			t.Fatalf("unexpected msg after reload: %q", msg)
		}
	case <-time.After(time.Second):
		t.Fatalf("expected status-delta on __all__")
	}
}
