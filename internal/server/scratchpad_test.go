package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	_ "modernc.org/sqlite"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS scratchpads (
		project_path TEXT PRIMARY KEY,
		content TEXT,
		updated_at DATETIME
	)`)
	if err != nil {
		t.Fatalf("failed to create test table: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestHandleGetScratchpad(t *testing.T) {
	db := newTestDB(t)
	s := &Server{db: db}

	_, err := db.Exec(`INSERT INTO scratchpads (project_path, content, updated_at) VALUES (?, ?, datetime('now'))`, "/my/project", "test content")
	if err != nil {
		t.Fatalf("failed to insert test data: %v", err)
	}

	// Existing entry returns its content.
	req := httptest.NewRequest(http.MethodGet, "/api/scratchpad?project=/my/project", nil)
	w := httptest.NewRecorder()
	s.handleGetScratchpad(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp["content"] != "test content" {
		t.Errorf("expected 'test content', got %q", resp["content"])
	}

	// Missing entry returns empty content, not an error.
	req2 := httptest.NewRequest(http.MethodGet, "/api/scratchpad?project=/nonexistent", nil)
	w2 := httptest.NewRecorder()
	s.handleGetScratchpad(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for missing entry, got %d", w2.Code)
	}
	var resp2 map[string]any
	if err := json.Unmarshal(w2.Body.Bytes(), &resp2); err != nil {
		t.Fatal(err)
	}
	if resp2["content"] != "" {
		t.Errorf("expected empty content for missing entry, got %q", resp2["content"])
	}

	// Missing project param returns 400.
	req3 := httptest.NewRequest(http.MethodGet, "/api/scratchpad", nil)
	w3 := httptest.NewRecorder()
	s.handleGetScratchpad(w3, req3)
	if w3.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing project, got %d", w3.Code)
	}

	// Wrong method returns 405.
	req4 := httptest.NewRequest(http.MethodPost, "/api/scratchpad?project=/my/project", nil)
	w4 := httptest.NewRecorder()
	s.handleGetScratchpad(w4, req4)
	if w4.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for POST on GET handler, got %d", w4.Code)
	}

	// Nil db returns 500.
	sNoDB := &Server{}
	req5 := httptest.NewRequest(http.MethodGet, "/api/scratchpad?project=/x", nil)
	w5 := httptest.NewRecorder()
	sNoDB.handleGetScratchpad(w5, req5)
	if w5.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for nil db, got %d", w5.Code)
	}
}

func TestHandleSaveScratchpad(t *testing.T) {
	db := newTestDB(t)
	s := &Server{db: db}

	// Save new content.
	body := bytes.NewBufferString(`{"project":"/my/project","content":"hello world"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/scratchpad", body)
	w := httptest.NewRecorder()
	s.handleSaveScratchpad(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp["ok"] != true {
		t.Errorf("expected ok=true, got %v", resp["ok"])
	}

	var stored string
	if err := db.QueryRow("SELECT content FROM scratchpads WHERE project_path = ?", "/my/project").Scan(&stored); err != nil {
		t.Fatalf("failed to query stored content: %v", err)
	}
	if stored != "hello world" {
		t.Errorf("expected 'hello world', got %q", stored)
	}

	// Upsert updates existing entry.
	body2 := bytes.NewBufferString(`{"project":"/my/project","content":"updated"}`)
	req2 := httptest.NewRequest(http.MethodPost, "/api/scratchpad", body2)
	w2 := httptest.NewRecorder()
	s.handleSaveScratchpad(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update, got %d", w2.Code)
	}
	if err := db.QueryRow("SELECT content FROM scratchpads WHERE project_path = ?", "/my/project").Scan(&stored); err != nil {
		t.Fatalf("failed to query updated content: %v", err)
	}
	if stored != "updated" {
		t.Errorf("expected 'updated', got %q", stored)
	}

	// Missing project returns 400.
	body3 := bytes.NewBufferString(`{"content":"no project"}`)
	req3 := httptest.NewRequest(http.MethodPost, "/api/scratchpad", body3)
	w3 := httptest.NewRecorder()
	s.handleSaveScratchpad(w3, req3)
	if w3.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing project, got %d", w3.Code)
	}

	// Wrong method returns 405.
	req4 := httptest.NewRequest(http.MethodGet, "/api/scratchpad", nil)
	w4 := httptest.NewRecorder()
	s.handleSaveScratchpad(w4, req4)
	if w4.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for GET on POST handler, got %d", w4.Code)
	}

	// Nil db returns 500.
	sNoDB := &Server{}
	body5 := bytes.NewBufferString(`{"project":"/x","content":"y"}`)
	req5 := httptest.NewRequest(http.MethodPost, "/api/scratchpad", body5)
	w5 := httptest.NewRecorder()
	sNoDB.handleSaveScratchpad(w5, req5)
	if w5.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for nil db, got %d", w5.Code)
	}
}

func TestHandleSessionUsesSPAShell(t *testing.T) {
	s := &Server{
		renderAppShell: func(w io.Writer, bootstrap string) error {
			_, err := io.WriteString(w, "spa shell")
			return err
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/session?id=with-pad.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleSession(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); got != "spa shell" {
		t.Fatalf("expected SPA shell, got %q", got)
	}
}
