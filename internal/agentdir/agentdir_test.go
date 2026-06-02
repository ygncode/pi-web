package agentdir

import (
	"path/filepath"
	"testing"
)

func TestPath_RespectsEnvVar(t *testing.T) {
	t.Setenv("PI_CODING_AGENT_DIR", "/custom/pi/agent")
	if got := Path(); got != "/custom/pi/agent" {
		t.Fatalf("want /custom/pi/agent, got %s", got)
	}
}

func TestPath_FallsBackToHome(t *testing.T) {
	t.Setenv("PI_CODING_AGENT_DIR", "")
	got := Path()
	if got == "" {
		t.Fatal("expected non-empty path")
	}
	if got == "/custom/pi/agent" {
		t.Fatal("should not use env var when empty")
	}
	if filepath.Base(filepath.Dir(got)) != ".pi" {
		t.Fatalf("expected parent to be .pi, got %s", got)
	}
	if filepath.Base(got) != "agent" {
		t.Fatalf("expected base to be agent, got %s", got)
	}
}

func TestWebDir(t *testing.T) {
	got := WebDir("/custom/pi/agent")
	want := filepath.Join("/custom/pi/agent", "pi-web")
	if got != want {
		t.Fatalf("want %s, got %s", want, got)
	}
}
