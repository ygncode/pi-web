package server

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

// lookupScratchpad returns the saved scratchpad content for a project path.
// An unknown project (or no database) yields an empty string, not an error, so
// callers on the page-render path can pre-fill the textarea best-effort.
func (s *Server) lookupScratchpad(project string) (string, error) {
	if project == "" || s.db == nil {
		return "", nil
	}
	var content string
	err := s.db.QueryRow("SELECT content FROM scratchpads WHERE project_path = ?", project).Scan(&content)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return content, err
}

func (s *Server) handleGetScratchpad(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	project := r.URL.Query().Get("project")
	if project == "" {
		writeJSONError(w, http.StatusBadRequest, "project query parameter is required")
		return
	}

	if s.db == nil {
		writeJSONError(w, http.StatusInternalServerError, "database is unavailable")
		return
	}

	content, err := s.lookupScratchpad(project)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query scratchpad: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"content": content})
}

func (s *Server) handleSaveScratchpad(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var body struct {
		Project string `json:"project"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	if body.Project == "" {
		writeJSONError(w, http.StatusBadRequest, "project is required")
		return
	}

	if s.db == nil {
		writeJSONError(w, http.StatusInternalServerError, "database is unavailable")
		return
	}

	_, err := s.db.Exec(`INSERT INTO scratchpads (project_path, content, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(project_path) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at`,
		body.Project, body.Content, time.Now())
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to save scratchpad: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
