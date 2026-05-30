// Package server hosts the HTTP layer for pi-web: handlers, SSE plumbing,
// the file watcher that drives reload events, and the per-session chat worker
// orchestration. main.go wires concrete dependencies (renderers, model list,
// auth) and registers the routes.
package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"pi-web/internal/auth"
	"pi-web/internal/rpc"
	"pi-web/internal/sessions"
)

// globalSessID is the sentinel SSE topic for events that are not tied to a
// specific session — e.g. a new session file appearing on disk. The index
// page subscribes to this so it can refresh when new sessions show up.
const globalSessID = "__all__"

// Deps groups everything the server needs that lives outside this package:
// rendering (which depends on embedded templates in package main), the model
// list (which depends on a process-wide cache), and the chat sender (which
// owns rpc workers).
type Deps struct {
	AgentDir            string
	SessionsDir         string
	Auth                *auth.Middleware
	ChatSender          ChatSender
	Cache               *sessions.Cache
	RenderIndex         func(w io.Writer, summaries []sessions.SessionSummary) error
	RenderLiveSession   func(s sessions.Session) string
	RenderExportSession func(s sessions.Session, theme string) string
	Models              func(ctx context.Context) (json.RawMessage, error)
	Now                 func() time.Time
}

// Server holds runtime state — connected SSE clients and last-seen modtimes
// per session file. Construct via New; register HTTP routes via Register.
type Server struct {
	agentDir            string
	sessionsDir         string
	clients             []*sseClient
	clientsMu           sync.RWMutex
	fileMod             map[string]time.Time
	fileModMu           sync.RWMutex
	chatSender          ChatSender
	cache               *sessions.Cache
	auth                *auth.Middleware
	shareRunner         shareCmdRunner
	now                 func() time.Time
	renderIndex         func(w io.Writer, summaries []sessions.SessionSummary) error
	renderLiveSession   func(s sessions.Session) string
	renderExportSession func(s sessions.Session, theme string) string
	models              func(ctx context.Context) (json.RawMessage, error)
	lastKnown           map[string]struct{} // session ids currently broadcast as running
	lastKnownMu         sync.Mutex
	push                *PushManager
	stopCh              chan struct{}
	stopOnce            sync.Once
	wg                  sync.WaitGroup
}

func New(deps Deps) *Server {
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	agentDir := deps.AgentDir
	if agentDir == "" {
		agentDir = filepath.Join(os.Getenv("HOME"), ".pi", "agent")
	}
	s := &Server{
		agentDir:            agentDir,
		sessionsDir:         deps.SessionsDir,
		clients:             make([]*sseClient, 0),
		fileMod:             make(map[string]time.Time),
		chatSender:          deps.ChatSender,
		cache:               deps.Cache,
		auth:                deps.Auth,
		now:                 now,
		renderIndex:         deps.RenderIndex,
		renderLiveSession:   deps.RenderLiveSession,
		renderExportSession: deps.RenderExportSession,
		models:              deps.Models,
		lastKnown:           make(map[string]struct{}),
		stopCh:              make(chan struct{}),
	}
	if pm, err := NewPushManager(agentDir); err != nil {
		fmt.Fprintf(os.Stderr, "push notifications unavailable: %v\n", err)
	} else {
		s.push = pm
	}
	s.watchFiles()
	if err := s.startSessionStatusWatcher(); err != nil {
		fmt.Fprintf(os.Stderr, "session-status watcher unavailable: %v\n", err)
	}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runStatusSweeper(s.stopCh, time.Second)
	}()
	return s
}

// Shutdown stops background goroutines and waits for them to exit.
// Idempotent and safe to call from any goroutine.
func (s *Server) Shutdown() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
	})
	s.wg.Wait()
}

