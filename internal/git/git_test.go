package git

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func initTestRepo(t *testing.T) string {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	dir := t.TempDir()
	mustGit := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v (%s)", args, err, out)
		}
	}
	mustGit("init")
	mustGit("config", "user.email", "test@example.com")
	mustGit("config", "user.name", "Test")
	mustGit("commit", "--allow-empty", "-m", "init")
	mustGit("branch", "-M", "main")
	return dir
}

func TestDescribeDefaultBranch(t *testing.T) {
	dir := initTestRepo(t)

	info, err := Describe(dir)
	if err != nil {
		t.Fatalf("Describe: %v", err)
	}
	if !info.IsRepo || info.Branch != "main" {
		t.Fatalf("got %+v, want repo on main", info)
	}
	if !info.IsDefault {
		t.Fatalf("main should be reported as the default branch")
	}

	// The default branch must not be renamable, even via the API directly.
	if _, err := RenameBranch(dir, "renamed-main"); err != ErrDefaultBranch {
		t.Fatalf("renaming default branch: got %v, want ErrDefaultBranch", err)
	}
	if info, _ := Describe(dir); info.Branch != "main" {
		t.Fatalf("default branch was renamed to %q despite guard", info.Branch)
	}

	// Create and switch to a feature branch so the rename below is allowed.
	cmd := exec.Command("git", "checkout", "-b", "feature/tmp")
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("checkout feature branch: %v (%s)", err, out)
	}

	if _, err := RenameBranch(dir, "feature/x"); err != nil {
		t.Fatalf("RenameBranch: %v", err)
	}
	info, _ = Describe(dir)
	if info.Branch != "feature/x" {
		t.Fatalf("got branch %q, want feature/x", info.Branch)
	}
	if info.IsDefault {
		t.Fatalf("feature/x should not be the default branch")
	}
}

func TestDescribeNonRepo(t *testing.T) {
	info, err := Describe(filepath.Join(t.TempDir(), "nope"))
	if err != nil {
		t.Fatalf("Describe non-repo returned error: %v", err)
	}
	if info.IsRepo {
		t.Fatalf("expected IsRepo false for non-repo dir")
	}
}

func TestWorkingTreeDiff(t *testing.T) {
	dir := initTestRepo(t)
	mustGit := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v (%s)", args, err, out)
		}
	}
	write := func(name, content string) {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}

	// Clean tree: empty diff.
	if out, err := WorkingTreeDiff(dir); err != nil || out != "" {
		t.Fatalf("clean tree: got %q, %v; want empty", out, err)
	}

	// Tracked modification.
	write("tracked.txt", "line1\nline2\n")
	mustGit("add", "tracked.txt")
	mustGit("commit", "-m", "add tracked")
	write("tracked.txt", "line1\nCHANGED\n")
	// Untracked new file.
	write("untracked.txt", "brand new\n")

	out, err := WorkingTreeDiff(dir)
	if err != nil {
		t.Fatalf("WorkingTreeDiff: %v", err)
	}
	for _, want := range []string{
		"b/tracked.txt", "-line2", "+CHANGED",
		"b/untracked.txt", "new file mode", "+brand new",
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("diff missing %q:\n%s", want, out)
		}
	}
}

func TestWorkingTreeDiffNonRepo(t *testing.T) {
	if _, err := WorkingTreeDiff(filepath.Join(t.TempDir(), "nope")); err != ErrNotRepo {
		t.Fatalf("got %v, want ErrNotRepo", err)
	}
}

func TestWorkingTreeDiffBinaryUntracked(t *testing.T) {
	dir := initTestRepo(t)
	if err := os.WriteFile(filepath.Join(dir, "blob.bin"), []byte{0x00, 0x01, 0x02, 0x00}, 0644); err != nil {
		t.Fatal(err)
	}
	out, err := WorkingTreeDiff(dir)
	if err != nil {
		t.Fatalf("WorkingTreeDiff: %v", err)
	}
	if !strings.Contains(out, "b/blob.bin") || !strings.Contains(out, "Binary files") {
		t.Fatalf("expected a binary marker for blob.bin:\n%s", out)
	}
}

// Many untracked files must stay bounded and fast (the previous implementation
// spawned one `git` process per untracked file and stalled on large trees).
func TestWorkingTreeDiffBoundedOnManyUntracked(t *testing.T) {
	dir := initTestRepo(t)
	big := strings.Repeat("a line of content that is reasonably long\n", 400) // ~17 KiB each
	for i := 0; i < 1000; i++ {
		if err := os.WriteFile(filepath.Join(dir, fmt.Sprintf("u%04d.txt", i)), []byte(big), 0644); err != nil {
			t.Fatal(err)
		}
	}
	start := time.Now()
	out, err := WorkingTreeDiff(dir)
	if err != nil {
		t.Fatalf("WorkingTreeDiff: %v", err)
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("WorkingTreeDiff took %v on 1000 untracked files; expected it to be fast", elapsed)
	}
	if len(out) > maxDiffBytes+(64<<10) {
		t.Fatalf("output %d bytes exceeds the cap %d", len(out), maxDiffBytes)
	}
}

func TestValidBranchName(t *testing.T) {
	valid := []string{
		"main",
		"feature/pr-button",
		"fix_123",
		"release-2.1.0",
		"a",
	}
	for _, name := range valid {
		if !ValidBranchName(name) {
			t.Errorf("expected %q to be valid", name)
		}
	}

	invalid := []string{
		"",
		"-leading-dash",
		"/leading-slash",
		"trailing-slash/",
		"has space",
		"double..dot",
		"double//slash",
		"semicolon;rm",
		"tilde~name",
		"caret^name",
		"colon:name",
		"quote\"name",
	}
	for _, name := range invalid {
		if ValidBranchName(name) {
			t.Errorf("expected %q to be invalid", name)
		}
	}
}

func TestGithubSlug(t *testing.T) {
	cases := []struct {
		remote string
		want   string
		ok     bool
	}{
		{"git@github.com:owner/repo.git", "owner/repo", true},
		{"git@github.com:owner/repo", "owner/repo", true},
		{"https://github.com/owner/repo.git", "owner/repo", true},
		{"https://github.com/owner/repo", "owner/repo", true},
		{"ssh://git@github.com/owner/repo.git", "owner/repo", true},
		{"git@gitlab.com:owner/repo.git", "", false},
		{"https://example.com/owner/repo.git", "", false},
		{"", "", false},
	}
	for _, c := range cases {
		got, ok := githubSlug(c.remote)
		if ok != c.ok || got != c.want {
			t.Errorf("githubSlug(%q) = (%q, %v), want (%q, %v)", c.remote, got, ok, c.want, c.ok)
		}
	}
}
