package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	"pi-web/internal/sessions"
)

// settingBtwSessionID is the legacy app_settings key that held the id of the
// single, global "btw" scratch-chat. It is migrated into btw_sessions on
// startup and no longer written.
const settingBtwSessionID = "btw_session_id"

// settingShowBtwInIndex toggles whether btw scratch-chats appear in the session
// list. Off by default; surfaced on the /settings page.
const settingShowBtwInIndex = "pi-web:v1:show-btw-in-index"

// btwGlobalParent is the sentinel parent_id used when a btw chat is opened with
// no parent session (a future index-level btw). The legacy single global btw
// migrates under this key so existing users do not lose their chat.
const btwGlobalParent = "__global__"

// btwSessionsSchema records every btw scratch-chat. Each parent session page has
// at most one active (active=1) btw; pressing "new" orphans the prior one
// (active=0) but keeps it on disk. Rows persist after orphaning so btw sessions
// stay identifiable — and hideable from the index — for their whole lifetime.
const btwSessionsSchema = `CREATE TABLE IF NOT EXISTS btw_sessions (
	btw_id    TEXT PRIMARY KEY,
	parent_id TEXT NOT NULL,
	active    INTEGER NOT NULL DEFAULT 1
)`

// migrateLegacyBtwSession moves the old single-row app_settings btw pointer into
// the per-parent registry under the global sentinel. Idempotent and a no-op once
// the legacy key is gone.
func migrateLegacyBtwSession(db *sql.DB) {
	if db == nil {
		return
	}
	var id string
	if err := db.QueryRow("SELECT value FROM app_settings WHERE key = ?", settingBtwSessionID).Scan(&id); err != nil || id == "" {
		return
	}
	_, _ = db.Exec(`INSERT INTO btw_sessions (btw_id, parent_id, active) VALUES (?, ?, 1)
		ON CONFLICT(btw_id) DO NOTHING`, id, btwGlobalParent)
	_, _ = db.Exec("DELETE FROM app_settings WHERE key = ?", settingBtwSessionID)
}

func normalizeBtwParent(parent string) string {
	if parent == "" {
		return btwGlobalParent
	}
	return parent
}

// getBtwSessionID returns the active btw session id for a parent, or "".
func (s *Server) getBtwSessionID(parentID string) string {
	if s.db == nil {
		return ""
	}
	var v string
	if err := s.db.QueryRow(
		"SELECT btw_id FROM btw_sessions WHERE parent_id = ? AND active = 1",
		normalizeBtwParent(parentID)).Scan(&v); err != nil {
		return ""
	}
	return v
}

// setBtwSessionID records id as the active btw for parentID, orphaning any prior
// active btw for that parent (kept on disk, active=0). Broadcasts the change on
// the parent's SSE topic so other devices viewing that page re-sync in realtime.
func (s *Server) setBtwSessionID(parentID, id string) {
	if s.db == nil || id == "" {
		return
	}
	parentID = normalizeBtwParent(parentID)
	if id == s.getBtwSessionID(parentID) {
		return
	}
	tx, err := s.db.Begin()
	if err != nil {
		return
	}
	if _, err := tx.Exec("UPDATE btw_sessions SET active = 0 WHERE parent_id = ?", parentID); err != nil {
		_ = tx.Rollback()
		return
	}
	if _, err := tx.Exec(`INSERT INTO btw_sessions (btw_id, parent_id, active) VALUES (?, ?, 1)
		ON CONFLICT(btw_id) DO UPDATE SET parent_id=excluded.parent_id, active=1`, id, parentID); err != nil {
		_ = tx.Rollback()
		return
	}
	if err := tx.Commit(); err != nil {
		return
	}
	s.broadcastBtwChanged(parentID, id)
}

// deleteBtwRow removes a btw registry row (used when its session file is gone).
func (s *Server) deleteBtwRow(id string) {
	if s.db == nil || id == "" {
		return
	}
	_, _ = s.db.Exec("DELETE FROM btw_sessions WHERE btw_id = ?", id)
}

