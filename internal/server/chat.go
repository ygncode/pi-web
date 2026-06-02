package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"pi-web/internal/chat"
	"pi-web/internal/sessions"
	"pi-web/internal/workers"
)

type ChatSender interface {
	Send(ctx context.Context, sessionID, sessionPath string, chat chat.Request) error
	SetModel(ctx context.Context, sessionID, sessionPath, provider, modelID string) error
	SetThinkingLevel(ctx context.Context, sessionID, sessionPath, level string) error
	Abort(ctx context.Context, sessionID string) error
	GetState(ctx context.Context, sessionID string) (workers.WorkerStatus, error)
	GetCommands(ctx context.Context, sessionID string) ([]workers.SlashCommand, bool, error)
	Status(sessionID string) workers.WorkerStatus
	EnsureWorker(ctx context.Context, sessionID, sessionPath string) error
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	resolved, err := sessions.ResolveByID(s.sessionsDir, r.URL.Query().Get("id"))
	if err != nil {
		if errors.Is(err, sessions.ErrInvalidSessionID) {
			writeJSONError(w, http.StatusBadRequest, "invalid session id")
			return
		}
		if errors.Is(err, sessions.ErrSessionNotFound) {
			writeJSONError(w, http.StatusNotFound, "session not found")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !resolved.Session.ChatAvailable {
		writeJSONError(w, http.StatusConflict, resolved.Session.ChatDisabledReason)
		return
	}
	chatReq, err := chat.ParseRequest(r, chat.DefaultMaxImageBytes, chat.DefaultMaxRequestBytes)
	if err != nil {
		switch {
		case errors.Is(err, chat.ErrEmptyRequest):
			writeJSONError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, chat.ErrImageTooLarge):
			writeJSONError(w, http.StatusRequestEntityTooLarge, err.Error())
		case errors.Is(err, chat.ErrUnsupportedImageType):
			writeJSONError(w, http.StatusUnsupportedMediaType, err.Error())
		case errors.As(err, new(*http.MaxBytesError)):
			writeJSONError(w, http.StatusRequestEntityTooLarge, err.Error())
		default:
			writeJSONError(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	if s.chatSender == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "chat unavailable")
		return
	}
	sessionID := resolved.Session.ID
	sessionPath := resolved.Path
	go func() {
		if err := s.chatSender.Send(context.Background(), sessionID, sessionPath, chatReq); err != nil {
			fmt.Fprintf(os.Stderr, "chat send failed for %s: %v\n", sessionID, err)
		}
	}()
	writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "status": "queued"})
}

// recentSessionActivityWindow is the grace period after a JSONL write during
// which a session is still reported as "running" even when no in-process
// chat worker and no session-status file claims it. Kept short so the
// "running" status / Cancel button doesn't linger after the assistant
// finishes streaming its final message.
const recentSessionActivityWindow = 800 * time.Millisecond
const sessionStatusTTL = 10 * time.Second

type sessionStatusFile struct {
	State     string `json:"state"`
	UpdatedAt string `json:"updatedAt"`
}

func (s *Server) readSessionStatus(sessionID string) *workers.WorkerStatus {
	if sessionID == "" {
		return nil
	}
	path := filepath.Join(s.sessionStatusDir(), sessionID)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var status sessionStatusFile
	if err := json.Unmarshal(data, &status); err != nil {
		return nil
	}
	if status.State != "running" {
		return nil
	}
	updatedAt, err := time.Parse(time.RFC3339, status.UpdatedAt)
	if err != nil {
		return nil
	}
	if time.Since(updatedAt) > sessionStatusTTL {
		return nil
	}
	return &workers.WorkerStatus{State: workers.WorkerStateRunning}
}

func (s *Server) handleCancelChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	resolved, err := sessions.ResolveByID(s.sessionsDir, r.URL.Query().Get("id"))
	if err != nil {
		if errors.Is(err, sessions.ErrInvalidSessionID) {
			writeJSONError(w, http.StatusBadRequest, "invalid session id")
			return
		}
		if errors.Is(err, sessions.ErrSessionNotFound) {
			writeJSONError(w, http.StatusNotFound, "session not found")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if s.chatSender == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "chat unavailable")
		return
	}
	if err := s.chatSender.Abort(r.Context(), resolved.Session.ID); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = os.Remove(filepath.Join(s.sessionStatusDir(), resolved.Session.ID))
	s.recomputeAndBroadcastStatus(resolved.Session.ID)
	s.broadcast(resolved.Session.ID, "reload")
	writeJSON(w, 0, map[string]any{"ok": true, "status": "cancelled"})
}

