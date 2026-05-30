package server

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

var defaultCommands = []map[string]string{
	{"name": "/compact", "description": "Compact conversation history"},
	{"name": "/clear", "description": "Clear conversation"},
	{"name": "/model", "description": "Switch model"},
	{"name": "/thinking", "description": "Change thinking level"},
	{"name": "/web", "description": "Open current session in browser"},
	{"name": "/refresh", "description": "Sync web-written messages back into session"},
	{"name": "/remote", "description": "Show QR code for remote access"},
	{"name": "/pi-web", "description": "Manage pi-web: status, token, start, stop"},
}

type commandsCache struct {
	mu       sync.Mutex
	commands []map[string]string
	modTime  int64
}

var cmdCache commandsCache

func (s *Server) handleCommands(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	commands := s.loadCommands()
	writeJSON(w, 0, map[string]any{"commands": commands})
}

func (s *Server) loadCommands() []map[string]string {
	cmdCache.mu.Lock()
	defer cmdCache.mu.Unlock()

	// Try to read commands.json from pi config directory
	configDir := os.Getenv("PI_CONFIG_DIR")
	if configDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return defaultCommands
		}
		configDir = filepath.Join(homeDir, ".pi", "agent")
	}
	commandsFile := filepath.Join(configDir, "pi-web", "commands.json")

	info, err := os.Stat(commandsFile)
	if err != nil {
		// File doesn't exist — return defaults
		return defaultCommands
	}

	// Use cache if file hasn't changed
	if cmdCache.commands != nil && cmdCache.modTime == info.ModTime().UnixNano() {
		return cmdCache.commands
	}

	data, err := os.ReadFile(commandsFile)
	if err != nil {
		return defaultCommands
	}

	var commands []map[string]string
	if err := json.Unmarshal(data, &commands); err != nil {
		return defaultCommands
	}

	if len(commands) == 0 {
		return defaultCommands
	}

	cmdCache.commands = commands
	cmdCache.modTime = info.ModTime().UnixNano()
	return commands
}