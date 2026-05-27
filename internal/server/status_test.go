package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"pi-web/internal/workers"
)

func TestComputeRunningStatusFromStatusFile(t *testing.T) {
	root := t.TempDir()
	sessionsDir := filepath.Join(root, "sessions")
	statusDir := filepath.Join(root, "session-status")
	if err := os.MkdirAll(sessionsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(statusDir, 0o755); err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(sessionStatusFile{State: "running", UpdatedAt: time.Now().UTC().Format(time.RFC3339)})
	if err := os.WriteFile(filepath.Join(statusDir, "session.jsonl"), payload, 0o644); err != nil {
		t.Fatal(err)
	}

	s := &Server{agentDir: root, sessionsDir: sessionsDir, chatSender: &fakeSender{}}
	if !s.computeRunningStatus("session.jsonl") {
		t.Fatalf("expected running=true from session-status file")
	}
}

func TestComputeRunningStatusFromChatSender(t *testing.T) {
	s := &Server{
		sessionsDir: t.TempDir(),
		chatSender:  &fakeSender{status: workers.WorkerStatus{State: workers.WorkerStateRunning}},
	}
	if !s.computeRunningStatus("session.jsonl") {
		t.Fatalf("expected running=true from chatSender")
	}
}

func TestComputeRunningStatusFromRecentMtime(t *testing.T) {
	now := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)
	s := &Server{
		sessionsDir: t.TempDir(),
		chatSender:  &fakeSender{},
		fileMod:     map[string]time.Time{"session.jsonl": now.Add(-400 * time.Millisecond)},
		now:         func() time.Time { return now },
	}
	if !s.computeRunningStatus("session.jsonl") {
		t.Fatalf("expected running=true from recent mtime")
	}
}

func TestComputeRunningStatusIdleByDefault(t *testing.T) {
	s := &Server{sessionsDir: t.TempDir(), chatSender: &fakeSender{}}
	if s.computeRunningStatus("session.jsonl") {
		t.Fatalf("expected running=false by default")
	}
}

func TestComputeRunningStatusEmptyID(t *testing.T) {
	s := &Server{sessionsDir: t.TempDir(), chatSender: &fakeSender{}}
	if s.computeRunningStatus("") {
		t.Fatalf("empty id must be idle")
	}
}

func TestRecomputeAndBroadcastStatusEmitsDeltaOnFlip(t *testing.T) {
	now := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)
	s := &Server{
		sessionsDir: t.TempDir(),
		chatSender:  &fakeSender{},
		clients:     make([]*sseClient, 0),
		lastKnown:   make(map[string]struct{}),
		fileMod:     map[string]time.Time{"a.jsonl": now.Add(-400 * time.Millisecond)},
		now:         func() time.Time { return now },
	}
	c := s.addClient(globalSessID)
	defer s.removeClient(c)

	s.recomputeAndBroadcastStatus("a.jsonl")

	want := "event: status-delta\ndata: {\"id\":\"a.jsonl\",\"running\":true}"
	select {
	case msg := <-c.ch:
		if msg != want {
			t.Fatalf("msg = %q want %q", msg, want)
		}
	case <-time.After(time.Second):
		t.Fatalf("expected status-delta broadcast")
	}
}

func TestRecomputeAndBroadcastStatusNoBroadcastWhenUnchanged(t *testing.T) {
	s := &Server{
		sessionsDir: t.TempDir(),
		chatSender:  &fakeSender{},
		clients:     make([]*sseClient, 0),
		lastKnown:   make(map[string]struct{}),
	}
	c := s.addClient(globalSessID)
	defer s.removeClient(c)

	// First call on an idle session: idle was never recorded, computeRunning
	// returns false → was==false, now==false → no broadcast.
	s.recomputeAndBroadcastStatus("a.jsonl")

	select {
	case msg := <-c.ch:
		t.Fatalf("unexpected broadcast: %q", msg)
	case <-time.After(50 * time.Millisecond):
	}
}

func TestRecomputeAndBroadcastStatusFlipsBackToIdle(t *testing.T) {
	s := &Server{
		sessionsDir: t.TempDir(),
		chatSender:  &fakeSender{},
		clients:     make([]*sseClient, 0),
		lastKnown:   map[string]struct{}{"a.jsonl": {}},
	}
	c := s.addClient(globalSessID)
	defer s.removeClient(c)

	s.recomputeAndBroadcastStatus("a.jsonl")

	want := "event: status-delta\ndata: {\"id\":\"a.jsonl\",\"running\":false}"
	select {
	case msg := <-c.ch:
		if msg != want {
			t.Fatalf("msg = %q want %q", msg, want)
		}
	case <-time.After(time.Second):
		t.Fatalf("expected idle delta")
	}
	if _, ok := s.lastKnown["a.jsonl"]; ok {
		t.Fatalf("lastKnown should no longer contain a.jsonl")
	}
}
