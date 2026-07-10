//go:build windows

package app

import (
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
)

// detachSession detaches the restart helper from this process's console and
// Ctrl+C group so it survives this process exiting mid-restart.
func detachSession(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: windows.DETACHED_PROCESS | windows.CREATE_NEW_PROCESS_GROUP,
		HideWindow:    true,
	}
}
