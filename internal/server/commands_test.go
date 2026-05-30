package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestHandleCommands(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest(http.MethodGet, "/api/commands", nil)
	w := httptest.NewRecorder()
	s.handleCommands(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var result map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	commands, ok := result["commands"].([]any)
	if !ok || len(commands) == 0 {
		t.Fatal("expected non-empty commands array")
	}
	for _, cmd := range commands {
		m, ok := cmd.(map[string]any)
		if !ok {
			t.Fatal("expected command to be a map")
		}
		if _, ok := m["name"]; !ok {
			t.Fatal("expected command to have name field")
		}
		if _, ok := m["description"]; !ok {
			t.Fatal("expected command to have description field")
		}
	}
}

func TestHandleCommandsRejectsPost(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest(http.MethodPost, "/api/commands", nil)
	w := httptest.NewRecorder()
	s.handleCommands(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestLoadCommandsFromFile(t *testing.T) {
	// Create temp commands file
	tmpDir := t.TempDir()
	piWebDir := filepath.Join(tmpDir, "pi-web")
	if err := os.MkdirAll(piWebDir, 0755); err != nil {
		t.Fatal(err)
	}
	commandsFile := filepath.Join(piWebDir, "commands.json")
	customCommands := []map[string]string{
		{"name": "/custom", "description": "Custom command"},
	}
	data, _ := json.Marshal(customCommands)
	if err := os.WriteFile(commandsFile, data, 0644); err != nil {
		t.Fatal(err)
	}

	// Set PI_CONFIG_DIR to temp dir
	origConfigDir := os.Getenv("PI_CONFIG_DIR")
	os.Setenv("PI_CONFIG_DIR", tmpDir)
	defer os.Setenv("PI_CONFIG_DIR", origConfigDir)

	// Clear cache
	cmdCache.commands = nil
	cmdCache.modTime = 0

	s := &Server{}
	commands := s.loadCommands()
	if len(commands) != 1 {
		t.Fatalf("expected 1 command, got %d", len(commands))
	}
	if commands[0]["name"] != "/custom" {
		t.Fatalf("expected /custom, got %s", commands[0]["name"])
	}
}

func TestLoadCommandsFallsBackToDefaults(t *testing.T) {
	// Set PI_CONFIG_DIR to non-existent
	tmpDir := t.TempDir()
	origConfigDir := os.Getenv("PI_CONFIG_DIR")
	os.Setenv("PI_CONFIG_DIR", filepath.Join(tmpDir, "nonexistent"))
	defer os.Setenv("PI_CONFIG_DIR", origConfigDir)

	// Clear cache
	cmdCache.commands = nil
	cmdCache.modTime = 0

	s := &Server{}
	commands := s.loadCommands()
	if len(commands) != len(defaultCommands) {
		t.Fatalf("expected %d default commands, got %d", len(defaultCommands), len(commands))
	}
}