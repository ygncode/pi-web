package app

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

// The in-app updater must hand install.sh the in-place flag so it skips the
// service stop/restart (which would kill the npm process running it).
func TestInstallCmdSignalsInPlaceUpdate(t *testing.T) {
	cmd := installCmd(context.Background())

	wantArgs := []string{"pi", "install", installPackage}
	if !slices.Equal(cmd.Args, wantArgs) {
		t.Fatalf("args = %v, want %v", cmd.Args, wantArgs)
	}

	want := inPlaceUpdateEnv + "=1"
	if !slices.Contains(cmd.Env, want) {
		t.Errorf("env missing %q; got %v", want, cmd.Env)
	}
}

func TestCleanupStaleNPMTemps(t *testing.T) {
	t.Setenv("PI_CODING_AGENT_DIR", "")
	t.Setenv("HOME", t.TempDir())

	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatal(err)
	}
	scopeDir := filepath.Join(home, ".pi", "agent", "npm", "node_modules", "@ygncode")
	staleDir := filepath.Join(scopeDir, ".pi-web-F7YwHA7A")
	keepDir := filepath.Join(scopeDir, "pi-web")
	if err := os.MkdirAll(filepath.Join(staleDir, "nested"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(keepDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staleDir, "nested", "file"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	cleanupStaleNPMTemps()

	if _, err := os.Stat(staleDir); !os.IsNotExist(err) {
		t.Fatalf("stale temp dir still exists or stat failed: %v", err)
	}
	if _, err := os.Stat(keepDir); err != nil {
		t.Fatalf("real package dir should remain: %v", err)
	}
}
