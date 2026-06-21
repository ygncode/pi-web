package server

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"pi-web/internal/chatqueue"
	"pi-web/internal/sessions"
)

// /api/chat/queue: single endpoint that demuxes on method.
//
//   GET    /api/chat/queue?id=<sessionID>             — list items + paused
//   POST   /api/chat/queue?id=<sessionID>             — append an item
//   DELETE /api/chat/queue?id=<sessionID>&position=N  — remove an item
//   PATCH  /api/chat/queue?id=<sessionID>             — set paused flag
//
// On any state change, we broadcast a "queue" SSE event on the session topic
// so any other open tab refreshes its local view, and kick the drainer so it
// re-evaluates this session immediately rather than waiting for the periodic
// tick.

func (s *Server) handleChatQueue(w http.ResponseWriter, r *http.Request) {
	if s.chatQueue == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "chat queue unavailable")
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.handleChatQueueGet(w, r)
	case http.MethodPost:
		s.handleChatQueuePost(w, r)
	case http.MethodDelete:
		s.handleChatQueueDelete(w, r)
	case http.MethodPatch:
		s.handleChatQueuePatch(w, r)
	default:
		w.Header().Set("Allow", "GET, POST, DELETE, PATCH")
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) resolveQueueSession(r *http.Request, w http.ResponseWriter) (string, bool) {
	resolved, err := sessions.ResolveByID(s.sessionsDir, r.URL.Query().Get("id"))
	if resolveOrWriteError(w, err) {
		return "", false
	}
	return resolved.Session.ID, true
}

func (s *Server) handleChatQueueGet(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := s.resolveQueueSession(r, w)
	if !ok {
		return
	}
	snap, err := s.chatQueue.List(sessionID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "list queue: "+err.Error())
		return
	}
	if snap.Items == nil {
		snap.Items = []chatqueue.Item{} // ensure JSON encodes [] not null
	}
	writeJSON(w, http.StatusOK, snap)
}

func (s *Server) handleChatQueuePost(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := s.resolveQueueSession(r, w)
	if !ok {
		return
	}
	var body struct {
		Message     string `json:"message"`
		DisplayText string `json:"displayText"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	message := strings.TrimSpace(body.Message)
	if message == "" {
		writeJSONError(w, http.StatusBadRequest, "message is required")
		return
	}
	displayText := body.DisplayText
	if strings.TrimSpace(displayText) == "" {
		displayText = message
	}
	item, err := s.chatQueue.Add(sessionID, message, displayText)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "add queue item: "+err.Error())
		return
	}
	s.notifyQueueChanged(sessionID)
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) handleChatQueueDelete(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := s.resolveQueueSession(r, w)
	if !ok {
		return
	}
	posStr := r.URL.Query().Get("position")
	if posStr == "" {
		writeJSONError(w, http.StatusBadRequest, "position is required")
		return
	}
	pos, err := strconv.ParseInt(posStr, 10, 64)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "position must be an integer")
		return
	}
	if err := s.chatQueue.Remove(sessionID, pos); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "remove queue item: "+err.Error())
		return
	}
	s.notifyQueueChanged(sessionID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleChatQueuePatch(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := s.resolveQueueSession(r, w)
	if !ok {
		return
	}
	var body struct {
		Paused *bool `json:"paused"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if body.Paused == nil {
		writeJSONError(w, http.StatusBadRequest, "paused is required")
		return
	}
	if err := s.chatQueue.SetPaused(sessionID, *body.Paused); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "set paused: "+err.Error())
		return
	}
	s.notifyQueueChanged(sessionID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "paused": *body.Paused})
}

// notifyQueueChanged informs other tabs (via SSE) and the drainer that this
// session's queue state changed. The drainer kick is best-effort: a nil
// drainer (e.g. tests) is a no-op. The SSE payload is intentionally tiny —
// listeners just refetch /api/chat/queue to get the new state.
func (s *Server) notifyQueueChanged(sessionID string) {
	if msg, err := formatSSEJSONEvent("queue", map[string]any{"sessionId": sessionID}); err == nil {
		s.broadcast(sessionID, msg)
	}
	if s.queueDrainer != nil {
		s.queueDrainer.kick(sessionID)
	}
}
