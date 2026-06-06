package sessions

import (
	"encoding/json"
	"errors"
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
		{"/Users/setkyar", "--Users_-setkyar--"},
		{"/home/user/project", "--home_-user_-project--"},
		{"/a/b/c/d", "--a_-b_-c_-d--"},
		{"/Users/setkyar/pi-web", "--Users_-setkyar_-pi-web--"},
		{"/Users/setkyar/my-project", "--Users_-setkyar_-my-project--"},
		{"/Users/setkyar/_cache", "--Users_-setkyar_-__cache--"},
		{"/a/_b/_c", "--a_-__b_-__c--"},
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
		// New format
		{"--Users_-setkyar--", "/Users/setkyar"},
		{"--home_-user_-project--", "/home/user/project"},
		{"--a_-b_-c_-d--", "/a/b/c/d"},
		{"--Users_-setkyar_-my-project--", "/Users/setkyar/my-project"},
		{"--Users_-setkyar_-__cache--", "/Users/setkyar/_cache"},
		// Legacy format (no _ in body) — backward compatible.
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
		"/Users/setkyar/my-project",
		"/Users/setkyar/_cache",
		"/a/_b/_c",
		"/project-with-hyphens/sub_dir",
		"/underscore_test/path",
	}
	for _, p := range paths {
		encoded := EncodeProjectName(p)
		decoded := DecodeProjectName(encoded)
		if decoded != p {
			t.Errorf("round-trip failed: %q -> %q -> %q", p, encoded, decoded)
		}
	}
}

func TestSortSummariesByActivityOrdersNewestFirst(t *testing.T) {
	summaries := []SessionSummary{
		{ID: "old", LastActivity: "2026-02-27T15:13:25.383Z"},
		{ID: "older", LastActivity: "2026-02-27T15:16:22.278Z"},
		{ID: "newest", LastActivity: "2026-05-18T19:05:05.064Z"},
		{ID: "middle", LastActivity: "2026-05-06T17:10:28.485Z"},
		{ID: "newer", LastActivity: "2026-05-18T18:59:50.965Z"},
	}

	SortSummariesByActivity(summaries)

	got := make([]string, len(summaries))
	for i := range summaries {
		got[i] = summaries[i].ID
	}
	want := []string{"newest", "newer", "middle", "older", "old"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("sorted IDs = %v, want %v", got, want)
	}
}

func TestSortSummariesByActivityKeepsInvalidTimestampsLast(t *testing.T) {
	summaries := []SessionSummary{
		{ID: "invalid", LastActivity: "not-a-time"},
		{ID: "newest", LastActivity: "2026-05-18T19:05:05.064Z"},
		{ID: "empty", LastActivity: ""},
		{ID: "older", LastActivity: "2026-02-27T15:16:22.278Z"},
	}

	SortSummariesByActivity(summaries)

	got := make([]string, len(summaries))
	for i := range summaries {
		got[i] = summaries[i].ID
	}
	want := []string{"newest", "older", "invalid", "empty"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("sorted IDs = %v, want %v", got, want)
	}
}

