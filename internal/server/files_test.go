package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"pi-web/internal/files"
	"pi-web/internal/sessions"
)

// newFilesTestServer writes a session whose cwd is seeded with files and
// returns the server plus that cwd. The session id is "sid".
func newFilesTestServer(t *testing.T, seed ...string) (*Server, string) {
	t.Helper()
	root := t.TempDir()
	writeSessionFile(t, root, "project", "s.jsonl")
	cwd := filepath.Join(root, "cwd")
	for _, p := range seed {
		full := filepath.Join(cwd, filepath.FromSlash(p))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return &Server{sessionsDir: root, cache: sessions.NewCache()}, cwd
}

func getFiles(t *testing.T, s *Server, query string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/files?id=s.jsonl&q="+query, nil)
	w := httptest.NewRecorder()
	s.handleApiFiles(w, req)
	return w
}

func decodeFiles(t *testing.T, w *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var body struct {
		Files []map[string]any `json:"files"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode %q: %v", w.Body.String(), err)
	}
	return body.Files
}

func TestHandleApiFiles_RanksMatches(t *testing.T) {
	s, _ := newFilesTestServer(t, "app.js", "myapp.js", "unrelated.txt")
	w := getFiles(t, s, "app")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	got := decodeFiles(t, w)
	if len(got) != 2 {
		t.Fatalf("want 2 matches, got %v", got)
	}
	if got[0]["path"] != "app.js" {
		t.Fatalf("want app.js first, got %v", got)
	}
}

func TestHandleApiFiles_EmptyQueryLists(t *testing.T) {
	s, _ := newFilesTestServer(t, "a.txt", "b.txt")
	got := decodeFiles(t, getFiles(t, s, ""))
	if len(got) != 2 {
		t.Fatalf("want 2 entries, got %v", got)
	}
}

func TestHandleApiFiles_ShortQueryStaysShallow(t *testing.T) {
	// A nested match must not surface for an empty or single-char query: those
	// only list immediate children, avoiding a recursive walk.
	s, _ := newFilesTestServer(t, "app.js", "deep/appendix.js")
	for _, q := range []string{"", "a"} {
		got := decodeFiles(t, getFiles(t, s, q))
		for _, f := range got {
			if f["path"] == "deep/appendix.js" {
				t.Fatalf("query %q recursed into nested file: %v", q, got)
			}
		}
	}
}

func TestHandleApiFiles_LongQueryGoesDeep(t *testing.T) {
	s, _ := newFilesTestServer(t, "deep/nested/appendix.js", "top.txt")
	got := decodeFiles(t, getFiles(t, s, "appendix"))
	found := false
	for _, f := range got {
		if f["path"] == "deep/nested/appendix.js" {
			found = true
		}
	}
	if !found {
		t.Fatalf("long query should recurse to nested match, got %v", got)
	}
}

func TestHandleApiFiles_MethodNotAllowed(t *testing.T) {
	s, _ := newFilesTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/files?id=s.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleApiFiles(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestHandleApiFiles_NotFound(t *testing.T) {
	s, _ := newFilesTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/files?id=missing.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleApiFiles(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestHandleApiFiles_MissingCwdReturnsEmpty(t *testing.T) {
	root := t.TempDir()
	// Session header points at a cwd that does not exist on disk.
	dir := filepath.Join(root, "project")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	content := `{"type":"session","version":3,"id":"sid","timestamp":"2026-05-06T00:00:00.000Z","cwd":"/definitely/missing/xyz"}` + "\n"
	if err := os.WriteFile(filepath.Join(dir, "s.jsonl"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	s := &Server{sessionsDir: root, cache: sessions.NewCache()}
	w := getFiles(t, s, "x")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := decodeFiles(t, w); len(got) != 0 {
		t.Fatalf("want empty list for missing cwd, got %v", got)
	}
}

func TestFileWalkCacheReusesWalk(t *testing.T) {
	now := time.Unix(0, 0)
	c := newFileWalkCache(func() time.Time { return now })
	calls := 0
	fn := func() ([]files.Entry, error) { calls++; return []files.Entry{}, nil }

	_, _ = c.get("/a", fn)
	_, _ = c.get("/a", fn)
	if calls != 1 {
		t.Fatalf("expected 1 walk within TTL, got %d", calls)
	}

	// A different cwd is a distinct cache key.
	_, _ = c.get("/b", fn)
	if calls != 2 {
		t.Fatalf("expected separate walk per cwd, got %d", calls)
	}

	now = now.Add(fileWalkTTL + time.Second)
	_, _ = c.get("/a", fn)
	if calls != 3 {
		t.Fatalf("expected re-walk after TTL, got %d", calls)
	}
}
