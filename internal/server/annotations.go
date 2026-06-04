package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Annotations are reviewer-authored notes anchored to a span of a rendered
// session entry (or artifact). They are NOT session data — they live in the
// app database, keyed by session id, and never touch the append-only JSONL.
const annotationsSchema = `CREATE TABLE IF NOT EXISTS annotations (
	id           TEXT PRIMARY KEY,
	session_id   TEXT NOT NULL,
	anchor_id    TEXT NOT NULL,
	start_offset INTEGER NOT NULL,
	end_offset   INTEGER NOT NULL,
	kind         TEXT NOT NULL,
	text         TEXT,
	original     TEXT,
	source       TEXT,
	created_at   INTEGER
)`

const annotationsIndex = `CREATE INDEX IF NOT EXISTS idx_annotations_session ON annotations (session_id)`

type annotation struct {
	ID          string `json:"id"`
	SessionID   string `json:"sessionId"`
	AnchorID    string `json:"anchorId"`
	StartOffset int    `json:"startOffset"`
	EndOffset   int    `json:"endOffset"`
	Kind        string `json:"kind"`
	Text        string `json:"text"`
	Original    string `json:"original"`
	Source      string `json:"source"`
	CreatedAt   int64  `json:"createdAt"`
}

func newAnnotationID() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("ann-%d", time.Now().UnixNano())
	}
	return "ann-" + hex.EncodeToString(b)
}

func (s *Server) listAnnotations(sessionID string) ([]annotation, error) {
	out := []annotation{}
	if s.db == nil || sessionID == "" {
		return out, nil
	}
	rows, err := s.db.Query(`SELECT id, session_id, anchor_id, start_offset, end_offset, kind, text, original, source, created_at
		FROM annotations WHERE session_id = ? ORDER BY created_at, id`, sessionID)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var a annotation
		if err := rows.Scan(&a.ID, &a.SessionID, &a.AnchorID, &a.StartOffset, &a.EndOffset,
			&a.Kind, &a.Text, &a.Original, &a.Source, &a.CreatedAt); err != nil {
			return out, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// broadcastAnnotations pushes the full annotation set for a session to every SSE
// client on that session topic. A snapshot (rather than granular add/remove
// events) keeps the client simple: it just re-renders.
func (s *Server) broadcastAnnotations(sessionID string) {
	anns, err := s.listAnnotations(sessionID)
	if err != nil {
		return
	}
	msg, err := formatSSEJSONEvent("annotations", map[string]any{"type": "snapshot", "annotations": anns})
	if err != nil {
		return
	}
	s.broadcast(sessionID, msg)
}

func (s *Server) handleAnnotations(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleListAnnotations(w, r)
	case http.MethodPost:
		s.handleCreateAnnotation(w, r)
	case http.MethodDelete:
		s.handleDeleteAnnotation(w, r)
	default:
		w.Header().Set("Allow", "GET, POST, DELETE")
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleListAnnotations(w http.ResponseWriter, r *http.Request) {
	session := r.URL.Query().Get("session")
	if session == "" {
		writeJSONError(w, http.StatusBadRequest, "session query parameter is required")
		return
	}
	if s.db == nil {
		writeJSONError(w, http.StatusInternalServerError, "database is unavailable")
		return
	}
	anns, err := s.listAnnotations(session)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query annotations: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"annotations": anns})
}

func (s *Server) handleCreateAnnotation(w http.ResponseWriter, r *http.Request) {
	session := r.URL.Query().Get("session")
	if session == "" {
		writeJSONError(w, http.StatusBadRequest, "session query parameter is required")
		return
	}
	if s.db == nil {
		writeJSONError(w, http.StatusInternalServerError, "database is unavailable")
		return
	}

	var a annotation
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if a.AnchorID == "" {
		writeJSONError(w, http.StatusBadRequest, "anchorId is required")
		return
	}
	if a.EndOffset < a.StartOffset || a.StartOffset < 0 {
		writeJSONError(w, http.StatusBadRequest, "invalid offsets")
		return
	}

	a.SessionID = session
	if a.ID == "" {
		a.ID = newAnnotationID()
	}
	if a.Kind == "" {
		a.Kind = "comment"
	}
	if a.Source == "" {
		a.Source = "local"
	}
	if a.CreatedAt == 0 {
		a.CreatedAt = time.Now().UnixMilli()
	}

	_, err := s.db.Exec(`INSERT INTO annotations
		(id, session_id, anchor_id, start_offset, end_offset, kind, text, original, source, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			anchor_id=excluded.anchor_id, start_offset=excluded.start_offset, end_offset=excluded.end_offset,
			kind=excluded.kind, text=excluded.text, original=excluded.original`,
		a.ID, a.SessionID, a.AnchorID, a.StartOffset, a.EndOffset, a.Kind, a.Text, a.Original, a.Source, a.CreatedAt)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to save annotation: "+err.Error())
		return
	}

	s.broadcastAnnotations(session)
	writeJSON(w, http.StatusOK, map[string]any{"annotation": a})
}

func (s *Server) handleDeleteAnnotation(w http.ResponseWriter, r *http.Request) {
	session := r.URL.Query().Get("session")
	id := r.URL.Query().Get("id")
	if session == "" || id == "" {
		writeJSONError(w, http.StatusBadRequest, "session and id query parameters are required")
		return
	}
	if s.db == nil {
		writeJSONError(w, http.StatusInternalServerError, "database is unavailable")
		return
	}

	if _, err := s.db.Exec(`DELETE FROM annotations WHERE id = ? AND session_id = ?`, id, session); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to delete annotation: "+err.Error())
		return
	}

	s.broadcastAnnotations(session)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