func TestSortSummariesByProjectActivityGroupsProjects(t *testing.T) {
	summaries := []SessionSummary{
		{ID: "web-new", Project: "/pi/web", LastActivity: "2026-05-18T10:00:00Z"},
		{ID: "web-mid", Project: "/pi/web", LastActivity: "2026-05-18T09:50:00Z"},
		{ID: "milk", Project: "/milktea", LastActivity: "2026-05-18T09:40:00Z"},
		{ID: "web-old", Project: "/pi/web", LastActivity: "2026-05-18T09:30:00Z"},
	}

	SortSummariesByProjectActivity(summaries)

	got := make([]string, len(summaries))
	for i := range summaries {
		got[i] = summaries[i].ID
	}
	want := []string{"web-new", "web-mid", "web-old", "milk"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("sorted IDs = %v, want %v", got, want)
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

func TestListRecentLocationsRecoversLegacyHyphenatedPaths(t *testing.T) {
	tmp := t.TempDir()

	// Simulate a legacy-encoded directory for a path that contains
	// literal hyphens: /tmp/my-project  →  --tmp-my-project--
	legacyDir := filepath.Join(tmp, "--tmp-my-project--")
	if err := os.MkdirAll(legacyDir, 0755); err != nil {
		t.Fatal(err)
	}
	// Write a session file with the real cwd in the header.
	sessionPath := filepath.Join(legacyDir, "2026-05-08T10-00-00.000Z_abc.jsonl")
	content := `{"type":"session","version":3,"id":"abc","timestamp":"2026-05-08T10:00:00Z","cwd":"/tmp/my-project"}` + "\n"
	if err := os.WriteFile(sessionPath, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	locations, err := ListRecentLocations(tmp)
	if err != nil {
		t.Fatal(err)
	}
	if len(locations) == 0 {
		t.Fatal("expected at least 1 location")
	}
	if locations[0] != "/tmp/my-project" {
		t.Fatalf("expected recovered path /tmp/my-project, got %q", locations[0])
	}
}

func TestResolveLocationReturnsDecodedPathWhenOnDisk(t *testing.T) {
	tmp := t.TempDir()

	// Create a real project directory so os.Stat succeeds.
	realPath := filepath.Join(tmp, "my-project")
	if err := os.MkdirAll(realPath, 0755); err != nil {
		t.Fatal(err)
	}

	// Create the new-format encoded directory under a sessions root.
	sessionsDir := filepath.Join(tmp, "sessions")
	encodedDir := filepath.Join(sessionsDir, EncodeProjectName(realPath))
	if err := os.MkdirAll(encodedDir, 0755); err != nil {
		t.Fatal(err)
	}

	locations, err := ListRecentLocations(sessionsDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(locations) == 0 {
		t.Fatal("expected at least 1 location")
	}
	if locations[0] != realPath {
		t.Fatalf("expected %q, got %q", realPath, locations[0])
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

func TestRenameSessionAppendsSessionInfo(t *testing.T) {
	path := filepath.Join(t.TempDir(), "s.jsonl")
	content := `{"type":"session","name":"Old Name","timestamp":"2026-05-08T10:00:00Z"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	now := func() time.Time { return time.Date(2026, 5, 8, 10, 1, 2, 0, time.UTC) }
	if err := RenameSession(path, " New Name ", now); err != nil {
		t.Fatalf("RenameSession failed: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	wantLine := `{"type":"session_info","timestamp":"2026-05-08T10:01:02Z","name":"New Name"}`
	if !strings.Contains(got, wantLine+"\n") {
		t.Fatalf("appended content = %q, want line %q", got, wantLine)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "New Name" {
		t.Fatalf("Name = %q, want New Name", s.Name)
	}
}

func TestLabelSessionEntryAppendsLabelAndClearEntries(t *testing.T) {
	path := filepath.Join(t.TempDir(), "s.jsonl")
	content := `{"type":"session","version":3,"id":"sid","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"message","id":"target1","parentId":null,"timestamp":"2026-05-08T10:00:01Z","message":{"role":"user","content":"hello"}}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	now := func() time.Time { return time.Date(2026, 5, 8, 10, 1, 2, 0, time.UTC) }
	if err := LabelSessionEntry(path, "target1", " Important ", now); err != nil {
		t.Fatalf("LabelSessionEntry set failed: %v", err)
	}
	if err := LabelSessionEntry(path, "target1", "  ", now); err != nil {
		t.Fatalf("LabelSessionEntry clear failed: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 4 {
		t.Fatalf("line count = %d, want 4: %q", len(lines), string(data))
	}
	var setEntry, clearEntry map[string]any
	if err := json.Unmarshal([]byte(lines[2]), &setEntry); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(lines[3]), &clearEntry); err != nil {
		t.Fatal(err)
	}
	if setEntry["type"] != "label" || setEntry["targetId"] != "target1" || setEntry["label"] != "Important" {
		t.Fatalf("set entry = %#v", setEntry)
	}
	if clearEntry["type"] != "label" || clearEntry["targetId"] != "target1" {
		t.Fatalf("clear entry = %#v", clearEntry)
	}
	if _, ok := clearEntry["label"]; ok {
		t.Fatalf("clear entry should omit label: %#v", clearEntry)
	}
}

func TestLabelSessionEntryRejectsMissingTarget(t *testing.T) {
	path := filepath.Join(t.TempDir(), "s.jsonl")
	if err := os.WriteFile(path, []byte(`{"type":"session"}`+"\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := LabelSessionEntry(path, "missing", "label", nil); !errors.Is(err, ErrSessionEntryNotFound) {
		t.Fatalf("err = %v, want ErrSessionEntryNotFound", err)
	}
}

func TestRenameSessionRejectsEmptyName(t *testing.T) {
	path := filepath.Join(t.TempDir(), "s.jsonl")
	if err := os.WriteFile(path, []byte(`{"type":"session"}`+"\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := RenameSession(path, "   ", nil); err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestParseSummaryHandlesLargeToolResultLine(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")

	// A single tool-result message line larger than the old 4MB scanner cap.
	// Before the buffer bump, scanner.Err() returns bufio.ErrTooLong and the
	// whole session is dropped from the index.
	big := strings.Repeat("a", 8*1024*1024)
	content := `{"type":"session","name":"Big Session","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:01Z","message":{"role":"user","content":"hello"}}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:02Z","message":{"role":"assistant","content":"` + big + `"}}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatalf("ParseSummary returned error on large line: %v", err)
	}
	if s.Name != "Big Session" {
		t.Errorf("Name = %q, want %q", s.Name, "Big Session")
	}
	if s.MessageCount != 2 {
		t.Errorf("MessageCount = %d, want 2", s.MessageCount)
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

func TestParseSummaryTruncatesUnicodeNameAt80Runes(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	// Each "🎉" is a 4-byte UTF-8 sequence; 90 of them = 360 bytes but only 90 runes.
	long := strings.Repeat("🎉", 90)
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z"}` + "\n" +
		`{"type":"message","timestamp":"2026-05-08T10:00:01Z","message":{"role":"user","content":"` + long + `"}}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	want := strings.Repeat("🎉", 80) + "…"
	if s.Name != want {
		t.Errorf("Name length = %d runes, want 81+ellipsis; got %q", len([]rune(s.Name)), s.Name)
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

func TestParseSummaryTracksLatestModelInfo(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"message","timestamp":"2026-05-08T10:00:01Z","message":{"role":"assistant","provider":"anthropic","model":"claude-4","content":"x"}}` + "\n" +
		`{"type":"model_change","timestamp":"2026-05-08T10:00:02Z","provider":"deepseek","modelId":"deepseek-v4-pro"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.ModelProvider != "deepseek" || s.Model != "deepseek-v4-pro" {
		t.Fatalf("model = %q/%q, want deepseek/deepseek-v4-pro", s.ModelProvider, s.Model)
	}
}

func TestParseFileTracksLatestModelInfo(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"message","timestamp":"2026-05-08T10:00:01Z","message":{"role":"assistant","provider":"anthropic","model":"claude-4","content":"x"}}` + "\n" +
		`{"type":"model_change","timestamp":"2026-05-08T10:00:02Z","provider":"deepseek","modelId":"deepseek-v4-pro"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseFile(path, "--proj--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.ModelProvider != "deepseek" || s.Model != "deepseek-v4-pro" {
		t.Fatalf("model = %q/%q, want deepseek/deepseek-v4-pro", s.ModelProvider, s.Model)
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

func TestParseSummaryUsesHeaderCwdAsProject(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z","cwd":"/Users/setkyar/pi-web"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	s, err := ParseSummary(path, "--Users-setkyar-pi-web--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.Project != "/Users/setkyar/pi-web" {
		t.Errorf("Project = %q, want %q", s.Project, "/Users/setkyar/pi-web")
	}
}

func TestParseSummaryFallsBackToDirNameWhenCwdMissing(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "s.jsonl")
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	// dir name as produced by EncodeProjectName for /Users/setkyar/pi/web.
	s, err := ParseSummary(path, "--Users_-setkyar_-pi_-web--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if s.Project != "Users/setkyar/pi/web" {
		t.Errorf("Project = %q, want %q", s.Project, "Users/setkyar/pi/web")
	}
}

func TestParseFileUsesHeaderCwdAsProject(t *testing.T) {
	root := t.TempDir()
	cwd := filepath.Join(root, "project")
	if err := os.MkdirAll(cwd, 0755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, "s.jsonl")
	content := `{"type":"session","timestamp":"2026-05-08T10:00:00Z","cwd":"` + cwd + `"}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	sess, err := ParseFile(path, "--tmp-project--", "s.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if sess.Project != cwd {
		t.Errorf("Project = %q, want %q", sess.Project, cwd)
	}
}

func TestParseFileDeduplicatesRepeatedSessionHeader(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "session.jsonl")
	header := `{"type":"session","id":"sid","timestamp":"2026-05-08T10:00:00Z","cwd":"` + root + `"}`
	content := header + "\n" +
		header + "\n" +
		`{"type":"message","id":"u1","parentId":"sid","timestamp":"2026-05-08T10:00:01Z","message":{"role":"user","content":"hello"}}` + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	sess, err := ParseFile(path, "--tmp-project--", "session.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if len(sess.Entries) != 2 {
		t.Fatalf("entries = %d, want 2 (%#v)", len(sess.Entries), sess.Entries)
	}
	if sess.Entries[0]["type"] != "session" || sess.Entries[1]["type"] != "message" {
		t.Fatalf("unexpected entries: %#v", sess.Entries)
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

func TestForkSessionFile(t *testing.T) {
	tmpDir := t.TempDir()
	sessDir := filepath.Join(tmpDir, "sessions")
	projectPath := filepath.Join(tmpDir, "test-project")

	// Create source session
	id, err := CreateSessionFile(sessDir, projectPath)
	if err != nil {
		t.Fatalf("CreateSessionFile failed: %v", err)
	}

	projectDir := filepath.Join(sessDir, EncodeProjectName(projectPath))
	sourcePath := filepath.Join(projectDir, id)

	// Append some tree entries
	entries := []string{
		`{"type":"message","id":"a1b2c3d4","parentId":null,"timestamp":"2026-05-08T10:00:00Z","message":{"role":"user","content":"Hello"}}` + "\n",
		`{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2026-05-08T10:01:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}]}}` + "\n",
		`{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2026-05-08T10:02:00Z","message":{"role":"user","content":"How are you?"}}` + "\n",
		`{"type":"message","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2026-05-08T10:03:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Good!"}]}}` + "\n",
	}
	f, err := os.OpenFile(sourcePath, os.O_WRONLY|os.O_APPEND, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if _, err := f.WriteString(e); err != nil {
			t.Fatal(err)
		}
	}
	f.Close()

	now := func() time.Time { return time.Date(2026, 5, 8, 11, 0, 0, 0, time.UTC) }

	// Fork from the second user message (c3d4e5f6)
	newID, err := ForkSessionFile(sessDir, sourcePath, "c3d4e5f6", now)
	if err != nil {
		t.Fatalf("ForkSessionFile failed: %v", err)
	}
	if !strings.HasSuffix(newID, ".jsonl") {
		t.Fatalf("expected .jsonl suffix, got %q", newID)
	}

	newPath := filepath.Join(projectDir, newID)
	data, err := os.ReadFile(newPath)
	if err != nil {
		t.Fatalf("read forked file failed: %v", err)
	}
	content := string(data)

	if !strings.Contains(content, `"type":"session"`) {
		t.Fatalf("missing session header")
	}
	if !strings.Contains(content, `"parentSession"`) {
		t.Fatalf("missing parentSession")
	}
	if !strings.Contains(content, `"forkedFrom"`) {
		t.Fatalf("missing forkedFrom")
	}
	if !strings.Contains(content, `"id":"a1b2c3d4"`) {
		t.Fatalf("missing first user message")
	}
	if !strings.Contains(content, `"id":"b2c3d4e5"`) {
		t.Fatalf("missing assistant message")
	}
	if !strings.Contains(content, `"id":"c3d4e5f6"`) {
		t.Fatalf("missing fork point message")
	}
	if strings.Contains(content, `"id":"d4e5f6g7"`) {
		t.Fatalf("should not contain message after fork point")
	}
}

func TestCloneSessionFile(t *testing.T) {
	tmpDir := t.TempDir()
	sessDir := filepath.Join(tmpDir, "sessions")
	projectPath := filepath.Join(tmpDir, "test-project")

	id, err := CreateSessionFile(sessDir, projectPath)
	if err != nil {
		t.Fatalf("CreateSessionFile failed: %v", err)
	}

	projectDir := filepath.Join(sessDir, EncodeProjectName(projectPath))
	sourcePath := filepath.Join(projectDir, id)

	entries := []string{
		`{"type":"message","id":"a1b2c3d4","parentId":null,"timestamp":"2026-05-08T10:00:00Z","message":{"role":"user","content":"Hello"}}` + "\n",
		`{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2026-05-08T10:01:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}]}}` + "\n",
		`{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2026-05-08T10:02:00Z","message":{"role":"user","content":"How are you?"}}` + "\n",
	}
	f, err := os.OpenFile(sourcePath, os.O_WRONLY|os.O_APPEND, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if _, err := f.WriteString(e); err != nil {
			t.Fatal(err)
		}
	}
	f.Close()

	now := func() time.Time { return time.Date(2026, 5, 8, 11, 0, 0, 0, time.UTC) }

	newID, err := CloneSessionFile(sessDir, sourcePath, "c3d4e5f6", now)
	if err != nil {
		t.Fatalf("CloneSessionFile failed: %v", err)
	}
	if !strings.HasSuffix(newID, ".jsonl") {
		t.Fatalf("expected .jsonl suffix, got %q", newID)
	}

	newPath := filepath.Join(projectDir, newID)
	data, err := os.ReadFile(newPath)
	if err != nil {
		t.Fatalf("read cloned file failed: %v", err)
	}
	content := string(data)

	if !strings.Contains(content, `"type":"session"`) {
		t.Fatalf("missing session header")
	}
	if !strings.Contains(content, `"parentSession"`) {
		t.Fatalf("missing parentSession")
	}
	if strings.Contains(content, `"forkedFrom"`) {
		t.Fatalf("clone should not have forkedFrom")
	}
	if !strings.Contains(content, `"id":"a1b2c3d4"`) {
		t.Fatalf("missing first user message")
	}
	if !strings.Contains(content, `"id":"b2c3d4e5"`) {
		t.Fatalf("missing assistant message")
	}
	if !strings.Contains(content, `"id":"c3d4e5f6"`) {
		t.Fatalf("missing leaf message")
	}
}

func TestForkSessionFileEntryNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	sessDir := filepath.Join(tmpDir, "sessions")
	projectPath := filepath.Join(tmpDir, "test-project")

	id, err := CreateSessionFile(sessDir, projectPath)
	if err != nil {
		t.Fatalf("CreateSessionFile failed: %v", err)
	}

	projectDir := filepath.Join(sessDir, EncodeProjectName(projectPath))
	sourcePath := filepath.Join(projectDir, id)

	now := func() time.Time { return time.Date(2026, 5, 8, 11, 0, 0, 0, time.UTC) }

	_, err = ForkSessionFile(sessDir, sourcePath, "nonexistent", now)
	if err == nil {
		t.Fatal("expected error for nonexistent entry")
	}
}
