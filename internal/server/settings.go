package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// handleSettingsPage renders the global /settings page.
func (s *Server) handleSettingsPage(w http.ResponseWriter, r *http.Request) {
	if s.renderSettings == nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.renderSettings(w); err != nil {
		if !isBrokenPipe(err) {
			fmt.Fprintf(os.Stderr, "settings template error: %v\n", err)
		}
	}
}

// settingDefaults defines the server-backed user settings and their default
// values. The keys mirror the localStorage keys the frontend already uses so
// the write-through cache maps 1:1. Only keys listed here are accepted by
// POST /api/settings; everything else is ignored. Genuinely per-window or
// live-timer state (sidebar widths, focus countdown, tree toggles) is NOT
// listed here — it stays in localStorage only.
var settingDefaults = map[string]string{
	"pi-web-theme":               "dark",
	"pi-sessions:spinner-style":  "runcat",
	"pi-share:v1:notify-on-done": "false",
	"pi-share:v1:done-sound":     "cat.mp3",
	"pi-sessions:view-layout":    "timeline",
	"pi-web:v1:cat:enabled":      "true",
	"pi-web:v1:cat:focus-min":    "25",
	"pi-web:v1:cat:break-min":    "5",
	"pi-web:v1:cat:bedtime":      "23:00",
	"pi-web:v1:cat:sleep-min":    "2",
}

// getSettings returns every server-backed setting: defaults overlaid with any
// values stored in the DB. Degrades gracefully to defaults when there is no DB.
func (s *Server) getSettings() map[string]string {
	out := make(map[string]string, len(settingDefaults))
	for k, v := range settingDefaults {
		out[k] = v
	}
	if s.db == nil {
		return out
	}
	rows, err := s.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		// Only surface keys we still recognize.
		if _, ok := settingDefaults[key]; ok {
			out[key] = value
		}
	}
	return out
}

// getSetting returns a single server-backed setting, falling back to its
// default (or the supplied fallback for unknown keys).
func (s *Server) getSetting(key, fallback string) string {
	if def, ok := settingDefaults[key]; ok {
		fallback = def
	}
	if s.db == nil {
		return fallback
	}
	var value string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err != nil {
		return fallback
	}
	return value
}

// ThemeSetting returns the persisted theme, used for server-side injection so
// the page paints the correct theme before any JS runs.
func (s *Server) ThemeSetting() string {
	return s.getSetting("pi-web-theme", "dark")
}

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"settings": s.getSettings()})
}

func (s *Server) handleSaveSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var body struct {
		Settings map[string]string `json:"settings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if len(body.Settings) == 0 {
		writeJSONError(w, http.StatusBadRequest, "settings is required")
		return
	}

	// Without a DB, writes are a no-op but still report success so the
	// write-through cache (localStorage) keeps working read-only.
	if s.db == nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "settings": s.getSettings()})
		return
	}

	now := time.Now()
	for key, value := range body.Settings {
		if _, ok := settingDefaults[key]; !ok {
			continue // ignore unknown keys
		}
		_, err := s.db.Exec(`INSERT INTO settings (key, value, updated_at)
			VALUES (?, ?, ?)
			ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
			key, value, now)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to save settings: "+err.Error())
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "settings": s.getSettings()})
}
