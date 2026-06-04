// Package widgets stores extension-widget state emitted by pi --mode rpc
// workers and exposes it for the HTTP layer + SSE stream.
//
// Each running pi extension can call ctx.ui.setWidget(key, lines, {placement})
// to surface a small text block in the host UI. In RPC mode the extension
// emits this as `extension_ui_request` with method="setWidget" on the worker's
// stdout. The RPC worker's stream consumer routes those events here; the
// store keeps the latest payload per session+key and notifies subscribers
// so the HTTP/SSE layers can push updates to the browser.
package widgets

import (
	"sync"
	"time"
)

// Widget is a single named extension widget for a session.
type Widget struct {
	Key       string    `json:"key"`
	Lines     []string  `json:"lines"`
	Placement string    `json:"placement"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Update is the message broadcast to subscribers when a widget changes.
// Removed=true means the widget should be torn down (extension passed lines=nil).
type Update struct {
	SessionID string `json:"session_id"`
	Widget    Widget `json:"widget"`
	Removed   bool   `json:"removed"`
}

// Store holds per-session widget state. Safe for concurrent use.
//
// The HTTP layer reads via Get; the RPC worker writes via Set/Remove. Real-time
// browser updates are handled by the server's existing SSE plumbing — when the
// app wires the worker factory it routes setWidget events both to the store
// (so /api/widgets returns the latest) AND to Server.BroadcastWidgetUpdate
// (so connected SSE clients see the change immediately). Mirrors the
// BroadcastChatPreview shape; no per-store subscriber machinery needed.
type Store struct {
	mu      sync.RWMutex
	state   map[string]map[string]Widget // sessionID → key → Widget
	nowFunc func() time.Time
}

// NewStore returns an empty widget store.
func NewStore() *Store {
	return &Store{
		state:   make(map[string]map[string]Widget),
		nowFunc: time.Now,
	}
}

// Set inserts or replaces a widget for a session. Placement defaults to
// "belowEditor" if empty (matches pi-coding-agent's setWidget default).
// Returns the resulting Widget — the caller forwards this to the SSE
// broadcaster so connected browsers see the update.
func (s *Store) Set(sessionID, key string, lines []string, placement string) Widget {
	if placement == "" {
		placement = "belowEditor"
	}
	w := Widget{
		Key:       key,
		Lines:     append([]string(nil), lines...),
		Placement: placement,
		UpdatedAt: s.nowFunc(),
	}
	s.mu.Lock()
	if _, ok := s.state[sessionID]; !ok {
		s.state[sessionID] = make(map[string]Widget)
	}
	s.state[sessionID][key] = w
	s.mu.Unlock()
	return w
}

// Remove drops a single widget. Returns true if it existed.
func (s *Store) Remove(sessionID, key string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	bySession, ok := s.state[sessionID]
	if !ok {
		return false
	}
	if _, existed := bySession[key]; !existed {
		return false
	}
	delete(bySession, key)
	if len(bySession) == 0 {
		delete(s.state, sessionID)
	}
	return true
}

// Get returns a snapshot of all widgets for a session (key → Widget).
// Lines slices are copies so callers may mutate without locking.
func (s *Store) Get(sessionID string) map[string]Widget {
	s.mu.RLock()
	defer s.mu.RUnlock()
	bySession, ok := s.state[sessionID]
	if !ok {
		return nil
	}
	out := make(map[string]Widget, len(bySession))
	for k, w := range bySession {
		out[k] = Widget{
			Key:       w.Key,
			Lines:     append([]string(nil), w.Lines...),
			Placement: w.Placement,
			UpdatedAt: w.UpdatedAt,
		}
	}
	return out
}

// ClearSession drops all widgets for a session. Called when a worker for the
// session terminates so stale state doesn't leak into the next worker's view.
func (s *Store) ClearSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.state, sessionID)
}
