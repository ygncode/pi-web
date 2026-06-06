package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"pi-web/internal/sessions"
)

func TestHandleRenameSessionAppendsSessionInfo(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{
		sessionsDir: root,
		cache:       sessions.NewCache(),
		now:         func() time.Time { return time.Date(2026, 5, 8, 10, 1, 2, 0, time.UTC) },
	}

	req := httptest.NewRequest(http.MethodPost, "/api/rename-session?id=session.jsonl", strings.NewReader(`{"name":"New Name"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleRenameSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["ok"] != true || payload["name"] != "New Name" {
		t.Fatalf("payload = %#v", payload)
	}

	resolved, err := sessions.ResolveByID(root, "session.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if resolved.Session.Name != "New Name" {
		t.Fatalf("session name = %q, want New Name", resolved.Session.Name)
	}
}

func TestHandleApiSessionIncludesSessionName(t *testing.T) {
	root := t.TempDir()
	path := writeSessionFile(t, root, "test-project", "session.jsonl")
	if err := sessions.RenameSession(path, "Live Title", func() time.Time { return time.Date(2026, 5, 8, 10, 1, 2, 0, time.UTC) }); err != nil {
		t.Fatal(err)
	}
	s := &Server{sessionsDir: root, cache: sessions.NewCache()}

	req := httptest.NewRequest(http.MethodGet, "/api/session?id=session.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleApiSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["name"] != "Live Title" {
		t.Fatalf("name = %#v, want Live Title", payload["name"])
	}
	if payload["chatAvailable"] != true {
		t.Fatalf("chatAvailable = %#v, want true", payload["chatAvailable"])
	}
	if _, ok := payload["chatDisabledReason"]; !ok {
		t.Fatal("payload missing chatDisabledReason")
	}
	if _, ok := payload["model"]; !ok {
		t.Fatal("payload missing model")
	}
	if _, ok := payload["modelProvider"]; !ok {
		t.Fatal("payload missing modelProvider")
	}
}

func TestHandleLabelSessionEntryAppendsLabel(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{
		sessionsDir: root,
		cache:       sessions.NewCache(),
		now:         func() time.Time { return time.Date(2026, 5, 8, 10, 1, 2, 0, time.UTC) },
	}

	req := httptest.NewRequest(http.MethodPost, "/api/label-session?id=session.jsonl", strings.NewReader(`{"entryId":"aaaaaaaa","label":"Checkpoint"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleLabelSessionEntry(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	resolved, err := sessions.ResolveByID(root, "session.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	last := resolved.Session.Entries[len(resolved.Session.Entries)-1]
	if last["type"] != "label" || last["targetId"] != "aaaaaaaa" || last["label"] != "Checkpoint" {
		t.Fatalf("last entry = %#v", last)
	}
}

func TestHandleLabelSessionEntryRejectsMissingEntry(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{sessionsDir: root, cache: sessions.NewCache()}

	req := httptest.NewRequest(http.MethodPost, "/api/label-session?id=session.jsonl", strings.NewReader(`{"entryId":"missing","label":"Checkpoint"}`))
	w := httptest.NewRecorder()
	s.handleLabelSessionEntry(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404, body = %s", w.Code, w.Body.String())
	}
}

func TestHandleRenameSessionRejectsEmptyName(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{sessionsDir: root, cache: sessions.NewCache()}

	req := httptest.NewRequest(http.MethodPost, "/api/rename-session?id=session.jsonl", strings.NewReader(`{"name":"   "}`))
	w := httptest.NewRecorder()
	s.handleRenameSession(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

func TestHandleRenameSessionRejectsMissingSession(t *testing.T) {
	s := &Server{sessionsDir: t.TempDir(), cache: sessions.NewCache()}
	req := httptest.NewRequest(http.MethodPost, "/api/rename-session?id=missing.jsonl", strings.NewReader(`{"name":"New"}`))
	w := httptest.NewRecorder()
	s.handleRenameSession(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
}
