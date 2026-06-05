// Package files provides a bounded, read-only directory listing for the chat
// composer's @mention autocomplete. It lists files and folders under a session's
// working directory and ranks them against a query.
//
// Two listing strategies keep this cheap on small hardware (e.g. Raspberry Pi):
//
//   - TopLevel: a single os.ReadDir of one directory (depth 1). Used for the
//     common "just opened the popup" / short-query case. It is O(children of one
//     dir) — no recursion.
//   - WalkScoped: a bounded recursive walk of a subtree. Used only once the user
//     has typed a real search term (DeepQueryThreshold+ characters), so the
//     expensive cross-tree scan never runs while the user is just browsing.
//
// Both skip heavy build/VCS directories, never follow symlinks (which bounds
// traversal and keeps results inside cwd), and produce cwd-relative slash paths.
// WalkScoped is additionally capped on entries collected, entries scanned, and
// recursion depth. Listing (filesystem) and Rank (pure scoring) are separate so
// a caller can list once, cache it, and re-rank cheaply as the user types.
package files

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Entry is a single file or directory, with a path relative to cwd (slash
// separated, never escaping cwd).
type Entry struct {
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
}

// Options bounds a WalkScoped. Zero values fall back to the defaults below.
type Options struct {
	MaxEntries int // entries collected before the walk stops
	MaxScanned int // directory entries visited before the walk gives up
	MaxDepth   int // recursion depth below the walk root
}

const (
	defaultMaxEntries = 5000
	defaultMaxScanned = 20000
	defaultMaxDepth   = 12

	// DefaultMaxResults is the number of ranked entries Rank returns when the
	// caller passes a non-positive limit.
	DefaultMaxResults = 20

	// DeepQueryThreshold is the trailing-term length at which listing switches
	// from a cheap one-directory TopLevel to a recursive WalkScoped. Below it,
	// the popup only shows immediate children of the (scoped) directory.
	DeepQueryThreshold = 2
)

// ErrNotDir is returned when cwd is empty or does not resolve to a directory.
var ErrNotDir = errors.New("cwd is not a directory")

// skipDirs are never listed or descended into: large, machine-generated, or VCS
// internals that no one wants to @mention and that would blow the scan budget.
var skipDirs = map[string]bool{
	".git":          true,
	"node_modules":  true,
	"vendor":        true,
	"dist":          true,
	"build":         true,
	".next":         true,
	".nuxt":         true,
	"target":        true,
	".venv":         true,
	"venv":          true,
	"__pycache__":   true,
	".mypy_cache":   true,
	".pytest_cache": true,
	".gradle":       true,
	".idea":         true,
	".cache":        true,
	".terraform":    true,
}

var errBudgetExhausted = errors.New("scan budget exhausted")

func (o Options) withDefaults() Options {
	if o.MaxEntries <= 0 {
		o.MaxEntries = defaultMaxEntries
	}
	if o.MaxScanned <= 0 {
		o.MaxScanned = defaultMaxScanned
	}
	if o.MaxDepth <= 0 {
		o.MaxDepth = defaultMaxDepth
	}
	return o
}

// resolveRoot validates cwd is a directory and returns the listing root
// (cwd joined with the optional scope), ensuring the scope cannot escape cwd.
func resolveRoot(cwd, scope string) (string, error) {
	if cwd == "" {
		return "", ErrNotDir
	}
	if info, err := os.Stat(cwd); err != nil || !info.IsDir() {
		return "", ErrNotDir
	}
	if scope == "" {
		return cwd, nil
	}
	root := filepath.Join(cwd, filepath.FromSlash(scope))
	if !withinRoot(cwd, root) {
		return "", ErrNotDir
	}
	return root, nil
}

// relToCwd converts an absolute path under cwd to a cwd-relative slash path,
// returning ok=false if it would escape cwd.
func relToCwd(cwd, path string) (string, bool) {
	rel, err := filepath.Rel(cwd, path)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", false
	}
	return filepath.ToSlash(rel), true
}

