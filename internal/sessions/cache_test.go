package sessions

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSessionCacheReusesParsedSessions(t *testing.T) {

	root := t.TempDir()
	writeSessionFile(t, root, "--tmp--project--", "session.jsonl")

	c := NewCache()

	first, err := c.LoadAll(root)
	if err != nil {
		t.Fatalf("first loadAll: %v", err)
	}
	if len(first) != 1 {
		t.Fatalf("first: got %d sessions, want 1", len(first))
	}
	if c.parses != 1 || c.hits != 0 {
		t.Fatalf("after first call: parses=%d hits=%d, want 1/0", c.parses, c.hits)
	}

	c.Invalidate()
	second, err := c.LoadAll(root)
	if err != nil {
		t.Fatalf("second loadAll: %v", err)
	}
	if len(second) != 1 {
		t.Fatalf("second: got %d sessions, want 1", len(second))
	}
	if c.parses != 1 {
		t.Fatalf("expected no additional parses on cached read, got parses=%d", c.parses)
	}
	if c.hits != 1 {
		t.Fatalf("expected 1 cache hit, got %d", c.hits)
	}
}

func TestSessionCacheReparsesOnModTimeChange(t *testing.T) {

	root := t.TempDir()
	path := writeSessionFile(t, root, "--tmp--project--", "session.jsonl")

	c := NewCache()
	if _, err := c.LoadAll(root); err != nil {
		t.Fatalf("first loadAll: %v", err)
	}

	// Bump modtime forward.
	future := time.Now().Add(2 * time.Second)
	if err := os.Chtimes(path, future, future); err != nil {
		t.Fatalf("chtimes: %v", err)
	}

	c.Invalidate()
	if _, err := c.LoadAll(root); err != nil {
		t.Fatalf("second loadAll: %v", err)
	}
	if c.parses != 2 {
		t.Fatalf("expected re-parse after modtime bump, got parses=%d", c.parses)
	}
	if c.hits != 0 {
		t.Fatalf("expected 0 hits when modtime changed, got %d", c.hits)
	}
}

func TestSessionCacheEvictsRemovedFiles(t *testing.T) {

	root := t.TempDir()
	path := writeSessionFile(t, root, "--tmp--project--", "session.jsonl")

	c := NewCache()
	if _, err := c.LoadAll(root); err != nil {
		t.Fatalf("first loadAll: %v", err)
	}
	if len(c.entries) != 1 {
		t.Fatalf("after first: cache size = %d, want 1", len(c.entries))
	}

	if err := os.Remove(path); err != nil {
		t.Fatalf("remove: %v", err)
	}

	c.Invalidate()
	got, err := c.LoadAll(root)
	if err != nil {
		t.Fatalf("after remove: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected 0 sessions after deletion, got %d", len(got))
	}
	if len(c.entries) != 0 {
		t.Fatalf("expected cache to evict deleted file, size=%d", len(c.entries))
	}
}

func TestSessionCachePicksUpNewFiles(t *testing.T) {

	root := t.TempDir()
	writeSessionFile(t, root, "--tmp--project--", "first.jsonl")

	c := NewCache()
	if _, err := c.LoadAll(root); err != nil {
		t.Fatalf("first loadAll: %v", err)
	}

	writeSessionFile(t, root, "--tmp--project--", "second.jsonl")

	c.Invalidate()
	got, err := c.LoadAll(root)
	if err != nil {
		t.Fatalf("second loadAll: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(got))
	}
	if c.parses != 2 {
		t.Fatalf("expected exactly one re-parse (for new file), got parses=%d", c.parses)
	}
	if c.hits != 1 {
		t.Fatalf("expected 1 hit (the unchanged first file), got %d", c.hits)
	}
}

func TestSessionCacheIgnoresNonJsonl(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "--tmp--project--")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}

	c := NewCache()
	got, err := c.LoadAll(root)
	if err != nil {
		t.Fatalf("loadAll: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected 0 sessions, got %d", len(got))
	}
}

func TestSessionCacheReturnsCachedProjectForID(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "--tmp--project--", "session.jsonl")

	c := NewCache()
	summaries, err := c.LoadAll(root)
	if err != nil {
		t.Fatalf("loadAll: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("got %d sessions, want 1", len(summaries))
	}

	project, ok := c.ProjectForID("session.jsonl")
	if !ok || project != summaries[0].Project {
		t.Fatalf("project = %q, ok = %v; want %q, true", project, ok, summaries[0].Project)
	}
}
