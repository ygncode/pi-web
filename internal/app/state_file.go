package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"pi-web/internal/agentdir"
)

func stateFileName(development bool) string {
	if development {
		return "pi-web-state-dev.json"
	}
	return "pi-web-state.json"
}

// writeStateFile returns an open file handle that the caller must retain for
// the process lifetime. Closing it releases the instance lock.
func writeStateFile(agentDir string, development bool, host, port string, tailscale bool, tailscaleURL string) (string, *os.File, error) {
	webDir := agentdir.WebDir(agentDir)
	if err := os.MkdirAll(webDir, 0755); err != nil {
		return "", nil, err
	}
	path := filepath.Join(webDir, stateFileName(development))

	// Only the regular server owns the legacy state path used by extensions.
	// Development mode gets an independent state file and lock.
	if !development {
		oldPath := filepath.Join(agentDir, "pi-web-state.json")
		if _, err := os.Stat(oldPath); err == nil {
			if _, err := os.Stat(path); os.IsNotExist(err) {
				_ = os.Rename(oldPath, path)
			}
		}
	}

	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return "", nil, err
	}
	if err := lockStateFile(f); err != nil {
		_ = f.Close()
		return "", nil, err
	}
	data, err := json.Marshal(map[string]any{
		"pid":          os.Getpid(),
		"port":         port,
		"host":         host,
		"development":  development,
		"tailscale":    tailscale,
		"tailscaleUrl": tailscaleURL,
		"startedAt":    time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		_ = f.Close()
		return "", nil, err
	}
	if err := f.Truncate(0); err != nil {
		_ = f.Close()
		return "", nil, err
	}
	if _, err := f.WriteAt(data, 0); err != nil {
		_ = f.Close()
		return "", nil, err
	}
	return path, f, nil
}
