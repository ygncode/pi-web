package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"

	"pi-web/internal/sessions"
)

// settingBtwSessionID is the app_settings key holding the id of the single,
// global "btw" scratch-chat session surfaced in the floating btw window.
const settingBtwSessionID = "btw_session_id"

func (s *Server) getBtwSessionID() string {
	if s.db == nil {
		return ""
	}
	var v string
	if err := s.db.QueryRow("SELECT value FROM app_settings WHERE key = ?", settingBtwSessionID).Scan(&v); err != nil {
		return ""
	}
	return v
}

func (s *Server) setBtwSessionID(id string) {
	if s.db == nil {
		return
	}
	prev := s.getBtwSessionID()
	_, _ = s.db.Exec(`INSERT INTO app_settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value`, settingBtwSessionID, id)
	// Notify every connected client (on any device) so an open btw window can
	// switch to the new session in realtime. Only when it actually changed.
	if id != prev {
		s.broadcastBtwChanged(id)
	}
}

// broadcastBtwChanged tells all clients which session is now the global btw
// session. Sent on the global topic so any open btw window re-syncs even if it
// is currently subscribed to a different (or no) session.
func (s *Server) broadcastBtwChanged(id string) {
	msg, err := formatSSEJSONEvent("btw-changed", map[string]string{"sessionId": id})
	if err != nil {
		return
	}
	s.broadcast(globalSessID, msg)
}

// handleGetBtw returns the current global btw session id, clearing the stored
// pointer if the session file has since been deleted so the client can fall
// back to its empty state.
func (s *Server) handleGetBtw(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	id := s.getBtwSessionID()
	if id != "" {
		if _, err := sessions.ResolveByID(s.sessionsDir, id); err != nil {
			id = ""
			s.setBtwSessionID("")
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"sessionId": id})
}

// handleNewBtw creates a fresh session, records it as the global btw session,
// and returns its id. The path defaults to the user's home directory when the
// caller does not supply one (e.g. the originating page had no cwd).
func (s *Server) handleNewBtw(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	path := body.Path
	if path == "" {
		path, _ = os.UserHomeDir()
	}

	id, err := sessions.CreateSessionFileWithSettings(s.sessionsDir, path, sessions.InitialSettings{})
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.setBtwSessionID(id)

	// Pre-warm a worker so the first chat message lands quickly, mirroring
	// handleNewSession.
	if s.chatSender != nil {
		if resolved, err := sessions.ResolveByID(s.sessionsDir, id); err == nil {
			go s.initializeNewSessionWorker(context.Background(), resolved.Session.ID, resolved.Path, sessions.InitialSettings{})
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}
