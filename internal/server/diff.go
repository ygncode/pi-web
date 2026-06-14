package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"pi-web/internal/git"
)

// Review comments are GitHub-style notes a reviewer attaches to a line range of
// the session's working-tree diff. Like annotations they are NOT session data —
// they live in the app database keyed by session id and never touch the
// append-only JSONL.
const reviewCommentsSchema = `CREATE TABLE IF NOT EXISTS review_comments (
	id          TEXT PRIMARY KEY,
	session_id  TEXT NOT NULL,
	file        TEXT NOT NULL,
	start_line  INTEGER NOT NULL,
	end_line    INTEGER NOT NULL,
	side        TEXT NOT NULL,
	body        TEXT,
	created_at  INTEGER
)`

const reviewCommentsIndex = `CREATE INDEX IF NOT EXISTS idx_review_comments_session ON review_comments (session_id)`

type reviewComment struct {
	ID        string `json:"id"`
	SessionID string `json:"sessionId"`
	File      string `json:"file"`
	StartLine int    `json:"startLine"`
	EndLine   int    `json:"endLine"`
	Side      string `json:"side"`
	Body      string `json:"body"`
	CreatedAt int64  `json:"createdAt"`
}

func newReviewCommentID() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("rc-%d", time.Now().UnixNano())
	}
	return "rc-" + hex.EncodeToString(b)
}

// handleGitDiff returns the uncommitted working-tree diff (tracked changes plus
// untracked files) for the session's cwd, along with the current branch.
func (s *Server) handleGitDiff(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	_, cwd, err := s.resolveSessionCwd(r.URL.Query().Get("id"))
	if resolveOrWriteError(w, err) {
		return
	}
	diff, err := git.WorkingTreeDiff(cwd)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"isRepo": false, "diff": ""})
		return
	}
	branch, _ := git.CurrentBranch(cwd)
	writeJSON(w, http.StatusOK, map[string]any{"isRepo": true, "diff": diff, "branch": branch})
}

func (s *Server) listReviewComments(sessionID string) ([]reviewComment, error) {
	out := []reviewComment{}
	if s.db == nil || sessionID == "" {
		return out, nil
	}
	rows, err := s.db.Query(`SELECT id, session_id, file, start_line, end_line, side, body, created_at
		FROM review_comments WHERE session_id = ? ORDER BY created_at, id`, sessionID)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var c reviewComment
		if err := rows.Scan(&c.ID, &c.SessionID, &c.File, &c.StartLine, &c.EndLine,
			&c.Side, &c.Body, &c.CreatedAt); err != nil {
			return out, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Server) handleReviewComments(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleListReviewComments(w, r)
	case http.MethodPost:
		s.handleCreateReviewComment(w, r)
	case http.MethodDelete:
		s.handleDeleteReviewComment(w, r)
	default:
		w.Header().Set("Allow", "GET, POST, DELETE")
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleListReviewComments(w http.ResponseWriter, r *http.Request) {
	session := r.URL.Query().Get("session")
	if session == "" {
		writeJSONError(w, http.StatusBadRequest, "session query parameter is required")
		return
	}
	if s.db == nil {
		writeJSONError(w, http.StatusInternalServerError, "database is unavailable")
		return
	}
	comments, err := s.listReviewComments(session)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query review comments: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"comments": comments})
}

func (s *Server) handleCreateReviewComment(w http.ResponseWriter, r *http.Request) {
	session := r.URL.Query().Get("session")
	if session == "" {
		writeJSONError(w, http.StatusBadRequest, "session query parameter is required")
		return
	}
	if s.db == nil {
		writeJSONError(w, http.StatusInternalServerError, "database is unavailable")
		return
	}

	var c reviewComment
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if c.File == "" {
		writeJSONError(w, http.StatusBadRequest, "file is required")
		return
	}
	if c.StartLine < 1 || c.EndLine < c.StartLine {
		writeJSONError(w, http.StatusBadRequest, "invalid line range")
		return
	}

	c.SessionID = session
	if c.ID == "" {
		c.ID = newReviewCommentID()
	}
	if c.Side != "old" {
		c.Side = "new"
	}
	if c.CreatedAt == 0 {
		c.CreatedAt = time.Now().UnixMilli()
	}

	_, err := s.db.Exec(`INSERT INTO review_comments
		(id, session_id, file, start_line, end_line, side, body, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			file=excluded.file, start_line=excluded.start_line, end_line=excluded.end_line,
			side=excluded.side, body=excluded.body`,
		c.ID, c.SessionID, c.File, c.StartLine, c.EndLine, c.Side, c.Body, c.CreatedAt)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to save review comment: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"comment": c})
}

func (s *Server) handleDeleteReviewComment(w http.ResponseWriter, r *http.Request) {
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
	if _, err := s.db.Exec(`DELETE FROM review_comments WHERE id = ? AND session_id = ?`, id, session); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to delete review comment: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
