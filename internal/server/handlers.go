package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"pi-web/internal/agentdir"
	"pi-web/internal/sessions"
	"pi-web/internal/ui"
)

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	// "/" is registered as a catch-all subtree, so it also matches any path
	// without a more specific route. Only the root is the index; anything else
	// is a genuine 404. Serving index HTML for e.g. a missing /static/assets/*.js
	// would surface in the browser as a "module script has MIME text/html" error.
	if r.URL.Path != "/" {
		if s.renderAppShell != nil && isSPABrowserPath(r) {
			s.handleAppShell(w, r, "")
			return
		}
		http.NotFound(w, r)
		return
	}
	s.handleAppShell(w, r, "")
}

func isSPABrowserPath(r *http.Request) bool {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return false
	}
	path := r.URL.Path
	if path == "" || path == "/" {
		return false
	}
	for _, prefix := range []string{
		"/api/",
		"/api",
		"/static/",
		"/sounds/",
		"/debug/",
	} {
		if path == prefix || strings.HasPrefix(path, prefix) {
			return false
		}
	}
	last := path[strings.LastIndex(path, "/")+1:]
	if strings.Contains(last, ".") {
		return false
	}
	return true
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	// Embed the session payload so the SPA paints without round-trips to
	// /api/session and /api/scratchpad. Empty when the id is missing/unresolved;
	// the client then falls back to fetching (and shows a proper error).
	bootstrap := ""
	if id := r.URL.Query().Get("id"); id != "" {
		bootstrap = s.sessionBootstrap(id)
	}
	s.handleAppShell(w, r, bootstrap)
}

func (s *Server) handleApiForkSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		EntryID string `json:"entryId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if body.EntryID == "" {
		writeJSONError(w, http.StatusBadRequest, "entryId is required")
		return
	}

	resolved, err := s.cache.Resolve(s.sessionsDir, r.URL.Query().Get("id"))
	if resolveOrWriteError(w, err) {
		return
	}

	id, err := sessions.ForkSessionFile(s.sessionsDir, resolved.Path, body.EntryID, s.now)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if s.chatSender != nil {
		if resolved, err := sessions.ResolveByID(s.sessionsDir, id); err == nil {
			go s.initializeNewSessionWorker(context.Background(), resolved.Session.ID, resolved.Path, sessions.InitialSettings{})
		}
	}

	writeJSON(w, 0, map[string]any{"ok": true, "id": id})
}

func (s *Server) handleApiCloneSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		LeafID string `json:"leafId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	resolved, err := s.cache.Resolve(s.sessionsDir, r.URL.Query().Get("id"))
	if resolveOrWriteError(w, err) {
		return
	}

	leafID := body.LeafID
	if leafID == "" {
		// Default to the last entry if no leaf was specified.
		if len(resolved.Session.Entries) > 0 {
			last := resolved.Session.Entries[len(resolved.Session.Entries)-1]
			if id, ok := last["id"].(string); ok {
				leafID = id
			}
		}
	}
	if leafID == "" {
		writeJSONError(w, http.StatusBadRequest, "no leaf entry available")
		return
	}

	id, err := sessions.CloneSessionFile(s.sessionsDir, resolved.Path, leafID, s.now)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if s.chatSender != nil {
		if resolved, err := sessions.ResolveByID(s.sessionsDir, id); err == nil {
			go s.initializeNewSessionWorker(context.Background(), resolved.Session.ID, resolved.Path, sessions.InitialSettings{})
		}
	}

	writeJSON(w, 0, map[string]any{"ok": true, "id": id})
}

func (s *Server) handleApiSessions(w http.ResponseWriter, r *http.Request) {
	summaries, err := s.loadSummaries()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.reapOrphanedReviewComments(summaries)

	q := r.URL.Query()
	project := q.Get("project")
	if project != "" {
		filtered := make([]sessions.SessionSummary, 0, len(summaries))
		for _, sum := range summaries {
			if sum.Project == project {
				filtered = append(filtered, sum)
			}
		}
		summaries = filtered
	} else {
		summaries = s.filterEnabledSummaries(summaries)
	}
	summaries = s.filterBtwSummaries(summaries)

	if query := strings.TrimSpace(q.Get("q")); query != "" {
		summaries = filterSummariesByQuery(summaries, query)
	}

	sessions.SortSummariesByActivity(summaries)

	total := len(summaries)
	summaries = paginateSummaries(summaries, q.Get("offset"), q.Get("limit"))

	writeJSON(w, 0, map[string]any{"sessions": summaries, "total": total})
}

