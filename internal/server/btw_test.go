package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"pi-web/internal/sessions"

	_ "modernc.org/sqlite"
)

// newBtwDB creates an in-memory db with every table the btw code touches:
// app_settings (legacy migration), settings (show-in-index toggle), and the
// btw_sessions registry.
func newBtwDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	for _, schema := range []string{
		appSettingsSchema,
		`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME)`,
		btwSessionsSchema,
	} {
		if _, err := db.Exec(schema); err != nil {
			t.Fatalf("failed to create table: %v", err)
		}
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestBtwSessionIDRoundTrip(t *testing.T) {
	db := newBtwDB(t)
	s := &Server{db: db}

	if got := s.getBtwSessionID("p1"); got != "" {
		t.Fatalf("expected empty id initially, got %q", got)
	}
	s.setBtwSessionID("p1", "abc.jsonl")
	if got := s.getBtwSessionID("p1"); got != "abc.jsonl" {
		t.Fatalf("expected 'abc.jsonl', got %q", got)
	}
	// A second parent is independent.
	if got := s.getBtwSessionID("p2"); got != "" {
		t.Fatalf("expected p2 empty, got %q", got)
	}
	s.setBtwSessionID("p2", "xyz.jsonl")
	if got := s.getBtwSessionID("p2"); got != "xyz.jsonl" {
		t.Fatalf("expected 'xyz.jsonl' for p2, got %q", got)
	}
	if got := s.getBtwSessionID("p1"); got != "abc.jsonl" {
		t.Fatalf("p1 should be unaffected, got %q", got)
	}
}

func TestSetBtwKeepsPriorAsOrphan(t *testing.T) {
	db := newBtwDB(t)
	s := &Server{db: db}

	s.setBtwSessionID("p1", "old.jsonl")
	s.setBtwSessionID("p1", "new.jsonl")

	if got := s.getBtwSessionID("p1"); got != "new.jsonl" {
		t.Fatalf("expected active 'new.jsonl', got %q", got)
	}
	// The prior btw stays on record (orphaned), so it remains identifiable as a
	// btw and hideable from the index.
	ids := s.btwSessionIDs()
	if !ids["old.jsonl"] || !ids["new.jsonl"] {
		t.Fatalf("expected both old and new tracked, got %v", ids)
	}
	// Exactly one active row for the parent.
	var activeCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM btw_sessions WHERE parent_id='p1' AND active=1").Scan(&activeCount); err != nil {
		t.Fatal(err)
	}
	if activeCount != 1 {
		t.Fatalf("expected exactly 1 active row, got %d", activeCount)
	}
}

func TestHandleNewBtwThenGet(t *testing.T) {
	db := newBtwDB(t)
	dir := t.TempDir()
	s := &Server{db: db, sessionsDir: dir}

	// Create a new btw session for parent "parent-1".
	body := bytes.NewBufferString(`{"path":"` + dir + `","parent":"parent-1"}`)
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
	if stored := s.getBtwSessionID("parent-1"); stored != id {
		t.Fatalf("expected stored btw id %q, got %q", id, stored)
	}

	// GET scoped to the same parent returns the same id.
	greq := httptest.NewRequest(http.MethodGet, "/api/btw?parent=parent-1", nil)
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

	// A different parent has no btw.
	oreq := httptest.NewRequest(http.MethodGet, "/api/btw?parent=other", nil)
	ow := httptest.NewRecorder()
	s.handleGetBtw(ow, oreq)
	var other map[string]any
	if err := json.Unmarshal(ow.Body.Bytes(), &other); err != nil {
		t.Fatal(err)
	}
	if other["sessionId"] != "" {
		t.Fatalf("expected empty btw for other parent, got %v", other["sessionId"])
	}
}