// broadcastBtwChanged tells clients viewing parentID which session is now its
// btw. Scoped to the parent's topic so only windows opened from that page
// re-sync. Empty id means "no btw" (e.g. the pointer was cleared).
func (s *Server) broadcastBtwChanged(parentID, id string) {
	msg, err := formatSSEJSONEvent("btw-changed", map[string]string{"sessionId": id})
	if err != nil {
		return
	}
	s.broadcast(normalizeBtwParent(parentID), msg)
}

// btwSessionIDs returns every session id that is a btw scratch-chat (active or
// orphaned), used to hide them from the index.
func (s *Server) btwSessionIDs() map[string]bool {
	if s.db == nil {
		return nil
	}
	rows, err := s.db.Query("SELECT btw_id FROM btw_sessions")
	if err != nil {
		return nil
	}
	defer rows.Close()
	set := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue
		}
		set[id] = true
	}
	return set
}

// showBtwInIndex reports whether btw scratch-chats should appear in the session
// list. Off by default; toggled on the /settings page.
func (s *Server) showBtwInIndex() bool {
	return s.getSetting(settingShowBtwInIndex, "false") == "true"
}

// filterBtwSummaries drops btw scratch-chats from the list unless the user has
// opted to show them. A no-op when none exist or showing is enabled.
func (s *Server) filterBtwSummaries(summaries []sessions.SessionSummary) []sessions.SessionSummary {
	if s.showBtwInIndex() {
		return summaries
	}
	hidden := s.btwSessionIDs()
	if len(hidden) == 0 {
		return summaries
	}
	out := make([]sessions.SessionSummary, 0, len(summaries))
	for _, sum := range summaries {
		if !hidden[sum.ID] {
			out = append(out, sum)
		}
	}
	return out
}

// reapOrphanedBtw deletes btw sessions whose parent session no longer exists,
// removing both the registry row and the session file so a btw never outlives
// its parent. The __global__ sentinel parent is never reaped. `all` must be the
// full, unfiltered session list.
func (s *Server) reapOrphanedBtw(all []sessions.SessionSummary) {
	if s.db == nil {
		return
	}
	existing := make(map[string]bool, len(all))
	for _, sum := range all {
		existing[sum.ID] = true
	}
	rows, err := s.db.Query("SELECT btw_id, parent_id FROM btw_sessions")
	if err != nil {
		return
	}
	type orphan struct{ btwID string }
	var orphans []orphan
	for rows.Next() {
		var btwID, parentID string
		if err := rows.Scan(&btwID, &parentID); err != nil {
			continue
		}
		if parentID == btwGlobalParent || existing[parentID] {
			continue
		}
		orphans = append(orphans, orphan{btwID})
	}
	rows.Close()
	for _, o := range orphans {
		if resolved, err := sessions.ResolveByID(s.sessionsDir, o.btwID); err == nil {
			_ = os.Remove(resolved.Path)
		}
		s.deleteBtwRow(o.btwID)
	}
}

// handleGetBtw returns the active btw session id for the given parent, clearing
// the row if the session file has since been deleted so the client falls back to
// its empty state.
func (s *Server) handleGetBtw(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	parent := normalizeBtwParent(r.URL.Query().Get("parent"))
	id := s.getBtwSessionID(parent)
	if id != "" {
		if _, err := sessions.ResolveByID(s.sessionsDir, id); err != nil {
			s.deleteBtwRow(id)
			s.broadcastBtwChanged(parent, "")
			id = ""
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"sessionId": id})
}

// handleNewBtw creates a fresh session and records it as the active btw for the
// caller's parent (orphaning the previous one). The path defaults to the home
// directory when the caller does not supply one.
func (s *Server) handleNewBtw(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		Path   string `json:"path"`
		Parent string `json:"parent"`
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
	s.setBtwSessionID(body.Parent, id)

	// Pre-warm a worker so the first chat message lands quickly, mirroring
	// handleNewSession.
	if s.chatSender != nil {
		if resolved, err := sessions.ResolveByID(s.sessionsDir, id); err == nil {
			go s.initializeNewSessionWorker(context.Background(), resolved.Session.ID, resolved.Path, sessions.InitialSettings{})
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}
