package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPiAgentDir_RespectsEnvVar(t *testing.T) {
	t.Setenv("PI_CODING_AGENT_DIR", "/custom/pi/agent")
	got := piAgentDir()
	if got != "/custom/pi/agent" {
		t.Fatalf("want /custom/pi/agent, got %s", got)
	}
}

func TestPiAgentDir_FallsBackToHome(t *testing.T) {
	t.Setenv("PI_CODING_AGENT_DIR", "")
	got := piAgentDir()
	if got == "" {
		t.Fatal("expected non-empty path")
	}
	if got == "/custom/pi/agent" {
		t.Fatal("should not use env var when empty")
	}
	// Should end with .pi/agent when falling back
	if filepath.Base(filepath.Dir(got)) != ".pi" {
		t.Fatalf("expected parent to be .pi, got %s", got)
	}
	if filepath.Base(got) != "agent" {
		t.Fatalf("expected base to be agent, got %s", got)
	}
}

func TestPiWebDir(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", tmp)
	got := piWebDir()
	want := filepath.Join(tmp, "pi-web")
	if got != want {
		t.Fatalf("want %s, got %s", want, got)
	}
}

func TestWriteStateFile_MigratesOldStateFile(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "pi-web-state.json")
	newPath := filepath.Join(tmp, "pi-web", "pi-web-state.json")

	// Create old state file
	if err := os.WriteFile(oldPath, []byte(`{"pid":123}`), 0644); err != nil {
		t.Fatal(err)
	}

	path, err := writeStateFile(tmp, "127.0.0.1", "31415", false, "")
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if stateFile != nil {
			_ = stateFile.Close()
			stateFile = nil
		}
	}()

	if path != newPath {
		t.Fatalf("expected new path %s, got %s", newPath, path)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Fatal("old state file should have been moved")
	}
	if _, err := os.Stat(newPath); err != nil {
		t.Fatalf("new state file should exist: %v", err)
	}
}
