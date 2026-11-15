package server

// Per-message 👍/👎 ratings from the message footer. Stored in pi-web's sqlite
// (not appended to the session JSONL, which would fork pi's entry tree while a
// worker is writing). Exported alongside sessions for LoRA curation.

import (
	"net/http"
	"time"
)

const messageRatingsSchema = `CREATE TABLE IF NOT EXISTS message_ratings (
	session_id TEXT NOT NULL,
	entry_id   TEXT NOT NULL,
	rating     INTEGER NOT NULL,
	rated_by   TEXT NOT NULL DEFAULT '',
	updated_at DATETIME,
	PRIMARY KEY (session_id, entry_id)
)`

func (s *Server) handleMessageRating(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("id")
	if sessionID == "" {
		writeJSONError(w, http.StatusBadRequest, "id is required")
		return
	}
	if s.db == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	switch r.Method {
	case http.MethodGet:
		rows, err := s.db.Query(`SELECT entry_id, rating FROM message_ratings WHERE session_id = ?`, sessionID)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()
		out := map[string]int{}
		for rows.Next() {
			var id string
			var v int
			if rows.Scan(&id, &v) == nil {
				out[id] = v
			}
		}
		writeJSON(w, 0, map[string]any{"ratings": out})
	case http.MethodPost:
		var body struct {
			EntryID string `json:"entryId"`
			Rating  int    `json:"rating"`
		}
		if !decodeJSONBody(w, r, &body) {
			return
		}
		if body.EntryID == "" || body.Rating < -1 || body.Rating > 1 {
			writeJSONError(w, http.StatusBadRequest, "entryId and rating (-1, 0, 1) are required")
			return
		}
		var err error
		if body.Rating == 0 {
			_, err = s.db.Exec(`DELETE FROM message_ratings WHERE session_id = ? AND entry_id = ?`, sessionID, body.EntryID)
		} else {
			_, err = s.db.Exec(`INSERT INTO message_ratings (session_id, entry_id, rating, rated_by, updated_at) VALUES (?, ?, ?, ?, ?)
				ON CONFLICT(session_id, entry_id) DO UPDATE SET rating = excluded.rating, rated_by = excluded.rated_by, updated_at = excluded.updated_at`,
				sessionID, body.EntryID, body.Rating, s.currentUser(r).Login, s.now().UTC().Format(time.RFC3339))
		}
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, 0, map[string]any{"ok": true})
	default:
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}
