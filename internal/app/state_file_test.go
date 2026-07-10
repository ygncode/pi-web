package app

import (
	"os"
	"path/filepath"
	"testing"
)

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