func (s *Server) handleWorkerStatus(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("id")

	status := workers.WorkerStatus{State: workers.WorkerStateIdle}
	if s.computeRunningStatus(sessionID) {
		status.State = workers.WorkerStateRunning
	} else if s.chatSender != nil {
		// Do not create/prewarm workers from status polling. A browser can poll
		// many visible sessions at once; if one pi RPC switch_session hangs, eager
		// prewarming accumulates stuck `pi --mode rpc` processes and starves real
		// chat requests. Only report state for an already-created worker here.
		stateCtx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if state, err := s.chatSender.GetState(stateCtx, sessionID); err == nil {
			status.Model = state.Model
			status.ModelName = state.ModelName
			status.ModelProvider = state.ModelProvider
			status.ThinkingLevel = state.ThinkingLevel
		}
	}
	writeJSON(w, 0, status)
}

// handleCommands lists the slash commands (extensions, prompt templates,
// skills) exposed by the session's pi worker.
//
// By default it only peeks at an existing worker; if none is running it reports
// workerReady=false with an empty list. With ?load=1 it instead spawns (or
// reuses) the worker first, so the client can offer an explicit "load skills"
// action without the user having to send a chat message. Older pi builds that
// predate the get_commands RPC are degraded gracefully to an empty list.
func (s *Server) handleCommands(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("id")
	load := r.URL.Query().Get("load") == "1"

	if load && s.chatSender != nil {
		resolved, err := sessions.ResolveByID(s.sessionsDir, sessionID)
		if err != nil {
			switch {
			case errors.Is(err, sessions.ErrInvalidSessionID):
				writeJSONError(w, http.StatusBadRequest, "invalid session id")
			case errors.Is(err, sessions.ErrSessionNotFound):
				writeJSONError(w, http.StatusNotFound, "session not found")
			default:
				writeJSONError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}
		if !resolved.Session.ChatAvailable {
			writeJSONError(w, http.StatusConflict, resolved.Session.ChatDisabledReason)
			return
		}
		sessionID = resolved.Session.ID
		spawnCtx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		err = s.chatSender.EnsureWorker(spawnCtx, sessionID, resolved.Path)
		cancel()
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	commands := []workers.SlashCommand{}
	ready := false
	if s.chatSender != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		cmds, workerReady, err := s.chatSender.GetCommands(ctx, sessionID)
		ready = workerReady
		if err != nil && !isUnknownCommandErr(err) {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if cmds != nil {
			commands = cmds
		}
	}
	writeJSON(w, 0, map[string]any{"workerReady": ready, "commands": commands})
}

// isUnknownCommandErr reports whether err came from a pi build that does not
// implement the get_commands RPC (pre-v0.78.0).
func isUnknownCommandErr(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "unknown command")
}

func (s *Server) hasRecentSessionActivity(sessionID string) bool {
	if sessionID == "" {
		return false
	}
	var now time.Time
	if s.now != nil {
		now = s.now()
	} else {
		now = time.Now()
	}
	s.fileModMu.RLock()
	mod, ok := s.fileMod[sessionID]
	s.fileModMu.RUnlock()
	if !ok {
		return false
	}
	return !mod.IsZero() && now.Sub(mod) <= recentSessionActivityWindow
}

func (s *Server) handleSetModel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	resolved, err := sessions.ResolveByID(s.sessionsDir, r.URL.Query().Get("id"))
	if err != nil {
		if errors.Is(err, sessions.ErrInvalidSessionID) {
			writeJSONError(w, http.StatusBadRequest, "invalid session id")
			return
		}
		if errors.Is(err, sessions.ErrSessionNotFound) {
			writeJSONError(w, http.StatusNotFound, "session not found")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var body struct {
		Provider string `json:"provider"`
		ModelID  string `json:"modelId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if body.Provider == "" || body.ModelID == "" {
		writeJSONError(w, http.StatusBadRequest, "provider and modelId required")
		return
	}
	if err := s.chatSender.SetModel(r.Context(), resolved.Session.ID, resolved.Path, body.Provider, body.ModelID); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, 0, map[string]any{"ok": true})
}

func (s *Server) handleSetThinkingLevel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	resolved, err := sessions.ResolveByID(s.sessionsDir, r.URL.Query().Get("id"))
	if err != nil {
		if errors.Is(err, sessions.ErrInvalidSessionID) {
			writeJSONError(w, http.StatusBadRequest, "invalid session id")
			return
		}
		if errors.Is(err, sessions.ErrSessionNotFound) {
			writeJSONError(w, http.StatusNotFound, "session not found")
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var body struct {
		Level string `json:"level"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if body.Level == "" {
		writeJSONError(w, http.StatusBadRequest, "level required")
		return
	}
	if err := s.chatSender.SetThinkingLevel(r.Context(), resolved.Session.ID, resolved.Path, body.Level); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	status := s.chatSender.Status(resolved.Session.ID)
	if state, err := s.chatSender.GetState(r.Context(), resolved.Session.ID); err == nil {
		status.ThinkingLevel = state.ThinkingLevel
	}
	writeJSON(w, 0, map[string]any{"ok": true, "thinkingLevel": status.ThinkingLevel})
}
