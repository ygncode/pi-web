//go:build windows

package app

import "os/exec"

// detachSession is a no-op on Windows; runRestart returns an error there before
// the command is started.
func detachSession(cmd *exec.Cmd) {}
