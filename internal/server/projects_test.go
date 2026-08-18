package server

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pi-web/internal/sessions"

	_ "modernc.org/sqlite"
)

func newProjectPrefsDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if _, err := db.Exec(projectPrefsSchema); err != nil {
		t.Fatalf("create project_prefs: %v", err)
	}
	if _, err := db.Exec(appSettingsSchema); err != nil {
		t.Fatalf("create app_settings: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func enabledSet(t *testing.T, s *Server) map[string]bool {
	t.Helper()
	set, ok := s.enabledProjectSet()
	if !ok {
		t.Fatal("enabledProjectSet not available")
	}
	return set
}

func TestSyncProjectPrefs_FirstRunEnablesAll(t *testing.T) {
	s := &Server{db: newProjectPrefsDB(t), now: time.Now}
	s.syncProjectPrefs([]string{"/a", "/b"})

	set := enabledSet(t, s)
	if !set["/a"] || !set["/b"] {
		t.Fatalf("first run should enable all discovered projects, got %v", set)
	}
}

func TestSyncProjectPrefs_NewProjectsHiddenAfterBootstrap(t *testing.T) {
	s := &Server{db: newProjectPrefsDB(t), now: time.Now}
	s.syncProjectPrefs([]string{"/a"}) // bootstrap: /a enabled

	s.syncProjectPrefs([]string{"/a", "/c"}) // /c appears later
	set := enabledSet(t, s)
	if !set["/a"] {
		t.Fatal("/a should remain enabled")
	}
	if set["/c"] {
		t.Fatal("/c discovered after bootstrap should be hidden by default")
	}
}

func TestSyncProjectPrefs_PreservesExistingState(t *testing.T) {
	s := &Server{db: newProjectPrefsDB(t), now: time.Now}
	s.syncProjectPrefs([]string{"/a"})
	// User disables /a.
	if _, err := s.db.Exec("UPDATE project_prefs SET enabled = 0 WHERE project_path = ?", "/a"); err != nil {
		t.Fatal(err)
	}
	// A later sync must not re-enable it.
	s.syncProjectPrefs([]string{"/a", "/b"})
	set := enabledSet(t, s)
	if set["/a"] {
		t.Fatal("/a should stay disabled across syncs")
	}
}

func TestFilterEnabledSummaries(t *testing.T) {
	s := &Server{db: newProjectPrefsDB(t), now: time.Now}
	s.setProjectFilterEnabled(true)
	// Seed: /a enabled, /b disabled.
	s.syncProjectPrefs([]string{"/a"})
	s.syncProjectPrefs([]string{"/a", "/b"}) // /b hidden

	summaries := []sessions.SessionSummary{
		{ID: "1", Project: "/a"},
		{ID: "2", Project: "/b"},
		{ID: "3", Project: ""}, // empty project always kept
	}
	out := s.filterEnabledSummaries(summaries)
	got := map[string]bool{}
	for _, sum := range out {
		got[sum.ID] = true
	}
	if !got["1"] || got["2"] || !got["3"] {
		t.Fatalf("unexpected filter result: %v", got)
	}
}

func TestFilterEnabledSummaries_NoDBIsNoOp(t *testing.T) {
	s := &Server{}
	summaries := []sessions.SessionSummary{{ID: "1", Project: "/a"}}
	if len(s.filterEnabledSummaries(summaries)) != 1 {
		t.Fatal("without db, filtering should be a no-op")
	}
}

func TestFilterDisabledShowsEverything(t *testing.T) {
	s := &Server{db: newProjectPrefsDB(t), now: time.Now}
	// /b is disabled in prefs, but the master filter is off (default).
	s.syncProjectPrefs([]string{"/a"})
	s.syncProjectPrefs([]string{"/a", "/b"})

	summaries := []sessions.SessionSummary{{ID: "1", Project: "/a"}, {ID: "2", Project: "/b"}}
	if got := s.filterEnabledSummaries(summaries); len(got) != 2 {
		t.Fatalf("filter off should show everything, got %d", len(got))
	}

	s.setProjectFilterEnabled(true)
	if got := s.filterEnabledSummaries(summaries); len(got) != 1 {
		t.Fatalf("filter on should hide /b, got %d", len(got))
	}
}

func TestHandleUpdateProject_FilterToggle(t *testing.T) {
	s := &Server{db: newProjectPrefsDB(t), now: time.Now}
	if s.projectFilterEnabled() {
		t.Fatal("filter should default off")
	}

	post := func(action string) {
		body, _ := json.Marshal(map[string]string{"action": action})
		req := httptest.NewRequest(http.MethodPost, "/api/projects", strings.NewReader(string(body)))
		w := httptest.NewRecorder()
		s.handleUpdateProject(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("%s status = %d", action, w.Code)
		}
	}

	post("enable-filter")
	if !s.projectFilterEnabled() {
		t.Fatal("enable-filter should turn the filter on")
	}
	post("disable-filter")
	if s.projectFilterEnabled() {
		t.Fatal("disable-filter should turn the filter off")
	}
}

func TestHandleUpdateProject(t *testing.T) {
	s := &Server{db: newProjectPrefsDB(t), now: time.Now}
	// Real absolute paths: register/enable normalize and reject paths like
	// "/a", which is not absolute on Windows.
	pathA := filepath.Join(t.TempDir(), "a")
	pathProj := filepath.Join(t.TempDir(), "proj")

	post := func(path, action string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"path": path, "action": action})
		req := httptest.NewRequest(http.MethodPost, "/api/projects", strings.NewReader(string(body)))
		w := httptest.NewRecorder()
		s.handleUpdateProject(w, req)
		return w
	}

	if w := post(pathA, "enable"); w.Code != http.StatusOK {
		t.Fatalf("enable status = %d", w.Code)
	}
	if !enabledSet(t, s)[pathA] {
		t.Fatalf("%s should be enabled", pathA)
	}

	if w := post(pathA, "disable"); w.Code != http.StatusOK {
		t.Fatalf("disable status = %d", w.Code)
	}
	if enabledSet(t, s)[pathA] {
		t.Fatalf("%s should be disabled", pathA)
	}

	// register stores the path with source=registered and enabled.
	if w := post(pathProj, "register"); w.Code != http.StatusOK {
		t.Fatalf("register status = %d", w.Code)
	}
	var source string
	if err := s.db.QueryRow("SELECT source FROM project_prefs WHERE project_path = ?", pathProj).Scan(&source); err != nil {
		t.Fatal(err)
	}
	if source != "registered" {
		t.Fatalf("source = %q, want registered", source)
	}

	// remove deletes the row.
	if w := post(pathProj, "remove"); w.Code != http.StatusOK {
		t.Fatalf("remove status = %d", w.Code)
	}
	var count int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM project_prefs WHERE project_path = ?", pathProj).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("removed project should be gone")
	}

	if w := post(pathA, "bogus"); w.Code != http.StatusBadRequest {
		t.Fatalf("unknown action status = %d, want 400", w.Code)
	}
}

