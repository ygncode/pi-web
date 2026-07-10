//go:build windows

package app

import (
	"fmt"
	"os"

	"golang.org/x/sys/windows"
)

// lockStateFile takes an exclusive non-blocking lock on f via LockFileEx,
// mirroring the flock in state_file_unix.go. The caller must keep f open for
// the lock to remain held; closing f (or process exit) releases the lock.
func lockStateFile(f *os.File) error {
	err := windows.LockFileEx(windows.Handle(f.Fd()),
		windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY,
		0, 1, 0, new(windows.Overlapped))
	if err == windows.ERROR_LOCK_VIOLATION {
		return fmt.Errorf("another pi-web instance appears to be running (state file at %s is locked); exit it first, or remove the file if stale", f.Name())
	}
	return err
}
