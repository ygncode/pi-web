package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"pi-web/internal/identity"
)

// sharedRoot is the prefix every per-user folder lives under.
const sharedRoot = "/home/symetrix/shared"

// handleApiSuggestedPath returns the caller's own shared folder, so the
// new-session modal can pre-fill it. With multi-user off it returns "" and the
// frontend keeps its normal behaviour. The folder must exist on disk; we do
// not create it — ops owns the shared tree.
func (s *Server) handleApiSuggestedPath(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	me := s.currentUser(r)
	if !me.Known() {
		writeJSON(w, 0, map[string]any{"path": ""})
		return
	}
	name := identity.ShortName(me.Login)
	if name == "" {
		writeJSON(w, 0, map[string]any{"path": ""})
		return
	}
	for _, p := range []string{
		filepath.Join(sharedRoot, name),
		filepath.Join("/home", name),
	} {
		if fi, err := os.Stat(p); err == nil && fi.IsDir() {
			writeJSON(w, 0, map[string]any{"path": p})
			return
		}
	}
	writeJSON(w, 0, map[string]any{"path": ""})
}

// suggestedPathEnabled is true only in multi-user mode with an identity
// resolver; single-user installs keep the modal as-is.
func (s *Server) suggestedPathEnabled() bool {
	return s.multiUser && s.identity != nil
}

// isUserSharedPath reports whether p is under the shared root.
func isUserSharedPath(p string) bool {
	return strings.HasPrefix(filepath.Clean(p), sharedRoot+"/")
}