// TopLevel lists the immediate children (depth 1) of cwd/scope with paths
// relative to cwd. It is a single os.ReadDir — no recursion — so it stays cheap
// even on large trees. Heavy directories are omitted. A scope that points at a
// missing path or a file yields an empty list rather than an error.
func TopLevel(cwd, scope string) ([]Entry, error) {
	root, err := resolveRoot(cwd, scope)
	if err != nil {
		return nil, err
	}
	dirents, err := os.ReadDir(root)
	if err != nil {
		return []Entry{}, nil // scope points at a file or nothing to list
	}
	out := make([]Entry, 0, len(dirents))
	for _, d := range dirents {
		if d.IsDir() && skipDirs[d.Name()] {
			continue
		}
		rel, ok := relToCwd(cwd, filepath.Join(root, d.Name()))
		if !ok {
			continue
		}
		out = append(out, Entry{Path: rel, IsDir: d.IsDir()})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	return out, nil
}

// WalkScoped returns a bounded, unranked recursive listing of files and folders
// under cwd/scope, with paths relative to cwd, sorted by path. Heavy directories
// are skipped, symlinks are not followed, and the walk stops once any budget is
// hit. The result is suitable for caching and repeated Rank calls.
func WalkScoped(cwd, scope string, opts Options) ([]Entry, error) {
	opts = opts.withDefaults()
	root, err := resolveRoot(cwd, scope)
	if err != nil {
		return nil, err
	}

	var out []Entry
	scanned := 0

	walkErr := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if d != nil && d.IsDir() {
				return fs.SkipDir // unreadable subtree: skip it, don't abort
			}
			return nil
		}
		if path == root {
			return nil
		}
		if scanned >= opts.MaxScanned || len(out) >= opts.MaxEntries {
			return errBudgetExhausted
		}
		scanned++

		if d.IsDir() && skipDirs[d.Name()] {
			return fs.SkipDir
		}

		// Depth is measured from the walk root so a scoped walk isn't penalized
		// for how deep the scope itself sits under cwd.
		if rootRel, err := filepath.Rel(root, path); err == nil {
			if strings.Count(filepath.ToSlash(rootRel), "/")+1 > opts.MaxDepth {
				if d.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
		}

		rel, ok := relToCwd(cwd, path)
		if !ok {
			if d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		out = append(out, Entry{Path: rel, IsDir: d.IsDir()})
		return nil
	})
	if walkErr != nil && !errors.Is(walkErr, errBudgetExhausted) {
		return nil, walkErr
	}

	sort.Slice(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	return out, nil
}

// Rank filters and scores entries against term and returns the top max matches
// (DefaultMaxResults when max <= 0). Entries are expected to already be scoped
// (e.g. from TopLevel/WalkScoped of the query's scope dir); Rank matches term
// against each entry's basename. Rank is pure — no I/O — so it is safe to call
// repeatedly over a cached listing.
func Rank(entries []Entry, term string, max int) []Entry {
	if max <= 0 {
		max = DefaultMaxResults
	}

	type scored struct {
		entry Entry
		score int
	}
	var matched []scored
	for _, e := range entries {
		score := scoreEntry(e.Path, term, e.IsDir)
		if score <= 0 {
			continue
		}
		matched = append(matched, scored{entry: e, score: score})
	}

	sort.SliceStable(matched, func(i, j int) bool {
		if matched[i].score != matched[j].score {
			return matched[i].score > matched[j].score
		}
		return matched[i].entry.Path < matched[j].entry.Path
	})

	if len(matched) > max {
		matched = matched[:max]
	}
	out := make([]Entry, len(matched))
	for i, m := range matched {
		out[i] = m.entry
	}
	return out
}

// List lists and ranks cwd against query in one call, picking the cheap
// TopLevel strategy for short queries and the recursive WalkScoped for longer
// ones. Convenience for callers that do not cache; the server lists and ranks
// separately so it can cache the listing.
func List(cwd, query string, max int) ([]Entry, error) {
	scope, term := SplitQuery(query)
	var entries []Entry
	var err error
	if len(term) < DeepQueryThreshold {
		entries, err = TopLevel(cwd, scope)
	} else {
		entries, err = WalkScoped(cwd, scope, Options{})
	}
	if err != nil {
		return nil, err
	}
	return Rank(entries, term, max), nil
}

// SplitQuery separates a directory scope from the trailing match term. The term
// is the part after the final slash; everything before it is the scope.
func SplitQuery(query string) (scope, term string) {
	query = strings.TrimPrefix(query, "/")
	idx := strings.LastIndex(query, "/")
	if idx < 0 {
		return "", query
	}
	return query[:idx], query[idx+1:]
}

// scoreEntry ranks rel (a slash path relative to cwd) against term, mirroring
// pi's autocomplete weighting: exact basename beats prefix beats substring beats
// a path-substring, and directories get a small bonus. Zero means "no match";
// an empty term matches everything so the dropdown can show a plain listing.
func scoreEntry(rel, term string, isDir bool) int {
	base := rel
	if i := strings.LastIndex(rel, "/"); i >= 0 {
		base = rel[i+1:]
	}
	bonus := 0
	if isDir {
		bonus = 10
	}
	if term == "" {
		return 1 + bonus
	}
	lb := strings.ToLower(base)
	lt := strings.ToLower(term)
	lr := strings.ToLower(rel)
	switch {
	case lb == lt:
		return 100 + bonus
	case strings.HasPrefix(lb, lt):
		return 80 + bonus
	case strings.Contains(lb, lt):
		return 50 + bonus
	case strings.Contains(lr, lt):
		return 30 + bonus
	default:
		return 0
	}
}

// withinRoot reports whether target is root itself or nested inside it.
func withinRoot(root, target string) bool {
	rel, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	return rel == "." || !strings.HasPrefix(rel, "..")
}