func TestHandleUpdateProject_BulkToggle(t *testing.T) {
	s := &Server{db: newProjectPrefsDB(t), cache: sessions.NewCache(), sessionsDir: t.TempDir(), now: time.Now}
	s.syncProjectPrefs([]string{"/a", "/b", "/c"})

	post := func(action string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"action": action})
		req := httptest.NewRequest(http.MethodPost, "/api/projects", strings.NewReader(string(body)))
		w := httptest.NewRecorder()
		s.handleUpdateProject(w, req)
		return w
	}

	if w := post("disable-all"); w.Code != http.StatusOK {
		t.Fatalf("disable-all status = %d", w.Code)
	}
	if len(enabledSet(t, s)) != 0 {
		t.Fatal("disable-all should disable every project")
	}

	if w := post("enable-all"); w.Code != http.StatusOK {
		t.Fatalf("enable-all status = %d", w.Code)
	}
	set := enabledSet(t, s)
	if !set["/a"] || !set["/b"] || !set["/c"] {
		t.Fatalf("enable-all should enable every project, got %v", set)
	}
}

func TestHandleApiProjects(t *testing.T) {
	sessionsDir := t.TempDir()
	writeSessionWithCWD(t, filepath.Join(sessionsDir, "sub1"), "a.jsonl", "/home/user/project-a")
	writeSessionWithCWD(t, filepath.Join(sessionsDir, "sub1"), "b.jsonl", "/home/user/project-a")
	writeSessionWithCWD(t, filepath.Join(sessionsDir, "sub2"), "c.jsonl", "/home/user/project-b")

	s := &Server{
		db:          newProjectPrefsDB(t),
		sessionsDir: sessionsDir,
		cache:       sessions.NewCache(),
		now:         time.Now,
		lastKnown:   map[string]struct{}{"a.jsonl": {}},
	}

	req := httptest.NewRequest(http.MethodGet, "/api/projects?current=/home/user/project-a&sessionLimit=5", nil)
	w := httptest.NewRecorder()
	s.handleApiProjects(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}

	var payload struct {
		Projects             []projectEntry            `json:"projects"`
		Total                int                       `json:"total"`
		CurrentSessions      []sessions.SessionSummary `json:"currentSessions"`
		CurrentSessionsTotal int                       `json:"currentSessionsTotal"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Total != 2 {
		t.Fatalf("total = %d, want 2", payload.Total)
	}
	if len(payload.CurrentSessions) != 2 || payload.CurrentSessionsTotal != 2 {
		t.Fatalf(
			"current sessions = %d, total %d; want 2, 2",
			len(payload.CurrentSessions),
			payload.CurrentSessionsTotal,
		)
	}
	for _, sum := range payload.CurrentSessions {
		if sum.Project != "/home/user/project-a" {
			t.Fatalf("current session project = %q", sum.Project)
		}
	}
	byPath := map[string]projectEntry{}
	for _, p := range payload.Projects {
		byPath[p.Path] = p
	}
	a, ok := byPath["/home/user/project-a"]
	if !ok || a.SessionCount != 2 || !a.Enabled {
		t.Fatalf("project-a entry wrong: %+v", a)
	}
	if len(a.RunningSessionIDs) != 1 || a.RunningSessionIDs[0] != "a.jsonl" {
		t.Fatalf("project-a running sessions wrong: %+v", a.RunningSessionIDs)
	}
	b, ok := byPath["/home/user/project-b"]
	if !ok || b.SessionCount != 1 || !b.Enabled {
		t.Fatalf("project-b entry wrong: %+v", b)
	}
}

func TestHandleApiProjectsFiltered(t *testing.T) {
	sessionsDir := t.TempDir()
	writeSessionWithCWD(t, filepath.Join(sessionsDir, "sub1"), "a.jsonl", "/home/user/project-a")
	writeSessionWithCWD(t, filepath.Join(sessionsDir, "sub2"), "b.jsonl", "/home/user/project-b")

	s := &Server{db: newProjectPrefsDB(t), sessionsDir: sessionsDir, cache: sessions.NewCache(), now: time.Now}
	// Seed both projects, then disable project-b.
	s.syncProjectPrefs([]string{"/home/user/project-a", "/home/user/project-b"})
	if _, err := s.db.Exec("UPDATE project_prefs SET enabled = 0 WHERE project_path = ?", "/home/user/project-b"); err != nil {
		t.Fatal(err)
	}

	getPaths := func(url string) ([]string, int) {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, url, nil)
		w := httptest.NewRecorder()
		s.handleApiProjects(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d", w.Code)
		}
		var payload struct {
			Projects []projectEntry `json:"projects"`
			Total    int            `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		paths := make([]string, 0, len(payload.Projects))
		for _, p := range payload.Projects {
			paths = append(paths, p.Path)
		}
		return paths, payload.Total
	}

	// Master filter off: filtered=1 is a no-op.
	if paths, total := getPaths("/api/projects?filtered=1"); len(paths) != 2 || total != 2 {
		t.Fatalf("filter off: got %v (total %d), want both projects", paths, total)
	}

	s.setProjectFilterEnabled(true)

	// Without filtered=1 (Manage Projects modal) everything still shows.
	if paths, total := getPaths("/api/projects"); len(paths) != 2 || total != 2 {
		t.Fatalf("no filtered param: got %v (total %d), want both projects", paths, total)
	}

	// filtered=1 drops the disabled project and total reflects it.
	paths, total := getPaths("/api/projects?filtered=1")
	if len(paths) != 1 || paths[0] != "/home/user/project-a" || total != 1 {
		t.Fatalf("filtered: got %v (total %d), want only project-a", paths, total)
	}

	// The current project is kept even when disabled.
	paths, total = getPaths("/api/projects?filtered=1&current=/home/user/project-b")
	if len(paths) != 2 || total != 2 || paths[0] != "/home/user/project-b" {
		t.Fatalf("filtered current: got %v (total %d), want project-b first", paths, total)
	}
}

