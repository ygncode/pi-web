package server

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"pi-web/internal/sessions"
)

func TestApiSessions_ETagRevalidation(t *testing.T) {
	sessionsDir := t.TempDir()
	writeSessionWithCWD(t, filepath.Join(sessionsDir, "sub1"), "session-a.jsonl", "/home/user/project-a")
	s := &Server{sessionsDir: sessionsDir, cache: sessions.NewCache()}

	req := httptest.NewRequest(http.MethodGet, "/api/sessions", nil)
	w := httptest.NewRecorder()
	s.handleApiSessions(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	etag := w.Header().Get("ETag")
	if etag == "" {
		t.Fatal("missing ETag on /api/sessions")
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/sessions", nil)
	req2.Header.Set("If-None-Match", etag)
	w2 := httptest.NewRecorder()
	s.handleApiSessions(w2, req2)
	if w2.Code != http.StatusNotModified {
		t.Fatalf("expected 304, got %d", w2.Code)
	}
	if w2.Body.Len() != 0 {
		t.Fatalf("304 must have empty body, got %q", w2.Body.String())
	}
}

func TestApiSession_ETagRevalidation(t *testing.T) {
	root := t.TempDir()
	writeSessionWithNMessages(t, root, "proj", "s.jsonl", 5)
	s := &Server{sessionsDir: root, cache: sessions.NewCache()}

	req := httptest.NewRequest(http.MethodGet, "/api/session?id=s.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleApiSession(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	etag := w.Header().Get("ETag")
	if etag == "" {
		t.Fatal("missing ETag on /api/session")
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/session?id=s.jsonl", nil)
	req2.Header.Set("If-None-Match", etag)
	w2 := httptest.NewRecorder()
	s.handleApiSession(w2, req2)
	if w2.Code != http.StatusNotModified {
		t.Fatalf("expected 304, got %d", w2.Code)
	}
	if w2.Body.Len() != 0 {
		t.Fatalf("304 must have empty body, got %q", w2.Body.String())
	}
}
