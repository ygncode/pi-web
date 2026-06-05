// Package files provides a bounded, read-only directory listing for the chat
// composer's @mention autocomplete. It walks a session's working directory and
// ranks files and folders against a query.
//
// The walk is deliberately bounded on every axis (entries collected, entries
// scanned, recursion depth) and skips heavy build/VCS directories, so a single
// request can never fan out across a giant tree. Symlinks are never followed,
// which both bounds traversal and guarantees results stay inside cwd.
//
// Walk (the filesystem hit) and Rank (pure scoring) are separate so a caller
// can walk a cwd once, cache the result, and re-rank it cheaply as the user
// types — no filesystem access per keystroke.
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

// Options bounds a Walk. Zero values fall back to the defaults below.
type Options struct {
	MaxEntries int // entries collected before the walk stops
	MaxScanned int // directory entries visited before the walk gives up
	MaxDepth   int // recursion depth below cwd
}

const (
	defaultMaxEntries = 5000
	defaultMaxScanned = 20000
	defaultMaxDepth   = 12

	// DefaultMaxResults is the number of ranked entries Rank returns when the
	// caller passes a non-positive limit.
	DefaultMaxResults = 20
)

// ErrNotDir is returned when cwd is empty or does not resolve to a directory.
var ErrNotDir = errors.New("cwd is not a directory")

// skipDirs are never descended into: large, machine-generated, or VCS internals
// that no one wants to @mention and that would blow the scan budget.
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

// Walk returns a bounded, unranked listing of files and folders under cwd,
// sorted by path. Heavy directories are skipped, symlinks are not followed, and
// the walk stops once any budget is hit. The result is suitable for caching and
// repeated Rank calls.
func Walk(cwd string, opts Options) ([]Entry, error) {
	opts = opts.withDefaults()
	if cwd == "" {
		return nil, ErrNotDir
	}
	if info, err := os.Stat(cwd); err != nil || !info.IsDir() {
		return nil, ErrNotDir
	}

	var out []Entry
	scanned := 0

	walkErr := filepath.WalkDir(cwd, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if d != nil && d.IsDir() {
				return fs.SkipDir // unreadable subtree: skip it, don't abort
			}
			return nil
		}
		if path == cwd {
			return nil
		}
		if scanned >= opts.MaxScanned || len(out) >= opts.MaxEntries {
			return errBudgetExhausted
		}
		scanned++

		if d.IsDir() && skipDirs[d.Name()] {
			return fs.SkipDir
		}

		rel, relErr := filepath.Rel(cwd, path)
		if relErr != nil || strings.HasPrefix(rel, "..") {
			if d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if strings.Count(filepath.ToSlash(rel), "/")+1 > opts.MaxDepth {
			if d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}

		out = append(out, Entry{Path: filepath.ToSlash(rel), IsDir: d.IsDir()})
		return nil
	})
	if walkErr != nil && !errors.Is(walkErr, errBudgetExhausted) {
		return nil, walkErr
	}

	sort.Slice(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	return out, nil
}

// Rank filters and scores entries against query and returns the top max matches
// (DefaultMaxResults when max <= 0). A query may carry a directory scope:
// "src/foo" only considers entries under src/ and matches "foo" against their
// basenames; a bare "foo" considers everything. Rank is pure — no I/O — so it is
// safe to call repeatedly over a cached Walk result.
func Rank(entries []Entry, query string, max int) []Entry {
	if max <= 0 {
		max = DefaultMaxResults
	}
	scope, term := splitQuery(query)
	scopePrefix := ""
	if scope != "" {
		scopePrefix = scope + "/"
	}

	type scored struct {
		entry Entry
		score int
	}
	var matched []scored
	for _, e := range entries {
		if scope != "" && e.Path != scope && !strings.HasPrefix(e.Path, scopePrefix) {
			continue
		}
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

// List walks cwd and ranks the result in one call. Convenience for callers that
// do not cache; the server uses Walk + Rank separately.
func List(cwd, query string, max int) ([]Entry, error) {
	entries, err := Walk(cwd, Options{})
	if err != nil {
		return nil, err
	}
	return Rank(entries, query, max), nil
}

// splitQuery separates a directory scope from the trailing match term. The term
// is the part after the final slash; everything before it is the scope.
func splitQuery(query string) (scope, term string) {
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
