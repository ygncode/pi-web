package server

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"pi-web/internal/chatqueue"

	_ "modernc.org/sqlite"
)

func newQueueTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	db.SetMaxOpenConns(1)
	for _, stmt := range []string{
		chatqueue.ItemsTableDDL,
		chatqueue.ItemsSessionIndexDDL,
		chatqueue.StateTableDDL,
	} {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("apply schema: %v", err)
		}
	}
	return db
}

func writeQueueTestSession(t *testing.T, sessionsDir string) string {
	t.Helper()
	project := filepath.Join(sessionsDir, "proj")
	if err := os.MkdirAll(project, 0o755); err != nil {
		t.Fatal(err)
	}
	id := "2026-06-22T01-00-00.000Z_q.jsonl"
	body := `{"type":"session","version":3,"id":"q","cwd":` + jsonString(project) + `}` + "\n"
	if err := os.WriteFile(filepath.Join(project, id), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	return id
}

func newQueueServer(t *testing.T) (*Server, string) {
	t.Helper()
	db := newQueueTestDB(t)
	s := &Server{sessionsDir: t.TempDir(), db: db, chatQueue: chatqueue.NewStore(db)}
	id := writeQueueTestSession(t, s.sessionsDir)
	return s, id
}

func decodeSnapshot(t *testing.T, w *httptest.ResponseRecorder) chatqueue.Snapshot {
	t.Helper()
	var snap chatqueue.Snapshot
	if err := json.Unmarshal(w.Body.Bytes(), &snap); err != nil {
		t.Fatalf("decode snapshot: %v\nbody=%s", err, w.Body.String())
	}
	return snap
}

func TestChatQueueAddThenList(t *testing.T) {
	s, id := newQueueServer(t)

	for _, msg := range []string{"hello", "world"} {
		body := `{"message":"` + msg + `"}`
		req := httptest.NewRequest(http.MethodPost,
			"/api/chat/queue?id="+id, strings.NewReader(body))
		w := httptest.NewRecorder()
		s.handleChatQueue(w, req)
		if w.Code != http.StatusCreated {
			t.Fatalf("POST %q: code=%d body=%s", msg, w.Code, w.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/chat/queue?id="+id, nil)
	w := httptest.NewRecorder()
	s.handleChatQueue(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GET: code=%d", w.Code)
	}
	snap := decodeSnapshot(t, w)
	if len(snap.Items) != 2 {
		t.Fatalf("want 2 items, got %#v", snap.Items)
	}
	if snap.Items[0].Message != "hello" || snap.Items[1].Message != "world" {
		t.Fatalf("order wrong: %#v", snap.Items)
	}
	if snap.Items[0].Position >= snap.Items[1].Position {
		t.Fatalf("positions not monotonic: %#v", snap.Items)
	}
	if snap.Paused {
		t.Fatalf("default paused must be false")
	}
}

func TestChatQueueDelete(t *testing.T) {
	s, id := newQueueServer(t)
	for _, msg := range []string{"a", "b", "c"} {
		req := httptest.NewRequest(http.MethodPost,
			"/api/chat/queue?id="+id, strings.NewReader(`{"message":"`+msg+`"}`))
		s.handleChatQueue(httptest.NewRecorder(), req)
	}
	// Find b's position.
	getReq := httptest.NewRequest(http.MethodGet, "/api/chat/queue?id="+id, nil)
	getW := httptest.NewRecorder()
	s.handleChatQueue(getW, getReq)
	snap := decodeSnapshot(t, getW)
	var bPos int64
	for _, it := range snap.Items {
		if it.Message == "b" {
			bPos = it.Position
		}
	}
	if bPos == 0 {
		t.Fatalf("item b not found in %#v", snap.Items)
	}

	delURL := "/api/chat/queue?id=" + id + "&position=" + strconv.FormatInt(bPos, 10)
	delReq := httptest.NewRequest(http.MethodDelete, delURL, nil)
	delW := httptest.NewRecorder()
	s.handleChatQueue(delW, delReq)
	if delW.Code != http.StatusOK {
		t.Fatalf("DELETE: code=%d body=%s", delW.Code, delW.Body.String())
	}

	getW2 := httptest.NewRecorder()
	s.handleChatQueue(getW2, httptest.NewRequest(http.MethodGet, "/api/chat/queue?id="+id, nil))
	snap2 := decodeSnapshot(t, getW2)
	if len(snap2.Items) != 2 {
		t.Fatalf("want 2 items after delete, got %#v", snap2.Items)
	}
	for _, it := range snap2.Items {
		if it.Message == "b" {
			t.Fatalf("deleted item still present: %#v", snap2.Items)
		}
	}
}

func TestChatQueuePauseRoundtrip(t *testing.T) {
	s, id := newQueueServer(t)
	patchReq := httptest.NewRequest(http.MethodPatch,
		"/api/chat/queue?id="+id, strings.NewReader(`{"paused":true}`))
	patchW := httptest.NewRecorder()
	s.handleChatQueue(patchW, patchReq)
	if patchW.Code != http.StatusOK {
		t.Fatalf("PATCH: code=%d body=%s", patchW.Code, patchW.Body.String())
	}

	getW := httptest.NewRecorder()
	s.handleChatQueue(getW, httptest.NewRequest(http.MethodGet, "/api/chat/queue?id="+id, nil))
	snap := decodeSnapshot(t, getW)
	if !snap.Paused {
		t.Fatalf("expected paused=true after PATCH")
	}
}

func TestChatQueueRejectsEmptyMessage(t *testing.T) {
	s, id := newQueueServer(t)
	req := httptest.NewRequest(http.MethodPost,
		"/api/chat/queue?id="+id, strings.NewReader(`{"message":"  "}`))
	w := httptest.NewRecorder()
	s.handleChatQueue(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestChatQueueRejectsUnknownSession(t *testing.T) {
	s, _ := newQueueServer(t)
	// Well-formed id pattern that doesn't match any file on disk → 404.
	req := httptest.NewRequest(http.MethodGet,
		"/api/chat/queue?id=2099-01-01T00-00-00.000Z_unknown.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleChatQueue(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestChatQueueRejectsMissingPositionOnDelete(t *testing.T) {
	s, id := newQueueServer(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/chat/queue?id="+id, nil)
	w := httptest.NewRecorder()
	s.handleChatQueue(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", w.Code)
	}
}