// Register installs every HTTP handler on mux, wrapped with the auth
// middleware from Deps.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("/", s.auth.Wrap(s.handleIndex))
	mux.HandleFunc("/session", s.auth.Wrap(s.handleSession))
	mux.HandleFunc("/api/session", s.auth.Wrap(s.handleApiSession))
	mux.HandleFunc("/api/sessions", s.auth.Wrap(s.handleApiSessions))
	mux.HandleFunc("/api/chat", s.auth.Wrap(s.handleChat))
	mux.HandleFunc("/api/chat/cancel", s.auth.Wrap(s.handleCancelChat))
	mux.HandleFunc("/api/set-model", s.auth.Wrap(s.handleSetModel))
	mux.HandleFunc("/api/set-thinking-level", s.auth.Wrap(s.handleSetThinkingLevel))
	mux.HandleFunc("/api/models", s.auth.Wrap(s.handleAvailableModels))
	mux.HandleFunc("/api/worker-status", s.auth.Wrap(s.handleWorkerStatus))
	mux.HandleFunc("/share", s.auth.Wrap(s.handleShare))
	mux.HandleFunc("/events", s.auth.Wrap(s.handleEvents))
	mux.HandleFunc("/api/new-session", s.auth.Wrap(s.handleNewSession))
	mux.HandleFunc("/api/fork-session", s.auth.Wrap(s.handleApiForkSession))
	mux.HandleFunc("/api/clone-session", s.auth.Wrap(s.handleApiCloneSession))
	mux.HandleFunc("/api/rename-session", s.auth.Wrap(s.handleRenameSession))
	mux.HandleFunc("/api/recent-locations", s.auth.Wrap(s.handleRecentLocations))
	mux.HandleFunc("/custom-themes.css", s.auth.Wrap(s.handleCustomThemes))
	if s.push != nil {
		s.push.Register(mux, s.auth.Wrap)
	}
}

func (s *Server) loadSummaries() ([]sessions.SessionSummary, error) {
	return s.cache.LoadAll(s.sessionsDir)
}

// SetShareRunner is exposed for tests that want to stub `gh` invocations.
func (s *Server) SetShareRunner(r shareCmdRunner) { s.shareRunner = r }

// ── SSE clients ────────────────────────────────────────────────────────────

type sseClient struct {
	ch     chan string
	sessID string
	mu     sync.Mutex
	queued map[string]bool
}

func (s *Server) addClient(sessID string) *sseClient {
	c := &sseClient{
		ch:     make(chan string, 16),
		sessID: sessID,
		queued: make(map[string]bool),
	}
	s.clientsMu.Lock()
	s.clients = append(s.clients, c)
	s.clientsMu.Unlock()
	return c
}

// eventKey returns a coalescing key for msg. Events with the same non-empty
// key are deduplicated while pending in a client's channel; an empty key
// means "always deliver, drop on full" (status events self-heal via the
// reconnect snapshot).
func eventKey(msg string) string {
	switch msg {
	case "reload":
		return "reload"
	case "new-session":
		return "new-session"
	}
	return ""
}

func (s *Server) removeClient(target *sseClient) {
	s.clientsMu.Lock()
	filtered := s.clients[:0]
	for _, c := range s.clients {
		if c != target {
			filtered = append(filtered, c)
		}
	}
	s.clients = filtered
	s.clientsMu.Unlock()
	close(target.ch)
}

func (s *Server) BroadcastChatPreview(sessionID string, preview rpc.StreamPreview) {
	if sessionID == "" || sessionID == globalSessID {
		return
	}
	msg, err := formatSSEJSONEvent("chat-preview", preview)
	if err != nil {
		return
	}
	s.broadcast(sessionID, msg)
}

func (s *Server) broadcast(sessID, msg string) {
	s.clientsMu.RLock()
	defer s.clientsMu.RUnlock()
	key := eventKey(msg)
	for _, c := range s.clients {
		if c.sessID != sessID {
			continue
		}
		c.mu.Lock()
		if key != "" && c.queued[key] {
			c.mu.Unlock()
			continue
		}
		select {
		case c.ch <- msg:
			if key != "" {
				c.queued[key] = true
			}
		default:
			// dropped — only reachable for keyless events (e.g. status-delta);
			// snapshot-on-reconnect recovers state for those.
		}
		c.mu.Unlock()
	}
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"error": message})
}

// writeJSON writes payload as JSON. Pass status=0 to leave the default 200.
// Encode errors are intentionally discarded — by then headers are sent and
// the client is the right party to detect transport failure.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	if status != 0 {
		w.WriteHeader(status)
	}
	_ = json.NewEncoder(w).Encode(payload)
}
