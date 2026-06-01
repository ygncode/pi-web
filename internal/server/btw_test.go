package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	_ "modernc.org/sqlite"
)

func newAppSettingsDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if _, err := db.Exec(appSettingsSchema); err != nil {
		t.Fatalf("failed to create app_settings table: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestBtwSessionIDRoundTrip(t *testing.T) {
	db := newAppSettingsDB(t)
	s := &Server{db: db}

	if got := s.getBtwSessionID(); got != "" {
		t.Fatalf("expected empty id initially, got %q", got)
	}
	s.setBtwSessionID("abc.jsonl")
	if got := s.getBtwSessionID(); got != "abc.jsonl" {
		t.Fatalf("expected 'abc.jsonl', got %q", got)
	}
	// Upsert overwrites.
	s.setBtwSessionID("def.jsonl")
	if got := s.getBtwSessionID(); got != "def.jsonl" {
		t.Fatalf("expected 'def.jsonl', got %q", got)
	}
}

func TestHandleNewBtwThenGet(t *testing.T) {
	db := newAppSettingsDB(t)
	dir := t.TempDir()
	s := &Server{db: db, sessionsDir: dir}

	// Create a new btw session rooted at a real directory.
	body := bytes.NewBufferString(`{"path":"` + dir + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/btw/new", body)
	w := httptest.NewRecorder()
	s.handleNewBtw(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	var created map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	id, _ := created["id"].(string)
	if id == "" {
		t.Fatalf("expected a new session id, got %v", created)
	}
	if stored := s.getBtwSessionID(); stored != id {
		t.Fatalf("expected stored btw id %q, got %q", id, stored)
	}

	// GET returns the same id, since the session file now exists.
	greq := httptest.NewRequest(http.MethodGet, "/api/btw", nil)
	gw := httptest.NewRecorder()
	s.handleGetBtw(gw, greq)
	if gw.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on get, got %d", gw.Code)
	}
	var got map[string]any
	if err := json.Unmarshal(gw.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["sessionId"] != id {
		t.Fatalf("expected sessionId %q, got %v", id, got["sessionId"])
	}
}

func TestHandleGetBtwClearsStalePointer(t *testing.T) {
	db := newAppSettingsDB(t)
	s := &Server{db: db, sessionsDir: t.TempDir()}

	// Point at a session that does not exist on disk.
	s.setBtwSessionID("2026-01-01T00-00-00.000Z_deadbeef.jsonl")

	req := httptest.NewRequest(http.MethodGet, "/api/btw", nil)
	w := httptest.NewRecorder()
	s.handleGetBtw(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	var got map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["sessionId"] != "" {
		t.Fatalf("expected empty sessionId for stale pointer, got %v", got["sessionId"])
	}
	if stored := s.getBtwSessionID(); stored != "" {
		t.Fatalf("expected stale pointer cleared, still have %q", stored)
	}
}

func TestHandleBtwMethodGuards(t *testing.T) {
	s := &Server{db: newAppSettingsDB(t), sessionsDir: t.TempDir()}

	// GET handler rejects POST.
	w := httptest.NewRecorder()
	s.handleGetBtw(w, httptest.NewRequest(http.MethodPost, "/api/btw", nil))
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for POST on GET handler, got %d", w.Code)
	}

	// new handler rejects GET.
	w2 := httptest.NewRecorder()
	s.handleNewBtw(w2, httptest.NewRequest(http.MethodGet, "/api/btw/new", nil))
	if w2.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for GET on new handler, got %d", w2.Code)
	}
}
