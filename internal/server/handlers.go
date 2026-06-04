package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"pi-web/internal/agentdir"
	"pi-web/internal/sessions"
	"pi-web/internal/widgets"
)

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	// "/" is registered as a catch-all subtree, so it also matches any path
	// without a more specific route. Only the root is the index; anything else
	// is a genuine 404. Serving index HTML for e.g. a missing /static/assets/*.js
	// would surface in the browser as a "module script has MIME text/html" error.
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	summaries, err := s.loadSummaries()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	s.reapOrphanedBtw(summaries)
	summaries = s.filterEnabledSummaries(summaries)
	summaries = s.filterBtwSummaries(summaries)
	sessions.SortSummariesByActivity(summaries)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.renderIndex(w, summaries); err != nil {
		if !isBrokenPipe(err) {
			fmt.Fprintf(os.Stderr, "template error: %v\n", err)
		}
	}
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	resolved, err := s.cache.Resolve(s.sessionsDir, r.URL.Query().Get("id"))
	if err != nil {
		switch {
		case errors.Is(err, sessions.ErrInvalidSessionID):
			http.Error(w, "invalid session id", 400)
		case errors.Is(err, sessions.ErrSessionNotFound):
			http.Error(w, "session not found", 404)
		default:
			http.Error(w, err.Error(), 500)
		}
		return
	}
	scratchpad := ""
	if resolved.Session.Header != nil {
		if cwd, ok := resolved.Session.Header["cwd"].(string); ok && cwd != "" {
			if content, err := s.lookupScratchpad(cwd); err == nil {
				scratchpad = content
			}
		}
	}
	// Page-load widget bootstrap: ensure an RPC worker exists for this session
	// so its extensions run session_start and emit setWidget events. Without
	// this, /api/widgets would be empty until the user actually starts a chat.
	// EnsureWorker is idempotent — it reuses an existing worker if one is
	// already running, otherwise spawns one via the factory (which wires the
	// WidgetSink in app.go). Background-context so we don't block the page
	// render on worker startup. The 10-min idle reaper handles cleanup.
	if s.chatSender != nil && s.widgets != nil {
		go func(sessionID, sessionPath string) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = s.chatSender.EnsureWorker(ctx, sessionID, sessionPath)
		}(resolved.Session.ID, resolved.Path)
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.WriteString(w, s.renderLiveSession(resolved.Session, scratchpad))
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
	if err != nil {
		switch {
		case errors.Is(err, sessions.ErrInvalidSessionID):
			writeJSONError(w, http.StatusBadRequest, "invalid session id")
		case errors.Is(err, sessions.ErrSessionNotFound):
			writeJSONError(w, http.StatusNotFound, "not found")
		default:
			writeJSONError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	id, err := sessions.ForkSessionFile(s.sessionsDir, resolved.Path, body.EntryID, s.now)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if s.chatSender != nil {
		if resolved, err := sessions.ResolveByID(s.sessionsDir, id); err == nil {
			go s.initializeNewSessionWorker(r.Context(), resolved.Session.ID, resolved.Path, sessions.InitialSettings{})
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
	_ = json.NewDecoder(r.Body).Decode(&body)

	resolved, err := s.cache.Resolve(s.sessionsDir, r.URL.Query().Get("id"))
	if err != nil {
		switch {
		case errors.Is(err, sessions.ErrInvalidSessionID):
			writeJSONError(w, http.StatusBadRequest, "invalid session id")
		case errors.Is(err, sessions.ErrSessionNotFound):
			writeJSONError(w, http.StatusNotFound, "not found")
		default:
			writeJSONError(w, http.StatusInternalServerError, err.Error())
		}
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
			go s.initializeNewSessionWorker(r.Context(), resolved.Session.ID, resolved.Path, sessions.InitialSettings{})
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

	project := r.URL.Query().Get("project")
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
	sessions.SortSummariesByActivity(summaries)

	writeJSON(w, 0, map[string]any{"sessions": summaries})
}

// handleApiWidgets returns the current extension-widget snapshot for a session.
//
// GET /api/widgets?session=<id> → {"widgets": [{key, lines, placement, updated_at}, ...]}
//
// The widgets are populated by the RPC worker's setWidget event consumer in
// internal/app/app.go (a worker's stdout emits extension_ui_request events,
// the WidgetSink routes them into the per-session store). When no worker has
// ever run for the session, the snapshot is empty — the page-load worker
// bootstrap in handleSession addresses that case.
//
// Live updates are pushed via SSE `widget-update` events on the same per-
// session channel as chat-preview etc.; see BroadcastWidgetUpdate.
func (s *Server) handleApiWidgets(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session")
	if sessionID == "" {
		writeJSONError(w, http.StatusBadRequest, "session is required")
		return
	}
	if s.widgets == nil {
		writeJSON(w, 0, map[string]any{"widgets": []any{}})
		return
	}
	state := s.widgets.Get(sessionID)
	out := make([]widgets.Widget, 0, len(state))
	for _, wgt := range state {
		out = append(out, wgt)
	}
	// Deterministic ordering: aboveEditor first, then belowEditor, then
	// alphabetical by key inside each placement bucket. Keeps the UI stable.
	sort.Slice(out, func(i, j int) bool {
		pi, pj := placementRank(out[i].Placement), placementRank(out[j].Placement)
		if pi != pj {
			return pi < pj
		}
		return out[i].Key < out[j].Key
	})
	writeJSON(w, 0, map[string]any{"widgets": out})
}

func placementRank(p string) int {
	switch p {
	case "aboveEditor":
		return 0
	case "belowEditor":
		return 1
	default:
		return 2
	}
}

func (s *Server) handleApiSession(w http.ResponseWriter, r *http.Request) {
	resolved, err := s.cache.Resolve(s.sessionsDir, r.URL.Query().Get("id"))
	if err != nil {
		switch {
		case errors.Is(err, sessions.ErrInvalidSessionID):
			writeJSONError(w, http.StatusBadRequest, "invalid session id")
		case errors.Is(err, sessions.ErrSessionNotFound):
			writeJSONError(w, http.StatusNotFound, "not found")
		default:
			writeJSONError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, 0, map[string]any{
		"header":  resolved.Session.Header,
		"entries": resolved.Session.Entries,
		"name":    resolved.Session.Name,
	})
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
	if err != nil {
		switch {
		case errors.Is(err, sessions.ErrInvalidSessionID):
			writeJSONError(w, http.StatusBadRequest, "invalid session id")
		case errors.Is(err, sessions.ErrSessionNotFound):
			writeJSONError(w, http.StatusNotFound, "not found")
		default:
			writeJSONError(w, http.StatusInternalServerError, err.Error())
		}
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
