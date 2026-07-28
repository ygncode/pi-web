package app

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteStateFile_SkipsMigrationWhenNewExists(t *testing.T) {
	tmp := t.TempDir()
	webDir := filepath.Join(tmp, "pi-web")
	oldPath := filepath.Join(tmp, "pi-web-state.json")
	newPath := filepath.Join(webDir, "pi-web-state.json")

	if err := os.MkdirAll(webDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(oldPath, []byte(`{"pid":123}`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(newPath, []byte(`{"pid":999}`), 0644); err != nil {
		t.Fatal(err)
	}

	path, stateFile, err := writeStateFile(tmp, false, "127.0.0.1", "31415", false, "")
	if err != nil {
		t.Fatal(err)
	}
	defer stateFile.Close()

	if path != newPath {
		t.Fatalf("expected new path %s, got %s", newPath, path)
	}
	// Old file should still exist (migration was skipped)
	if _, err := os.Stat(oldPath); err != nil {
		t.Fatal("old state file should still exist when new already present")
	}
}

func TestWriteStateFile_MigratesOldStateFile(t *testing.T) {
	tmp := t.TempDir()
	oldPath := filepath.Join(tmp, "pi-web-state.json")
	newPath := filepath.Join(tmp, "pi-web", "pi-web-state.json")

	if err := os.WriteFile(oldPath, []byte(`{"pid":123}`), 0644); err != nil {
		t.Fatal(err)
	}

	path, stateFile, err := writeStateFile(tmp, false, "127.0.0.1", "31415", false, "")
	if err != nil {
		t.Fatal(err)
	}
	defer stateFile.Close()

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