// filterSummariesByQuery keeps summaries whose name, project, model, or UUID
// contains query (case-insensitive). Mirrors the frontend sessionSearchText so
// the command palette and the browse feed match on the same fields.
func filterSummariesByQuery(summaries []sessions.SessionSummary, query string) []sessions.SessionSummary {
	q := strings.ToLower(query)
	out := make([]sessions.SessionSummary, 0, len(summaries))
	for _, sum := range summaries {
		model := sum.Model
		if sum.ModelProvider != "" && sum.Model != "" {
			model = sum.ModelProvider + "/" + sum.Model
		}
		haystack := strings.ToLower(strings.Join([]string{sum.Name, sum.Project, model, sum.SessionUUID}, " "))
		if strings.Contains(haystack, q) {
			out = append(out, sum)
		}
	}
	return out
}

// paginateSummaries returns summaries[offset:offset+limit] when limit parses as
// a positive int. A missing or invalid limit returns the full slice so existing
// callers (and the export) keep receiving every session.
func paginateSummaries(summaries []sessions.SessionSummary, offsetStr, limitStr string) []sessions.SessionSummary {
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		return summaries
	}
	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}
	if offset >= len(summaries) {
		return []sessions.SessionSummary{}
	}
	end := offset + limit
	if end > len(summaries) {
		end = len(summaries)
	}
	return summaries[offset:end]
}

func (s *Server) handleApiSession(w http.ResponseWriter, r *http.Request) {
	resolved, err := s.cache.Resolve(s.sessionsDir, r.URL.Query().Get("id"))
	if resolveOrWriteError(w, err) {
		return
	}

	// Optional pagination: ?from=N&count=K returns entries[N:N+K]. Used by the
	// "Load earlier" affordance in the frontend for huge sessions whose tails
	// were the only thing embedded in the initial HTML render. Both params
	// must be present and parse as non-negative ints to enable windowing;
	// otherwise the full entries slice is returned for backwards compat.
	entries := resolved.Session.Entries
	total := len(entries)
	from := 0
	q := r.URL.Query()
	fromStr := q.Get("from")
	countStr := q.Get("count")
	if fromStr != "" && countStr != "" {
		f, errF := strconv.Atoi(fromStr)
		c, errC := strconv.Atoi(countStr)
		if errF == nil && errC == nil && f >= 0 && c >= 0 {
			if f > total {
				f = total
			}
			end := f + c
			if end > total {
				end = total
			}
			entries = entries[f:end]
			from = f
		}
	} else if q.Get("paginate") == "1" {
		entries, total, from = paginatedEntries(resolved.Session.Entries)
	}

	writeJSON(w, 0, sessionResponseMap(resolved.Session, entries, total, from))
}

// paginatedEntries returns the tail window embedded on the initial session load
// for huge sessions (mirrors the ?paginate=1 API path). `total` is always the
// full count; `from` is the index the returned window starts at.
func paginatedEntries(entries []map[string]any) (out []map[string]any, total, from int) {
	total = len(entries)
	out = entries
	if total > ui.LargeSessionThreshold {
		from = total - ui.LargeSessionTailEntries
		if from < 0 {
			from = 0
		}
		out = entries[from:]
	}
	return out, total, from
}

// sessionResponseMap is the JSON shape the SPA consumes for a session, shared by
// the /api/session endpoint and the bootstrap embedded in the page shell.
func sessionResponseMap(session sessions.Session, entries []map[string]any, total, from int) map[string]any {
	return map[string]any{
		"header":             session.Header,
		"entries":            entries,
		"name":               session.Name,
		"total":              total,
		"from":               from,
		"chatAvailable":      session.ChatAvailable,
		"chatDisabledReason": session.ChatDisabledReason,
		"model":              session.Model,
		"modelProvider":      session.ModelProvider,
	}
}

// sessionBootstrap builds the base64 payload embedded in the session page shell
// so the SPA can render its first paint without round-trips to /api/session and
// /api/scratchpad. Returns "" when the id can't be resolved — the client then
// falls back to fetching, which surfaces a proper 404/error state.
func (s *Server) sessionBootstrap(id string) string {
	if s.cache == nil {
		return ""
	}
	resolved, err := s.cache.Resolve(s.sessionsDir, id)
	if err != nil {
		return ""
	}
	entries, total, from := paginatedEntries(resolved.Session.Entries)
	data := sessionResponseMap(resolved.Session, entries, total, from)

	scratchpad := ""
	if cwd, _ := resolved.Session.Header["cwd"].(string); cwd != "" {
		if content, err := s.lookupScratchpad(cwd); err == nil {
			scratchpad = content
		}
	}

	raw, err := json.Marshal(map[string]any{"id": id, "data": data, "scratchpad": scratchpad})
	if err != nil {
		return ""
	}
	return base64.StdEncoding.EncodeToString(raw)
}

