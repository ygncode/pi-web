//go:build !windows

package app

import (
	"os/exec"
	"syscall"
)

// detachSession puts the restart command in its own session so it survives the
// service manager tearing down this process.
func detachSession(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
}
