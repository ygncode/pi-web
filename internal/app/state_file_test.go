package app

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStateFileName(t *testing.T) {
	tests := []struct {
		name        string
		development bool
		want        string
	}{
		{name: "primary", want: "pi-web-state.json"},
		{name: "development", development: true, want: "pi-web-state-dev.json"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := stateFileName(tt.development); got != tt.want {
				t.Errorf("stateFileName(%v) = %q, want %q", tt.development, got, tt.want)
			}
		})
	}
}

func TestDevelopmentStateFileCanCoexistWithRegularServer(t *testing.T) {
	tmp := t.TempDir()
	primaryPath, primaryFile, err := writeStateFile(tmp, false, "127.0.0.1", "31415", false, "")
	if err != nil {
		t.Fatalf("write regular state: %v", err)
	}
	defer primaryFile.Close()

	devPath, devFile, err := writeStateFile(tmp, true, "127.0.0.1", "31416", false, "")
	if err != nil {
		t.Fatalf("write dev state: %v", err)
	}
	defer devFile.Close()

	if primaryPath == devPath {
		t.Fatalf("regular and development state paths are both %q", primaryPath)
	}
	if _, duplicateFile, err := writeStateFile(tmp, true, "127.0.0.1", "31417", false, ""); err == nil {
		duplicateFile.Close()
		t.Fatal("second dev instance should fail while the first dev lock is held")
	}
}

func TestStateFileLockBlocksSecondAcquire(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "state.json")

	f1, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		t.Fatal(err)
	}
	defer f1.Close()
	if err := lockStateFile(f1); err != nil {
		t.Fatalf("first lock should succeed: %v", err)
	}

	// flock (Unix) and LockFileEx (Windows) both scope the lock to the open
	// file handle, so a second handle in the same process must be rejected.
	f2, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		t.Fatal(err)
	}
	defer f2.Close()
	if err := lockStateFile(f2); err == nil {
		t.Fatal("second lock should fail while the first is held")
	}
}