func (s *Server) handleNewSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		Path            string `json:"path"`
		SourceSessionID string `json:"sourceSessionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if body.Path == "" {
		writeJSONError(w, http.StatusBadRequest, "path is required")
		return
	}

	settings := s.initialSettingsFromSource(r.Context(), body.SourceSessionID)
	id, err := sessions.CreateSessionFileWithSettings(s.sessionsDir, body.Path, settings)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Pre-initialize a worker so the session page can read default model and
	// thinking level immediately instead of waiting for the first chat message.
	// If the request came from an existing session page, copy that session's
	// current model and thinking level onto the new worker.
	if s.chatSender != nil {
		if resolved, err := sessions.ResolveByID(s.sessionsDir, id); err == nil {
			go s.initializeNewSessionWorker(context.Background(), resolved.Session.ID, resolved.Path, settings)
		}
	}

	writeJSON(w, 0, map[string]any{"ok": true, "id": id})
}

func (s *Server) handleRenameSession(w http.ResponseWriter, r *http.Request) {
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
	name := strings.TrimSpace(body.Name)
	if name == "" {
		writeJSONError(w, http.StatusBadRequest, "name is required")
		return
	}

	id := r.URL.Query().Get("id")
	var resolved sessions.ResolvedSession
	var err error
	if s.cache != nil {
		resolved, err = s.cache.Resolve(s.sessionsDir, id)
	} else {
		resolved, err = sessions.ResolveByID(s.sessionsDir, id)
	}
	if resolveOrWriteError(w, err) {
		return
	}

	if err := sessions.RenameSession(resolved.Path, name, s.now); err != nil {
		if errors.Is(err, sessions.ErrEmptySessionName) {
			writeJSONError(w, http.StatusBadRequest, "name is required")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if s.fileMod != nil {
		if info, err := os.Stat(resolved.Path); err == nil {
			s.recordModTime(resolved.Session.ID, info.ModTime())
		}
	}
	s.broadcast(resolved.Session.ID, "reload")
	writeJSON(w, 0, map[string]any{"ok": true, "name": name})
}

func (s *Server) handleLabelSessionEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		EntryID string `json:"entryId"`
		Label   string `json:"label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	entryID := strings.TrimSpace(body.EntryID)
	if entryID == "" {
		writeJSONError(w, http.StatusBadRequest, "entryId is required")
		return
	}

	id := r.URL.Query().Get("id")
	var resolved sessions.ResolvedSession
	var err error
	if s.cache != nil {
		resolved, err = s.cache.Resolve(s.sessionsDir, id)
	} else {
		resolved, err = sessions.ResolveByID(s.sessionsDir, id)
	}
	if resolveOrWriteError(w, err) {
		return
	}

	label := strings.TrimSpace(body.Label)
	if err := sessions.LabelSessionEntry(resolved.Path, entryID, label, s.now); err != nil {
		if errors.Is(err, sessions.ErrSessionEntryNotFound) {
			writeJSONError(w, http.StatusNotFound, "entry not found")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if s.fileMod != nil {
		if info, err := os.Stat(resolved.Path); err == nil {
			s.recordModTime(resolved.Session.ID, info.ModTime())
		}
	}
	s.broadcast(resolved.Session.ID, "reload")
	writeJSON(w, 0, map[string]any{"ok": true, "entryId": entryID, "label": label})
}

func (s *Server) handleRecentLocations(w http.ResponseWriter, r *http.Request) {
	locations, err := sessions.ListRecentLocations(s.sessionsDir)
	if err != nil {
		locations = []string{}
	}
	writeJSON(w, 0, map[string]any{"locations": locations})
}

func (s *Server) handleAvailableModels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	data, err := s.models(ctx)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			writeJSONError(w, http.StatusGatewayTimeout, "timed out waiting for model list")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var payload struct {
		Models []map[string]any `json:"models"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "invalid model list payload: "+err.Error())
		return
	}
	writeJSON(w, 0, map[string]any{"models": payload.Models})
}

func isBrokenPipe(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "broken pipe") || strings.Contains(msg, "connection reset by peer")
}

func (s *Server) handleCustomThemes(w http.ResponseWriter, r *http.Request) {
	path := filepath.Join(agentdir.WebDir(s.agentDir), "custom-themes.css")
	w.Header().Set("Content-Type", "text/css; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if _, err := os.Stat(path); err == nil {
		http.ServeFile(w, r, path)
	} else {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("/* No custom themes configured */"))
	}
}
