package sessions

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestEncodeProjectName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/Users/setkyar/pi-web", "--Users-setkyar-pi-web--"},
		{"/Users/setkyar", "--Users-setkyar--"},
		{"/home/user/project", "--home-user-project--"},
		{"/a/b/c/d", "--a-b-c-d--"},
	}
	for _, tt := range tests {
		got := EncodeProjectName(tt.input)
		if got != tt.expected {
			t.Errorf("EncodeProjectName(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestDecodeProjectName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"--Users-setkyar--", "/Users/setkyar"},
		{"--home-user-project--", "/home/user/project"},
		{"--a-b-c-d--", "/a/b/c/d"},
	}
	for _, tt := range tests {
		got := DecodeProjectName(tt.input)
		if got != tt.expected {
			t.Errorf("DecodeProjectName(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestEncodeDecodeRoundTrip(t *testing.T) {
	paths := []string{
		"/Users/setkyar",
		"/home/user/project",
		"/a/b/c/d",
	}
	for _, p := range paths {
		encoded := EncodeProjectName(p)
		decoded := DecodeProjectName(encoded)
		if decoded != p {
			t.Errorf("round-trip failed: %q -> %q -> %q", p, encoded, decoded)
		}
	}
}

func TestListRecentLocationsReturnsNewestBoundedLocations(t *testing.T) {
	tmp := t.TempDir()
	base := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)

	for i := 0; i < 15; i++ {
		project := filepath.Join("/tmp", fmt.Sprintf("project%02d", i))
		dir := filepath.Join(tmp, EncodeProjectName(project))
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("mkdir project dir: %v", err)
		}
		mtime := base.Add(time.Duration(i) * time.Minute)
		if err := os.Chtimes(dir, mtime, mtime); err != nil {
			t.Fatalf("chtimes project dir: %v", err)
		}
	}

	locations, err := ListRecentLocations(tmp)
	if err != nil {
		t.Fatalf("ListRecentLocations failed: %v", err)
	}
	if len(locations) != 10 {
		t.Fatalf("expected 10 bounded locations, got %d: %#v", len(locations), locations)
	}
	if locations[0] != "/tmp/project14" {
		t.Fatalf("expected newest project first, got %q", locations[0])
	}
	if locations[9] != "/tmp/project05" {
		t.Fatalf("expected tenth newest project last, got %q", locations[9])
	}
}

func TestCreateSessionFile(t *testing.T) {
	tmpDir := t.TempDir()
	sessDir := filepath.Join(tmpDir, "sessions")
	projectPath := filepath.Join(tmpDir, "test-project")

	id, err := CreateSessionFile(sessDir, projectPath)
	if err != nil {
		t.Fatalf("CreateSessionFile failed: %v", err)
	}
	if !strings.HasSuffix(id, ".jsonl") {
		t.Fatalf("expected .jsonl suffix, got %q", id)
	}

	// Verify file exists
	projectDir := filepath.Join(sessDir, EncodeProjectName(projectPath))
	entries, err := os.ReadDir(projectDir)
	if err != nil {
		t.Fatalf("project dir not created: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 file, got %d", len(entries))
	}

	// Verify content starts with session header
	data, err := os.ReadFile(filepath.Join(projectDir, entries[0].Name()))
	if err != nil {
		t.Fatalf("read file failed: %v", err)
	}
	if !strings.Contains(string(data), `"type":"session"`) {
		t.Fatalf("missing session header: %s", string(data))
	}
	if !strings.Contains(string(data), `"cwd":"`+projectPath+`"`) {
		t.Fatalf("missing cwd: %s", string(data))
	}
}

func TestCreateSessionFileAcceptsLegitimateDoubleDotInName(t *testing.T) {
	tmp := t.TempDir()
	dir := filepath.Join(tmp, "..hidden-project")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	id, err := CreateSessionFile(tmp, dir)
	if err != nil {
		t.Fatalf("expected legitimate ..hidden path to be accepted, got %v", err)
	}
	if id == "" {
		t.Fatal("expected non-empty session id")
	}
}

func TestCreateSessionFileRejectsRelativePath(t *testing.T) {
	tmp := t.TempDir()
	if _, err := CreateSessionFile(tmp, "relative/foo"); err == nil {
		t.Fatal("expected error for relative path, got nil")
	}
}

func TestParseSummaryUsesHeaderName(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"session","name":"My Project","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:01Z","message":{"role":"user","content":"hello"}}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "My Project" {
		t.Errorf("Name = %q, want %q", s.Name, "My Project")
	}
	if s.MessageCount != 1 {
		t.Errorf("MessageCount = %d, want 1", s.MessageCount)
	}
}

func TestParseSummaryUsesSessionInfoName(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:01Z","message":{"role":"user","content":"first user line"}}` + "\n" +
		`{"type":"session_info","timestamp":"2026-05-08T10:00:02Z","name":"Renamed Session"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "Renamed Session" {
		t.Errorf("Name = %q, want %q", s.Name, "Renamed Session")
	}
}

func TestParseSummarySessionInfoOverridesHeaderName(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"session","name":"Header Name","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"session_info","timestamp":"2026-05-08T10:00:01Z","name":"Session Info Name"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "Session Info Name" {
		t.Errorf("Name = %q, want %q", s.Name, "Session Info Name")
	}
}

func TestParseSummarySessionInfoLatestWins(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"session_info","timestamp":"2026-05-08T10:00:01Z","name":"First Rename"}` + "\n" +
		`{"type":"session_info","timestamp":"2026-05-08T10:00:02Z","name":"Second Rename"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "Second Rename" {
		t.Errorf("Name = %q, want %q", s.Name, "Second Rename")
	}
}

func TestParseSummaryFallsBackToFirstUserMessage(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:01Z","message":{"role":"user","content":"first user line"}}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:02Z","message":{"role":"user","content":"second user line"}}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "first user line" {
		t.Errorf("Name = %q, want %q", s.Name, "first user line")
	}
}

func TestParseSummaryTruncatesNameAt80(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	long := strings.Repeat("x", 120)
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:01Z","message":{"role":"user","content":"` + long + `"}}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	want := strings.Repeat("x", 80) + "…"
	if s.Name != want {
		t.Errorf("Name = %q, want %q", s.Name, want)
	}
}

func TestParseSummaryFallsBackToFilename(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "fallback.jsonl")
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "fallback.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "fallback.jsonl" {
		t.Errorf("Name = %q, want %q", s.Name, "fallback.jsonl")
	}
}

func TestParseSummaryExtractsSessionUUID(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"session","id":"019e122d-bcc4-7308-8a30-7ef83dae1983","timestamp":"2026-05-08T10:00:00Z"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.SessionUUID != "019e122d-bcc4-7308-8a30-7ef83dae1983" {
		t.Errorf("SessionUUID = %q, want %q", s.SessionUUID, "019e122d-bcc4-7308-8a30-7ef83dae1983")
	}
}

func TestParseSummaryAccumulatesUsage(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:01Z","message":{"role":"assistant","content":"x","usage":{"totalTokens":100,"cost":{"total":0.01}}}}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:02Z","message":{"role":"assistant","content":"y","usage":{"totalTokens":50,"cost":{"total":0.005}}}}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.TokenTotal != 150 {
		t.Errorf("TokenTotal = %d, want 150", s.TokenTotal)
	}
	if s.CostTotal < 0.0149 || s.CostTotal > 0.0151 {
		t.Errorf("CostTotal = %v, want ~0.015", s.CostTotal)
	}
	if s.MessageCount != 2 {
		t.Errorf("MessageCount = %d, want 2", s.MessageCount)
	}
}

func TestParseFileMarksSessionBrokenWhenCwdMissing(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "session.jsonl")
	content := `{"type":"session","version":3,"id":"sid","timestamp":"2026-05-06T00:00:00.000Z","cwd":"/definitely/missing/path"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	sess, err := ParseFile(path, "--tmp-project--", "session.jsonl")
	if err != nil {
		t.Fatalf("ParseFile failed: %v", err)
	}
	if sess.ChatAvailable {
		t.Fatal("expected chat to be disabled for missing cwd")
	}
	if !strings.Contains(sess.ChatDisabledReason, "working directory no longer exists") {
		t.Fatalf("reason = %q", sess.ChatDisabledReason)
	}
}

func TestParseFileLeavesChatEnabledWhenCwdExists(t *testing.T) {
	root := t.TempDir()
	cwd := filepath.Join(root, "project")
	if err := os.MkdirAll(cwd, 0755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, "session.jsonl")
	content := `{"type":"session","version":3,"id":"sid","timestamp":"2026-05-06T00:00:00.000Z","cwd":"` + cwd + `"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	sess, err := ParseFile(path, "--tmp-project--", "session.jsonl")
	if err != nil {
		t.Fatalf("ParseFile failed: %v", err)
	}
	if !sess.ChatAvailable {
		t.Fatalf("expected chat to be enabled, reason = %q", sess.ChatDisabledReason)
	}
}
