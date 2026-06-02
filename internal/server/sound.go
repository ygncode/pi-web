package server

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"pi-web/internal/agentdir"
	"pi-web/internal/ui"
)

// handleApiSounds scans the assets directory for .mp3 files and returns them sorted.
// Auth-gated: registered with s.auth.Wrap
func (s *Server) handleApiSounds(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	soundsDir := filepath.Join(agentdir.WebDir(s.agentDir), "assets")
	files, err := os.ReadDir(soundsDir)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"sounds":  []string{"cat.mp3", "done.mp3"},
			"default": "cat.mp3",
		})
		return
	}

	var sounds []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(strings.ToLower(f.Name()), ".mp3") {
			sounds = append(sounds, f.Name())
		}
	}

	// Always ensure our default ones are included or that we sort properly
	// If the user deleted all mp3s, we will return empty but sorted.
	sort.Strings(sounds)

	w.Header().Set("Cache-Control", "no-cache")
	writeJSON(w, http.StatusOK, map[string]any{
		"sounds":  sounds,
		"default": "cat.mp3",
	})
}

// handleSounds serves a sound file by name. If missing on disk, falls back to embedded cat.mp3.
// Public (no auth): registered directly on mux
func (s *Server) handleSounds(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	name := filepath.Base(r.URL.Path)
	if name == "" || name == "." || name == "/" {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	// Restrict to sound files only to be safe
	if !strings.HasSuffix(strings.ToLower(name), ".mp3") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	soundsDir := filepath.Join(agentdir.WebDir(s.agentDir), "assets")
	filePath := filepath.Clean(filepath.Join(soundsDir, name))
	expectedDir := filepath.Clean(soundsDir)

	if !strings.HasPrefix(filePath, expectedDir) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if _, err := os.Stat(filePath); err == nil {
		w.Header().Set("Content-Type", "audio/mpeg")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		http.ServeFile(w, r, filePath)
		return
	}

	// Only fall back to embedded cat.mp3 when that specific file is requested.
	// For any other missing file, return 404 so callers know it doesn't exist.
	if name == "cat.mp3" {
		w.Header().Set("Content-Type", "audio/mpeg")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write(ui.CatMP3)
		return
	}
	http.NotFound(w, r)
}
