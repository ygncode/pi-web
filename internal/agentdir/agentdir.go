// Package agentdir resolves the Pi agent configuration directory and the
// paths pi-web stores under it. Centralizing this keeps the app and server
// packages from drifting on where "~/.pi/agent" lives.
package agentdir

import (
	"os"
	"path/filepath"
)

// Path returns the Pi agent config directory. It respects the
// PI_CODING_AGENT_DIR environment variable, falling back to ~/.pi/agent.
//
// This mirrors pi's own getAgentDir() and intentionally models ONLY the
// agent-dir override. pi resolves its sessions directory with higher-priority
// knobs that pi-web does not honor: the --session-dir flag and the
// PI_CODING_AGENT_SESSION_DIR env var both relocate just the sessions subdir
// (pi precedence: --session-dir > PI_CODING_AGENT_SESSION_DIR > <agentDir>/sessions).
// pi-web only derives sessions from <agentDir>/sessions, so a user who
// relocates only the sessions dir would have pi-web look in the wrong place.
// That is a known, accepted gap, not an oversight.
//
// Note also that pi derives this var name dynamically as
// APP_NAME.toUpperCase()+"_CODING_AGENT_DIR"; the hardcoded "PI_" prefix here
// is correct for mainline pi but would not match a rebranded fork.
func Path() string {
	if dir := os.Getenv("PI_CODING_AGENT_DIR"); dir != "" {
		return dir
	}
	home, _ := os.UserHomeDir()
	if home == "" {
		home = os.Getenv("HOME")
	}
	return filepath.Join(home, ".pi", "agent")
}

// WebDir returns the pi-web data directory inside the given agent dir. Callers
// that already hold an agent dir (e.g. the server, or a test temp dir) should
// pass it; callers resolving from the environment can pass Path().
func WebDir(agentDir string) string {
	return filepath.Join(agentDir, "pi-web")
}
