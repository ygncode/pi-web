package app

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSeedSoundsDir_SeedsDefaultsWhenEmpty(t *testing.T) {
	agentDir := t.TempDir()

	if err := seedSoundsDir(agentDir); err != nil {
		t.Fatal(err)
	}

	soundsDir := filepath.Join(agentDir, "pi-web", "assets")
	for _, name := range []string{"cat.mp3", "done.mp3"} {
		info, err := os.Stat(filepath.Join(soundsDir, name))
		if err != nil {
			t.Fatalf("expected %s to be seeded: %v", name, err)
		}
		if info.Size() == 0 {
			t.Fatalf("expected %s to be non-empty", name)
		}
	}
}

func TestSeedSoundsDir_SkipsWhenMP3AlreadyPresent(t *testing.T) {
	agentDir := t.TempDir()
	soundsDir := filepath.Join(agentDir, "pi-web", "assets")
	if err := os.MkdirAll(soundsDir, 0755); err != nil {
		t.Fatal(err)
	}
	// A user-provided sound means the dir is "not empty"; seeding must not run.
	if err := os.WriteFile(filepath.Join(soundsDir, "custom.mp3"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}

	if err := seedSoundsDir(agentDir); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(filepath.Join(soundsDir, "cat.mp3")); !os.IsNotExist(err) {
		t.Fatal("cat.mp3 should not be seeded when an mp3 is already present")
	}
}
