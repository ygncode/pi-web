// Package server hosts the HTTP layer for pi-web: handlers, SSE plumbing,
// the file watcher that drives reload events, and the per-session chat worker
// orchestration. main.go wires concrete dependencies (renderers, model list,
// auth) and registers the routes.
package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"pi-web/internal/agentdir"
	"pi-web/internal/auth"
	"pi-web/internal/render"
	"pi-web/internal/rpc"
	"pi-web/internal/sessions"
	"pi-web/internal/updater"

	_ "modernc.org/sqlite"
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
	RenderLiveSession   func(s sessions.Session, scratchpad string) string
	RenderExportSession func(s sessions.Session, theme string) string
	RenderSettings      func(w io.Writer) error
	Models              func(ctx context.Context) (json.RawMessage, error)
	Now                 func() time.Time
	// Updater reports current/latest version + changelog. Optional; when nil
	// the version endpoints are not registered.
	Updater *updater.Checker
	// RunInstall installs the latest pi-web package (e.g. `pi install ...`).
	// Optional; when nil /api/update responds 503.
	RunInstall func(ctx context.Context) error
	// RunRestart restarts the pi-web service (detached) so the new binary
	// takes over. Optional; when nil /api/restart responds 503.
	RunRestart func() error
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
	renderLiveSession   func(s sessions.Session, scratchpad string) string
	renderExportSession func(s sessions.Session, theme string) string
	renderSettings      func(w io.Writer) error
	models              func(ctx context.Context) (json.RawMessage, error)
	lastKnown           map[string]struct{} // session ids currently broadcast as running
	lastKnownMu         sync.Mutex
	push                *PushManager
	stopCh              chan struct{}
	stopOnce            sync.Once
	wg                  sync.WaitGroup
	db                  *sql.DB
	updater             *updater.Checker
	runInstall          func(ctx context.Context) error
	runRestart          func() error
	updateMu            sync.Mutex // serializes install/restart operations

	// Auto-title bookkeeping (see auto_title.go). Guards against re-titling
	// loops and clobbering user-set names.
	titleMu        sync.Mutex
	titleInFlight  map[string]bool
	titledName     map[string]string // sessID -> the title pi-web last set
	titledCount    map[string]int    // sessID -> user-msg count at last titling
	titleUserOwned map[string]bool   // sessID -> user named it; never auto-title
}

func New(deps Deps) *Server {
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	agentDir := deps.AgentDir
	if agentDir == "" {
		agentDir = agentdir.Path()
	}

	// Ensure the agentDir exists
	if err := os.MkdirAll(agentDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "failed to create agent directory %s: %v\n", agentDir, err)
	}

	var db *sql.DB
	dbPath := filepath.Join(agentDir, "pi-web.sqlite")
	var dbErr error
	db, dbErr = sql.Open("sqlite", dbPath)
	if dbErr != nil {
		fmt.Fprintf(os.Stderr, "failed to open sqlite database: %v\n", dbErr)
	} else {
		_, err := db.Exec(`CREATE TABLE IF NOT EXISTS scratchpads (
			project_path TEXT PRIMARY KEY,
			content TEXT,
			updated_at DATETIME
		)`)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to create scratchpads table: %v\n", err)
		}
		_, err = db.Exec(`CREATE TABLE IF NOT EXISTS settings (
			key        TEXT PRIMARY KEY,
			value      TEXT,
			updated_at DATETIME
		)`)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to create settings table: %v\n", err)
		}
		if _, err := db.Exec(projectPrefsSchema); err != nil {
			fmt.Fprintf(os.Stderr, "failed to create project_prefs table: %v\n", err)
		}
		if _, err := db.Exec(appSettingsSchema); err != nil {
			fmt.Fprintf(os.Stderr, "failed to create app_settings table: %v\n", err)
		}
		if _, err := db.Exec(btwSessionsSchema); err != nil {
			fmt.Fprintf(os.Stderr, "failed to create btw_sessions table: %v\n", err)
		}
		migrateLegacyBtwSession(db)
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
		renderSettings:      deps.RenderSettings,
		models:              deps.Models,
		lastKnown:           make(map[string]struct{}),
		titleInFlight:       make(map[string]bool),
		titledName:          make(map[string]string),
		titledCount:         make(map[string]int),
		titleUserOwned:      make(map[string]bool),
		stopCh:              make(chan struct{}),
		db:                  db,
		updater:             deps.Updater,
		runInstall:          deps.RunInstall,
		runRestart:          deps.RunRestart,
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
		if s.db != nil {
			s.db.Close()
		}
	})
	s.wg.Wait()
}

