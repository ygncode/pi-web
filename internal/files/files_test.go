package files

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// seedTree writes a set of files (and the dirs implied by their paths) under a
// fresh temp dir and returns its path. Paths ending in "/" create a dir only.
func seedTree(t *testing.T, paths ...string) string {
	t.Helper()
	root := t.TempDir()
	for _, p := range paths {
		full := filepath.Join(root, filepath.FromSlash(p))
		if strings.HasSuffix(p, "/") {
			if err := os.MkdirAll(full, 0o755); err != nil {
				t.Fatalf("mkdir %s: %v", p, err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatalf("mkdir parent %s: %v", p, err)
		}
		if err := os.WriteFile(full, []byte("x"), 0o644); err != nil {
			t.Fatalf("write %s: %v", p, err)
		}
	}
	return root
}

func paths(entries []Entry) []string {
	out := make([]string, len(entries))
	for i, e := range entries {
		out[i] = e.Path
	}
	return out
}

func contains(list []string, want string) bool {
	for _, s := range list {
		if s == want {
			return true
		}
	}
	return false
}

func TestListReturnsErrForNonDir(t *testing.T) {
	if _, err := List("", "x", 0); err != ErrNotDir {
		t.Fatalf("empty cwd: want ErrNotDir, got %v", err)
	}
	f := filepath.Join(t.TempDir(), "afile")
	if err := os.WriteFile(f, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := List(f, "x", 0); err != ErrNotDir {
		t.Fatalf("file cwd: want ErrNotDir, got %v", err)
	}
}

func TestListRanksExactPrefixContains(t *testing.T) {
	root := seedTree(t,
		"app/",     // basename exactly "app" -> exact(100) + dir(10)
		"app.js",   // basename prefix "app" -> 80
		"myapp.js", // basename contains "app" -> 50
		"unrelated.txt",
	)
	got := paths(MustList(t, root, "app"))
	if len(got) < 3 {
		t.Fatalf("expected at least 3 matches, got %v", got)
	}
	// Exact basename match should rank first.
	if got[0] != "app" {
		t.Fatalf("want app first, got %v", got)
	}
	if contains(got, "unrelated.txt") {
		t.Fatalf("unrelated.txt should not match query 'app': %v", got)
	}
}

func TestListDirectoryBonus(t *testing.T) {
	root := seedTree(t,
		"build-notes.txt", // file containing "build"
		"buildtools/",     // dir starting with "build" -> prefix + dir bonus
	)
	got := paths(MustList(t, root, "build"))
	if got[0] != "buildtools" {
		t.Fatalf("expected dir buildtools ranked first, got %v", got)
	}
}

func TestListScopedQuery(t *testing.T) {
	root := seedTree(t,
		"src/server.go",
		"src/client.go",
		"pkg/server.go",
	)
	got := paths(MustList(t, root, "src/server"))
	if !contains(got, "src/server.go") {
		t.Fatalf("want src/server.go, got %v", got)
	}
	if contains(got, "pkg/server.go") {
		t.Fatalf("scoped query should not reach pkg/: %v", got)
	}
}

func TestListEmptyQueryListsTopLevel(t *testing.T) {
	root := seedTree(t, "a.txt", "b.txt", "sub/c.txt")
	got := paths(MustList(t, root, ""))
	if !contains(got, "a.txt") || !contains(got, "sub") {
		t.Fatalf("empty query should list entries, got %v", got)
	}
}

func TestListSkipsHeavyDirs(t *testing.T) {
	root := seedTree(t,
		"node_modules/left-pad/index.js",
		".git/config",
		"app.js",
	)
	got := paths(MustList(t, root, ""))
	for _, p := range got {
		if strings.HasPrefix(p, "node_modules") || strings.HasPrefix(p, ".git") {
			t.Fatalf("heavy dir leaked into results: %v", got)
		}
	}
	if !contains(got, "app.js") {
		t.Fatalf("want app.js, got %v", got)
	}
}

func TestRankMaxResults(t *testing.T) {
	var seed []string
	for i := 0; i < 50; i++ {
		seed = append(seed, "match"+string(rune('a'+i%26))+string(rune('0'+i/26))+".txt")
	}
	root := seedTree(t, seed...)
	got, err := List(root, "match", 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 5 {
		t.Fatalf("want 5 results, got %d", len(got))
	}
}

func TestWalkScopedMaxDepth(t *testing.T) {
	root := seedTree(t, "a/b/c/d/deep.txt", "shallow.txt")
	entries, err := WalkScoped(root, "", Options{MaxDepth: 1})
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if strings.Count(e.Path, "/") > 1 {
			t.Fatalf("entry deeper than MaxDepth=1 leaked: %v", paths(entries))
		}
	}
}

func TestWalkScopedMaxEntries(t *testing.T) {
	var seed []string
	for i := 0; i < 30; i++ {
		seed = append(seed, "f"+string(rune('a'+i))+".txt")
	}
	root := seedTree(t, seed...)
	entries, err := WalkScoped(root, "", Options{MaxEntries: 7})
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) > 7 {
		t.Fatalf("MaxEntries=7 not honored, got %d", len(entries))
	}
}

func TestTopLevelIsShallow(t *testing.T) {
	root := seedTree(t, "a.txt", "sub/deep.txt", "node_modules/x/y.js")
	entries, err := TopLevel(root, "")
	if err != nil {
		t.Fatal(err)
	}
	got := paths(entries)
	// Only immediate children: a.txt and the sub/ dir. Never the nested file or
	// a heavy dir.
	if !contains(got, "a.txt") || !contains(got, "sub") {
		t.Fatalf("want a.txt and sub, got %v", got)
	}
	for _, p := range got {
		if strings.Contains(p, "/") || strings.HasPrefix(p, "node_modules") {
			t.Fatalf("TopLevel returned a non-top-level or heavy entry: %v", got)
		}
	}
}

func TestTopLevelScoped(t *testing.T) {
	root := seedTree(t, "src/a.go", "src/inner/b.go", "other/c.go")
	got := paths(mustTopLevel(t, root, "src"))
	if !contains(got, "src/a.go") || !contains(got, "src/inner") {
		t.Fatalf("want src/a.go and src/inner, got %v", got)
	}
	if contains(got, "src/inner/b.go") {
		t.Fatalf("TopLevel should not recurse into src/inner: %v", got)
	}
	if contains(got, "other/c.go") {
		t.Fatalf("scoped TopLevel leaked another dir: %v", got)
	}
}

func TestListShortQueryStaysShallow(t *testing.T) {
	// A single-character term must not trigger a recursive walk: a deeply nested
	// match should be absent, but a matching top-level entry present.
	root := seedTree(t, "app.go", "deep/appendix.go")
	got := paths(mustList(t, root, "a"))
	if !contains(got, "app.go") {
		t.Fatalf("want top-level app.go for short query, got %v", got)
	}
	if contains(got, "deep/appendix.go") {
		t.Fatalf("short query must not recurse: %v", got)
	}
}

func TestListLongQueryGoesDeep(t *testing.T) {
	root := seedTree(t, "deep/nested/appendix.go", "top.txt")
	got := paths(mustList(t, root, "appendix"))
	if !contains(got, "deep/nested/appendix.go") {
		t.Fatalf("long query should recurse to find nested match, got %v", got)
	}
}

func TestListResultsStayWithinCwd(t *testing.T) {
	root := seedTree(t, "inside.txt")
	got := paths(MustList(t, root, ""))
	for _, p := range got {
		if strings.HasPrefix(p, "..") || filepath.IsAbs(p) {
			t.Fatalf("path escaped cwd: %q", p)
		}
	}
}

func TestListDoesNotFollowSymlinks(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink semantics differ on windows")
	}
	outside := seedTree(t, "secret.txt")
	root := seedTree(t, "real.txt")
	if err := os.Symlink(outside, filepath.Join(root, "link")); err != nil {
		t.Skipf("symlink unsupported: %v", err)
	}
	got := paths(MustList(t, root, "secret"))
	if contains(got, "link/secret.txt") {
		t.Fatalf("walk followed symlink out of cwd: %v", got)
	}
}

func TestScoreEntry(t *testing.T) {
	cases := []struct {
		rel, term string
		isDir     bool
		want      int
	}{
		{"readme.md", "readme.md", false, 100}, // exact basename
		{"readme.md", "readme", false, 80},     // basename prefix
		{"readme-test.md", "readme", false, 80},
		{"my-readme.txt", "readme", false, 50},       // basename contains
		{"docs/x/readme-v2.md", "readme", false, 80}, // basename prefix
		{"docs/notes.md", "docs", false, 30},         // path contains, not basename
		{"src", "src", true, 110},                    // exact dir
		{"anything.go", "zzz", false, 0},
		{"anything.go", "", false, 1},
		{"adir", "", true, 11},
	}
	for _, c := range cases {
		if got := scoreEntry(c.rel, c.term, c.isDir); got != c.want {
			t.Errorf("scoreEntry(%q,%q,dir=%v)=%d want %d", c.rel, c.term, c.isDir, got, c.want)
		}
	}
}

func TestSplitQuery(t *testing.T) {
	cases := []struct{ in, scope, term string }{
		{"foo", "", "foo"},
		{"src/foo", "src", "foo"},
		{"a/b/c", "a/b", "c"},
		{"/foo", "", "foo"},
		{"src/", "src", ""},
		{"", "", ""},
	}
	for _, c := range cases {
		scope, term := SplitQuery(c.in)
		if scope != c.scope || term != c.term {
			t.Errorf("SplitQuery(%q)=(%q,%q) want (%q,%q)", c.in, scope, term, c.scope, c.term)
		}
	}
}

// MustList runs List and fails the test on error.
func MustList(t *testing.T, cwd, query string) []Entry {
	t.Helper()
	got, err := List(cwd, query, 0)
	if err != nil {
		t.Fatalf("List(%q,%q): %v", cwd, query, err)
	}
	return got
}

// mustList is the lowercase alias used by newer tests.
func mustList(t *testing.T, cwd, query string) []Entry { return MustList(t, cwd, query) }

// mustTopLevel runs TopLevel and fails the test on error.
func mustTopLevel(t *testing.T, cwd, scope string) []Entry {
	t.Helper()
	got, err := TopLevel(cwd, scope)
	if err != nil {
		t.Fatalf("TopLevel(%q,%q): %v", cwd, scope, err)
	}
	return got
}
