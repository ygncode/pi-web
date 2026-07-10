package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pi-web/internal/sessions"
)

func writeTreeSessionFile(t *testing.T, root, project, name string) string {
	t.Helper()
	dir := filepath.Join(root, project)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, name)
	cwd := filepath.Join(root, "cwd")
	if err := os.MkdirAll(cwd, 0755); err != nil {
		t.Fatal(err)
	}
	content := `{"type":"session","version":3,"id":"sid","timestamp":"2026-05-06T00:00:00.000Z","cwd":` + jsonString(cwd) + `}` + "\n" +
		`{"type":"message","id":"a1b2c3d4","parentId":null,"timestamp":"2026-05-06T00:00:01.000Z","message":{"role":"user","content":"hello"}}` + "\n" +
		`{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2026-05-06T00:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}]}}` + "\n" +
		`{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2026-05-06T00:00:03.000Z","message":{"role":"user","content":"how are you?"}}` + "\n" +
		`{"type":"message","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2026-05-06T00:00:04.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Good!"}]}}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestHandleApiForkSession(t *testing.T) {
	root := t.TempDir()
	writeTreeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{
		sessionsDir: root,
		cache:       sessions.NewCache(),
		now:         func() time.Time { return time.Date(2026, 5, 8, 11, 0, 0, 0, time.UTC) },
	}

	req := httptest.NewRequest(http.MethodPost, "/api/fork-session?id=session.jsonl", strings.NewReader(`{"entryId":"c3d4e5f6"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleApiForkSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["ok"] != true {
		t.Fatalf("payload = %#v", payload)
	}
	newID, ok := payload["id"].(string)
	if !ok || newID == "" {
		t.Fatalf("missing id in payload = %#v", payload)
	}

	// Verify the forked file exists and has the right content
	resolved, err := sessions.ResolveByID(root, newID)
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(resolved.Path)
	if err != nil {
		t.Fatal(err)
	}
	content := string(data)
	if !strings.Contains(content, `"parentSession"`) {
		t.Fatal("missing parentSession")
	}
	if !strings.Contains(content, `"forkedFrom"`) {
		t.Fatal("missing forkedFrom")
	}
	if !strings.Contains(content, `"id":"a1b2c3d4"`) {
		t.Fatal("missing first user message")
	}
	if !strings.Contains(content, `"id":"c3d4e5f6"`) {
		t.Fatal("missing fork point")
	}
	if strings.Contains(content, `"id":"d4e5f6g7"`) {
		t.Fatal("should not contain message after fork point")
	}
}

func TestHandleApiCloneSession(t *testing.T) {
	root := t.TempDir()
	writeTreeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{
		sessionsDir: root,
		cache:       sessions.NewCache(),
		now:         func() time.Time { return time.Date(2026, 5, 8, 11, 0, 0, 0, time.UTC) },
	}

	req := httptest.NewRequest(http.MethodPost, "/api/clone-session?id=session.jsonl", strings.NewReader(`{"leafId":"c3d4e5f6"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleApiCloneSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["ok"] != true {
		t.Fatalf("payload = %#v", payload)
	}
	newID, ok := payload["id"].(string)
	if !ok || newID == "" {
		t.Fatalf("missing id in payload = %#v", payload)
	}

	resolved, err := sessions.ResolveByID(root, newID)
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(resolved.Path)
	if err != nil {
		t.Fatal(err)
	}
	content := string(data)
	if !strings.Contains(content, `"parentSession"`) {
		t.Fatal("missing parentSession")
	}
	if strings.Contains(content, `"forkedFrom"`) {
		t.Fatal("clone should not have forkedFrom")
	}
	if !strings.Contains(content, `"id":"a1b2c3d4"`) {
		t.Fatal("missing first user message")
	}
	if !strings.Contains(content, `"id":"c3d4e5f6"`) {
		t.Fatal("missing leaf entry")
	}
}

func TestHandleApiForkSessionRejectsMissingEntry(t *testing.T) {
	root := t.TempDir()
	writeTreeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{sessionsDir: root, cache: sessions.NewCache()}

	req := httptest.NewRequest(http.MethodPost, "/api/fork-session?id=session.jsonl", strings.NewReader(`{"entryId":"nonexistent"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleApiForkSession(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
}

func TestHandleApiCloneSessionDefaultsToLastEntry(t *testing.T) {
	root := t.TempDir()
	writeTreeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{
		sessionsDir: root,
		cache:       sessions.NewCache(),
		now:         func() time.Time { return time.Date(2026, 5, 8, 11, 0, 0, 0, time.UTC) },
	}

	req := httptest.NewRequest(http.MethodPost, "/api/clone-session?id=session.jsonl", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleApiCloneSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["ok"] != true {
		t.Fatalf("payload = %#v", payload)
	}
}
