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
	"pi-web/internal/chatqueue"
	"pi-web/internal/render"
	"pi-web/internal/rpc"
	"pi-web/internal/schedules"
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
	RenderExportSession func(s sessions.Session, theme string) string
	RenderAppShell      func(w io.Writer, bootstrap string) error
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
	// DisableBackgroundJobs keeps the development server from duplicating the
	// installed server's scheduler, queue drainer, auto-titles, and pushes.
	DisableBackgroundJobs bool
}

// Server holds runtime state — connected SSE clients and last-seen modtimes
// per session file. Construct via New; register HTTP routes via Register.
type Server struct {
	agentDir              string
	sessionsDir           string
	clients               []*sseClient
	clientsMu             sync.RWMutex
	fileMod               map[string]time.Time
	fileModMu             sync.RWMutex
	chatSender            ChatSender
	cache                 *sessions.Cache
	auth                  *auth.Middleware
	shareRunner           shareCmdRunner
	now                   func() time.Time
	renderExportSession   func(s sessions.Session, theme string) string
	renderAppShell        func(w io.Writer, bootstrap string) error
	models                func(ctx context.Context) (json.RawMessage, error)
	lastKnown             map[string]struct{} // session ids currently broadcast as running
	lastKnownMu           sync.Mutex
	push                  *PushManager
	stopCh                chan struct{}
	stopOnce              sync.Once
	wg                    sync.WaitGroup
	db                    *sql.DB
	schedules             *schedules.Store
	chatQueue             *chatqueue.Store
	queueDrainer          *queueDrainer
	updater               *updater.Checker
	runInstall            func(ctx context.Context) error
	runRestart            func() error
	updateMu              sync.Mutex // serializes install/restart operations
	disableBackgroundJobs bool

	// fileWalk caches bounded directory listings per cwd for the @mention
	// autocomplete so rapid keystrokes reuse a single filesystem walk.
	fileWalk     *fileWalkCache
	fileWalkOnce sync.Once

	// Metrics dashboard (see metrics.go) and auto-title bookkeeping (see
	// auto_title.go), grouped so each subsystem owns its own fields + lock.
	metrics   metricsState
	autoTitle autoTitleState
}

// metricsState backs the metrics dashboard. startedAt drives process uptime;
// sampler is swappable for tests; cpuLast holds per-PID CPU baselines for
// delta-based %CPU (guarded by cpuMu).
type metricsState struct {
	startedAt time.Time
	sampler   processSampler
	cpuMu     sync.Mutex
	cpuLast   map[int]cpuMark
}

// autoTitleState guards auto-titling against re-titling loops and clobbering
// user-set names.
type autoTitleState struct {
	mu        sync.Mutex
	inFlight  map[string]bool
	name      map[string]string // sessID -> the title pi-web last set
	count     map[string]int    // sessID -> user-msg count at last titling
	userOwned map[string]bool   // sessID -> user named it; never auto-title
}

func New(deps Deps) (*Server, error) {
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	agentDir := deps.AgentDir
	if agentDir == "" {
		agentDir = agentdir.Path()
	}

	if err := os.MkdirAll(agentDir, 0755); err != nil {
		return nil, fmt.Errorf("create agent directory %s: %w", agentDir, err)
	}

	db, err := initDB(agentDir)
	if err != nil {
		return nil, err
	}

	s := &Server{
		agentDir:              agentDir,
		sessionsDir:           deps.SessionsDir,
		clients:               make([]*sseClient, 0),
		fileMod:               make(map[string]time.Time),
		chatSender:            deps.ChatSender,
		cache:                 deps.Cache,
		auth:                  deps.Auth,
		now:                   now,
		renderExportSession:   deps.RenderExportSession,
		renderAppShell:        deps.RenderAppShell,
		models:                deps.Models,
		lastKnown:             make(map[string]struct{}),
		stopCh:                make(chan struct{}),
		db:                    db,
		schedules:             schedules.NewStore(db),
		chatQueue:             chatqueue.NewStore(db),
		updater:               deps.Updater,
		runInstall:            deps.RunInstall,
		runRestart:            deps.RunRestart,
		disableBackgroundJobs: deps.DisableBackgroundJobs,
		metrics: metricsState{
			startedAt: now(),
			cpuLast:   make(map[int]cpuMark),
		},
		autoTitle: autoTitleState{
			inFlight:  make(map[string]bool),
			name:      make(map[string]string),
			count:     make(map[string]int),
			userOwned: make(map[string]bool),
		},
	}
	s.schedules.Now = now
	s.chatQueue.Now = now
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
	if !s.disableBackgroundJobs {
		s.wg.Add(1)
		go func() {
			defer s.wg.Done()
			s.runScheduler(s.stopCh, scheduleTickInterval)
		}()
		// Autonomous queue drainer: drains chat_queue items into the worker even
		// when nobody has the session open in a browser. Stop in Shutdown.
		s.queueDrainer = newQueueDrainer(s)
		s.queueDrainer.start()
	}
	return s, nil
}