// Register installs every HTTP handler on mux, wrapped with the auth
// middleware from Deps.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("/", s.auth.Wrap(s.handleIndex))
	mux.HandleFunc("/session", s.auth.Wrap(s.handleSession))
	mux.HandleFunc("/settings", s.auth.Wrap(s.handleSettingsPage))
	mux.HandleFunc("/api/session", s.auth.Wrap(s.handleApiSession))
	mux.HandleFunc("/api/sessions", s.auth.Wrap(s.handleApiSessions))
	mux.HandleFunc("/api/chat", s.auth.Wrap(s.handleChat))
	mux.HandleFunc("/api/chat/cancel", s.auth.Wrap(s.handleCancelChat))
	mux.HandleFunc("/api/set-model", s.auth.Wrap(s.handleSetModel))
	mux.HandleFunc("/api/set-thinking-level", s.auth.Wrap(s.handleSetThinkingLevel))
	mux.HandleFunc("/api/models", s.auth.Wrap(s.handleAvailableModels))
	mux.HandleFunc("/api/worker-status", s.auth.Wrap(s.handleWorkerStatus))
	mux.HandleFunc("/api/commands", s.auth.Wrap(s.handleCommands))
	mux.HandleFunc("/share", s.auth.Wrap(s.handleShare))
	mux.HandleFunc("/events", s.auth.Wrap(s.handleEvents))
	mux.HandleFunc("/api/new-session", s.auth.Wrap(s.handleNewSession))
	mux.HandleFunc("/api/fork-session", s.auth.Wrap(s.handleApiForkSession))
	mux.HandleFunc("/api/clone-session", s.auth.Wrap(s.handleApiCloneSession))
	mux.HandleFunc("/api/rename-session", s.auth.Wrap(s.handleRenameSession))
	mux.HandleFunc("/api/recent-locations", s.auth.Wrap(s.handleRecentLocations))
	mux.HandleFunc("/api/projects", s.getPostHandler(s.handleApiProjects, s.handleUpdateProject))
	mux.HandleFunc("/api/git/info", s.auth.Wrap(s.handleGitInfo))
	mux.HandleFunc("/api/git/rename-branch", s.auth.Wrap(s.handleGitRenameBranch))
	mux.HandleFunc("/custom-themes.css", s.auth.Wrap(s.handleCustomThemes))
	mux.HandleFunc("/api/scratchpad", s.getPostHandler(s.handleGetScratchpad, s.handleSaveScratchpad))
	mux.HandleFunc("/api/settings", s.getPostHandler(s.handleGetSettings, s.handleSaveSettings))
	mux.HandleFunc("/api/btw", s.auth.Wrap(s.handleGetBtw))
	mux.HandleFunc("/api/btw/new", s.auth.Wrap(s.handleNewBtw))
	if s.push != nil {
		s.push.Register(mux, s.auth.Wrap)
	}
	mux.HandleFunc("/api/sounds", s.auth.Wrap(s.handleApiSounds))
	mux.HandleFunc("/sounds/", s.handleSounds)
	if s.updater != nil {
		mux.HandleFunc("/api/version", s.auth.Wrap(s.handleVersion))
		mux.HandleFunc("/api/check-update", s.auth.Wrap(s.handleCheckUpdate))
		mux.HandleFunc("/api/update", s.auth.Wrap(s.handleUpdate))
		mux.HandleFunc("/api/restart", s.auth.Wrap(s.handleRestart))
	}
}

// getPostHandler routes GET to get and POST to post, each wrapped with auth,
// and rejects any other method with 405 (and an Allow header) before auth runs.
func (s *Server) getPostHandler(get, post http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			s.auth.Wrap(get)(w, r)
		case http.MethodPost:
			s.auth.Wrap(post)(w, r)
		default:
			w.Header().Set("Allow", "GET, POST")
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
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
	render.WriteJSONError(w, status, message)
}

// writeJSON writes payload as JSON. Pass status=0 to leave the default 200.
// Encode errors are intentionally discarded — by then headers are sent and
// the client is the right party to detect transport failure.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	render.WriteJSON(w, status, payload)
}
