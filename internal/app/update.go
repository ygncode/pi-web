package app

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"
)

// runRestart restarts the pi-web service so a manually-installed binary takes
// over. The restart command is detached into its own session so it survives
// this process being torn down by the service manager. A fallback timer exits
// the process if the service manager does not replace us promptly.
//
// Note: this fork has no in-app installer (see internal/app/app.go) — restart is
// kept as a standalone action and never pulls a new binary.
func runRestart() error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("sh", "-lc", darwinRestartScript)
	case "linux":
		cmd = exec.Command("systemctl", "--user", "restart", "pi-web.service")
	default:
		return fmt.Errorf("restart is only supported on macOS and Linux")
	}
	detachSession(cmd)
	cmd.Stdout = os.Stderr
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start restart command: %w", err)
	}
	// If the service manager doesn't kill us (e.g. it already booted a fresh
	// instance), exit so the old process doesn't linger holding the port.
	time.AfterFunc(5*time.Second, func() { os.Exit(0) })
	return nil
}

// darwinRestartScript mirrors the extension's `/pi-web restart`: re-bootstrap
// the launchd job, preserving the PI_WEB_TOKEN from the env file, then kick it.
const darwinRestartScript = `plist="$HOME/Library/LaunchAgents/com.pi-web.plist"
if [ ! -f "$plist" ]; then exit 127; fi
env_file="$HOME/.config/pi-web/env"
token="$(awk -F= '$1 == "PI_WEB_TOKEN" { sub(/^[^=]*=/, ""); print; exit }' "$env_file" 2>/dev/null || true)"
if [ -n "$token" ]; then
  launchctl setenv PI_WEB_TOKEN "$token" 2>/dev/null || true
fi
launchctl bootout "gui/$(id -u)" "$plist" 2>/dev/null || launchctl unload "$plist" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist" 2>/dev/null || launchctl load "$plist"
launchctl kickstart -k "gui/$(id -u)/com.pi-web" 2>/dev/null || launchctl start com.pi-web`