// initDB opens the SQLite database and creates the schema. Any failure is
// returned so the server refuses to start rather than running with a
// half-initialized database that fails opaquely on first use.
func initDB(agentDir string) (*sql.DB, error) {
	dbPath := filepath.Join(agentDir, "pi-web.sqlite")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite database: %w", err)
	}
	// SQLite allows only one writer at a time; multiple pooled connections
	// racing to write surface as "database is locked" errors (e.g. concurrent
	// annotation writes). Serialize on a single connection so writes queue
	// instead of failing.
	db.SetMaxOpenConns(1)
	// WAL mode lets readers and the (single) writer make progress concurrently,
	// which keeps GET /api/chat/queue snappy when the autonomous drainer is
	// holding the write half. busy_timeout is the small safety net for the rare
	// schema/migration-time write contention.
	if _, err := db.Exec(`PRAGMA journal_mode=WAL`); err != nil {
		db.Close()
		return nil, fmt.Errorf("enable WAL: %w", err)
	}
	if _, err := db.Exec(`PRAGMA busy_timeout=5000`); err != nil {
		db.Close()
		return nil, fmt.Errorf("set busy_timeout: %w", err)
	}

	schema := []struct {
		name string
		stmt string
	}{
		{"scratchpads table", `CREATE TABLE IF NOT EXISTS scratchpads (
			project_path TEXT PRIMARY KEY,
			content TEXT,
			updated_at DATETIME
		)`},
		{"settings table", `CREATE TABLE IF NOT EXISTS settings (
			key        TEXT PRIMARY KEY,
			value      TEXT,
			updated_at DATETIME
		)`},
		{"project_prefs table", projectPrefsSchema},
		{"app_settings table", appSettingsSchema},
		{"btw_sessions table", btwSessionsSchema},
		{"annotations table", annotationsSchema},
		{"annotations index", annotationsIndex},
		{"schedules table", schedules.SchedulesTableDDL},
		{"schedule_runs table", schedules.RunsTableDDL},
		{"schedule_runs schedule index", schedules.RunsScheduleIndexDDL},
		{"schedule_runs session index", schedules.RunsSessionIndexDDL},
		{"review_comments table", reviewCommentsSchema},
		{"review_comments index", reviewCommentsIndex},
		{"chat_queue_items table", chatqueue.ItemsTableDDL},
		{"chat_queue_items index", chatqueue.ItemsSessionIndexDDL},
		{"chat_queue_state table", chatqueue.StateTableDDL},
	}
	for _, s := range schema {
		if _, err := db.Exec(s.stmt); err != nil {
			db.Close()
			return nil, fmt.Errorf("create %s: %w", s.name, err)
		}
	}
	migrateLegacyBtwSession(db)
	return db, nil
}

// Shutdown stops background goroutines and waits for them to exit.
// Idempotent and safe to call from any goroutine.
func (s *Server) Shutdown() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
		if s.queueDrainer != nil {
			s.queueDrainer.stop()
		}
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
	mux.HandleFunc("/api/label-session", s.auth.Wrap(s.handleLabelSessionEntry))
	mux.HandleFunc("/api/recent-locations", s.auth.Wrap(s.handleRecentLocations))
	mux.HandleFunc("/api/projects", s.getPostHandler(s.handleApiProjects, s.handleUpdateProject))
	mux.HandleFunc("/api/files", s.auth.Wrap(s.handleApiFiles))
	mux.HandleFunc("/api/git/info", s.auth.Wrap(s.handleGitInfo))
	mux.HandleFunc("/api/git/rename-branch", s.auth.Wrap(s.handleGitRenameBranch))
	mux.HandleFunc("/api/git/diff", s.auth.Wrap(s.handleGitDiff))
	mux.HandleFunc("/api/diff/reviews", s.auth.Wrap(s.handleReviewComments))
	// Public (no auth): the login gate needs the custom palette to theme
	// correctly before the user authenticates. Contents are non-secret color
	// variables only.
	mux.HandleFunc("/custom-themes.css", s.handleCustomThemes)
	mux.HandleFunc("/api/scratchpad", s.getPostHandler(s.handleGetScratchpad, s.handleSaveScratchpad))
	mux.HandleFunc("/api/chat/queue", s.auth.Wrap(s.handleChatQueue))
	mux.HandleFunc("/api/annotations", s.auth.Wrap(s.handleAnnotations))
	mux.HandleFunc("/api/settings", s.getPostHandler(s.handleGetSettings, s.handleSaveSettings))
	mux.HandleFunc("/api/btw", s.auth.Wrap(s.handleGetBtw))
	mux.HandleFunc("/api/btw/new", s.auth.Wrap(s.handleNewBtw))
	mux.HandleFunc("/api/schedules", s.auth.Wrap(s.handleApiSchedules))
	mux.HandleFunc("/api/schedule", s.auth.Wrap(s.handleApiSchedule))
	mux.HandleFunc("/api/schedule/run", s.auth.Wrap(s.handleApiScheduleRun))
	mux.HandleFunc("/api/schedule/runs", s.auth.Wrap(s.handleApiScheduleRuns))
	mux.HandleFunc("/metrics", s.auth.Wrap(s.handleMetricsPage))
	mux.HandleFunc("/api/metrics", s.auth.Wrap(s.handleMetrics))
	s.registerPprof(mux)
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
