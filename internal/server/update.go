package server

import (
	"context"
	"net/http"
	"time"
)

// handleVersion returns the cached version/update snapshot. GET only.
func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, 0, s.updater.Info())
}

// handleCheckUpdate forces a fresh remote check (bypassing the 6h cache) and
// returns the resulting snapshot. POST only.
func (s *Server) handleCheckUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	info, err := s.updater.Check(ctx)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "could not check for updates: "+err.Error())
		return
	}
	writeJSON(w, 0, info)
}

// handleUpdate runs the install command synchronously and reports whether a
// restart is needed to pick up the new binary. POST only. The actual restart
// is a separate call (/api/restart) so the UI can sequence it explicitly.
func (s *Server) handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if s.runInstall == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "in-place update is not available")
		return
	}
	s.updateMu.Lock()
	defer s.updateMu.Unlock()

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()
	if err := s.runInstall(ctx); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "update failed: "+err.Error())
		return
	}
	writeJSON(w, 0, map[string]any{"status": "updated", "needsRestart": true})
}

// handleRestart spawns a detached restart of the pi-web service and then lets
// the process exit. The response is flushed before the restart fires so the
// browser receives it; the browser then polls until the new process is up.
// POST only.
func (s *Server) handleRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if s.runRestart == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "restart is not available")
		return
	}
	writeJSON(w, 0, map[string]any{"status": "restarting"})
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	// Give the response a moment to reach the client before we tear down.
	go func() {
		time.Sleep(300 * time.Millisecond)
		_ = s.runRestart()
	}()
}
