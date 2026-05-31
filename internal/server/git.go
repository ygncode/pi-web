package server

import (
	"encoding/json"
	"errors"
	"net/http"

	"pi-web/internal/git"
	"pi-web/internal/sessions"
)

// resolveSessionCwd resolves a session id to its working directory (the cwd
// recorded in the session header).
func (s *Server) resolveSessionCwd(id string) (sessions.ResolvedSession, string, error) {
	var resolved sessions.ResolvedSession
	var err error
	if s.cache != nil {
		resolved, err = s.cache.Resolve(s.sessionsDir, id)
	} else {
		resolved, err = sessions.ResolveByID(s.sessionsDir, id)
	}
	if err != nil {
		return resolved, "", err
	}
	cwd, _ := resolved.Session.Header["cwd"].(string)
	return resolved, cwd, nil
}

func writeSessionLookupError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sessions.ErrInvalidSessionID):
		writeJSONError(w, http.StatusBadRequest, "invalid session id")
	case errors.Is(err, sessions.ErrSessionNotFound):
		writeJSONError(w, http.StatusNotFound, "not found")
	default:
		writeJSONError(w, http.StatusInternalServerError, err.Error())
	}
}

// handleGitInfo returns the current branch and a GitHub PR URL for the
// session's working directory. Non-repo cwds return {isRepo:false}.
func (s *Server) handleGitInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	_, cwd, err := s.resolveSessionCwd(r.URL.Query().Get("id"))
	if err != nil {
		writeSessionLookupError(w, err)
		return
	}
	info, _ := git.Describe(cwd)
	writeJSON(w, 0, info)
}

// handleGitRenameBranch renames the checked-out branch in the session's cwd.
func (s *Server) handleGitRenameBranch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	_, cwd, err := s.resolveSessionCwd(r.URL.Query().Get("id"))
	if err != nil {
		writeSessionLookupError(w, err)
		return
	}
	branch, err := git.RenameBranch(cwd, body.Name)
	if err != nil {
		switch {
		case errors.Is(err, git.ErrInvalidBranchName):
			writeJSONError(w, http.StatusBadRequest, "invalid branch name")
		case errors.Is(err, git.ErrDefaultBranch):
			writeJSONError(w, http.StatusBadRequest, "refusing to rename the default branch")
		case errors.Is(err, git.ErrNotRepo):
			writeJSONError(w, http.StatusBadRequest, "not a git repository")
		default:
			writeJSONError(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	writeJSON(w, 0, map[string]any{"ok": true, "branch": branch})
}