func TestHandleGetBtwClearsStalePointer(t *testing.T) {
	db := newBtwDB(t)
	s := &Server{db: db, sessionsDir: t.TempDir()}

	// Point at a session that does not exist on disk.
	s.setBtwSessionID("parent-1", "2026-01-01T00-00-00.000Z_deadbeef.jsonl")

	req := httptest.NewRequest(http.MethodGet, "/api/btw?parent=parent-1", nil)
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
	if stored := s.getBtwSessionID("parent-1"); stored != "" {
		t.Fatalf("expected stale pointer cleared, still have %q", stored)
	}
	// The row is dropped entirely (file is gone — not a real orphan).
	if ids := s.btwSessionIDs(); len(ids) != 0 {
		t.Fatalf("expected stale row removed, got %v", ids)
	}
}

func TestHandleBtwMethodGuards(t *testing.T) {
	s := &Server{db: newBtwDB(t), sessionsDir: t.TempDir()}

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

func TestFilterBtwSummaries(t *testing.T) {
	db := newBtwDB(t)
	s := &Server{db: db}
	s.setBtwSessionID("parent-1", "btw.jsonl")

	all := []sessions.SessionSummary{
		{ID: "regular.jsonl"},
		{ID: "btw.jsonl"},
	}

	// Hidden by default.
	out := s.filterBtwSummaries(all)
	if len(out) != 1 || out[0].ID != "regular.jsonl" {
		t.Fatalf("expected btw hidden by default, got %v", out)
	}

	// Shown when the toggle is on.
	if _, err := db.Exec(`INSERT INTO settings (key, value) VALUES (?, 'true')`, settingShowBtwInIndex); err != nil {
		t.Fatal(err)
	}
	out = s.filterBtwSummaries(all)
	if len(out) != 2 {
		t.Fatalf("expected btw shown when enabled, got %v", out)
	}
}

func TestReapOrphanedBtw(t *testing.T) {
	db := newBtwDB(t)
	dir := t.TempDir()
	s := &Server{db: db, sessionsDir: dir}

	// Create a btw for an existing parent and one for a parent that is gone.
	keepID, err := sessions.CreateSessionFileWithSettings(dir, dir, sessions.InitialSettings{})
	if err != nil {
		t.Fatal(err)
	}
	s.setBtwSessionID("alive-parent", keepID)

	goneID, err := sessions.CreateSessionFileWithSettings(dir, dir, sessions.InitialSettings{})
	if err != nil {
		t.Fatal(err)
	}
	s.setBtwSessionID("dead-parent", goneID)

	// Also a global-sentinel btw, which must never be reaped.
	s.setBtwSessionID(btwGlobalParent, "global.jsonl")

	// Only the alive parent appears in the current session list.
	all := []sessions.SessionSummary{
		{ID: "alive-parent"},
		{ID: keepID},
		{ID: goneID},
	}
	s.reapOrphanedBtw(all)

	ids := s.btwSessionIDs()
	if !ids[keepID] {
		t.Fatalf("expected alive-parent's btw kept, got %v", ids)
	}
	if ids[goneID] {
		t.Fatalf("expected dead-parent's btw reaped, got %v", ids)
	}
	if !ids["global.jsonl"] {
		t.Fatalf("expected global sentinel btw kept, got %v", ids)
	}
	// The reaped btw file is removed from disk.
	if resolved, err := sessions.ResolveByID(dir, goneID); err == nil {
		if _, statErr := os.Stat(resolved.Path); statErr == nil {
			t.Fatalf("expected reaped btw file deleted: %s", resolved.Path)
		}
	}
}

func TestMigrateLegacyBtwSession(t *testing.T) {
	db := newBtwDB(t)
	if _, err := db.Exec(`INSERT INTO app_settings (key, value) VALUES (?, 'legacy.jsonl')`, settingBtwSessionID); err != nil {
		t.Fatal(err)
	}

	migrateLegacyBtwSession(db)

	s := &Server{db: db}
	if got := s.getBtwSessionID(btwGlobalParent); got != "legacy.jsonl" {
		t.Fatalf("expected legacy btw migrated to global sentinel, got %q", got)
	}
	// Legacy key is removed; running again is a harmless no-op.
	var v string
	if err := db.QueryRow("SELECT value FROM app_settings WHERE key = ?", settingBtwSessionID).Scan(&v); err != sql.ErrNoRows {
		t.Fatalf("expected legacy key deleted, got value=%q err=%v", v, err)
	}
	migrateLegacyBtwSession(db)
}