func TestHandleApiProjectsPagination(t *testing.T) {
	sessionsDir := t.TempDir()
	for i := range 25 {
		project := fmt.Sprintf("/home/user/project-%02d", i)
		filename := fmt.Sprintf("%02d.jsonl", i)
		writeSessionWithCWD(t, filepath.Join(sessionsDir, filename), filename, project)
	}

	s := &Server{db: newProjectPrefsDB(t), sessionsDir: sessionsDir, cache: sessions.NewCache(), now: time.Now}
	getPage := func(url string) ([]projectEntry, int) {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, url, nil)
		w := httptest.NewRecorder()
		s.handleApiProjects(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d", w.Code)
		}
		var payload struct {
			Projects []projectEntry `json:"projects"`
			Total    int            `json:"total"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		return payload.Projects, payload.Total
	}

	first, total := getPage("/api/projects?limit=20&current=/home/user/project-24")
	if len(first) != 20 || total != 25 {
		t.Fatalf("first page = %d projects, total %d; want 20, 25", len(first), total)
	}
	if first[0].Path != "/home/user/project-24" {
		t.Fatalf("current project = %q, want first", first[0].Path)
	}

	second, total := getPage("/api/projects?limit=20&offset=20&current=/home/user/project-24")
	if len(second) != 5 || total != 25 {
		t.Fatalf("second page = %d projects, total %d; want 5, 25", len(second), total)
	}
}

func TestNormalizeProjectPath(t *testing.T) {
	home, _ := os.UserHomeDir()
	// Platform-absolute fixtures: "/abs/path" is not absolute on Windows.
	abs := filepath.Join(t.TempDir(), "abs", "path")
	spaced := filepath.Join(t.TempDir(), "spaced")
	cases := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{abs, abs, false},
		{abs + string(filepath.Separator), abs, false},
		{"~/proj", filepath.Join(home, "proj"), false},
		{"  " + spaced + "  ", spaced, false},
		{"relative/path", "", true},
		{"", "", true},
	}
	for _, tc := range cases {
		got, err := normalizeProjectPath(tc.in)
		if tc.wantErr {
			if err == nil {
				t.Errorf("normalizeProjectPath(%q) expected error", tc.in)
			}
			continue
		}
		if err != nil {
			t.Errorf("normalizeProjectPath(%q) error: %v", tc.in, err)
			continue
		}
		if got != tc.want {
			t.Errorf("normalizeProjectPath(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
