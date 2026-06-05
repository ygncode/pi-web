package server

import (
	"errors"
	"net/http"
	"sync"
	"time"

	"pi-web/internal/files"
)

// fileWalkTTL is how long a bounded directory walk is reused before the next
// request re-scans. Short enough that newly created files appear quickly, long
// enough that a burst of keystrokes shares one filesystem walk.
const fileWalkTTL = 5 * time.Second

// fileWalkCache memoizes Walk results per cwd for a short window. Concurrent
// requests for the same cold cwd are serialized so only one walk runs.
type fileWalkCache struct {
	mu      sync.Mutex
	ttl     time.Duration
	now     func() time.Time
	entries map[string]fileWalkRecord
}

type fileWalkRecord struct {
	list    []files.Entry
	expires time.Time
}

func newFileWalkCache(now func() time.Time) *fileWalkCache {
	if now == nil {
		now = time.Now
	}
	return &fileWalkCache{ttl: fileWalkTTL, now: now, entries: map[string]fileWalkRecord{}}
}

// get returns the cached listing for key, listing via fn on a miss or expiry.
func (c *fileWalkCache) get(key string, fn func() ([]files.Entry, error)) ([]files.Entry, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if rec, ok := c.entries[key]; ok && c.now().Before(rec.expires) {
		return rec.list, nil
	}
	list, err := fn()
	if err != nil {
		return nil, err
	}
	c.entries[key] = fileWalkRecord{list: list, expires: c.now().Add(c.ttl)}
	return list, nil
}

// fileWalkKey namespaces a cached listing by cwd, scope, and strategy so a
// shallow TopLevel and a deep WalkScoped of the same directory don't collide.
func fileWalkKey(cwd, scope string, deep bool) string {
	mode := "top"
	if deep {
		mode = "walk"
	}
	return mode + "\x00" + cwd + "\x00" + scope
}

func (s *Server) fileWalkCache() *fileWalkCache {
	s.fileWalkOnce.Do(func() {
		s.fileWalk = newFileWalkCache(s.now)
	})
	return s.fileWalk
}

// handleApiFiles lists files and folders under a session's working directory,
// ranked against the ?q= query, for the chat composer's @mention autocomplete.
// A session whose cwd no longer exists yields an empty list rather than an error
// so the composer simply shows no matches.
func (s *Server) handleApiFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	_, cwd, err := s.resolveSessionCwd(r.URL.Query().Get("id"))
	if err != nil {
		writeSessionLookupError(w, err)
		return
	}

	query := r.URL.Query().Get("q")
	scope, term := files.SplitQuery(query)

	// Cheap path: while the user is browsing or has typed only a character or
	// two, list just the immediate children of the (scoped) directory — one
	// ReadDir, no recursion. Only a longer term triggers a recursive walk, and
	// only of that scope's subtree. This keeps the common case light on small
	// hardware. Cache key distinguishes shallow vs deep and the scope so the two
	// listings never clobber each other.
	deep := len(term) >= files.DeepQueryThreshold
	key := fileWalkKey(cwd, scope, deep)
	entries, err := s.fileWalkCache().get(key, func() ([]files.Entry, error) {
		if deep {
			return files.WalkScoped(cwd, scope, files.Options{})
		}
		return files.TopLevel(cwd, scope)
	})
	if err != nil {
		if errors.Is(err, files.ErrNotDir) {
			writeJSON(w, 0, map[string]any{"files": []files.Entry{}})
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	ranked := files.Rank(entries, term, 0)
	writeJSON(w, 0, map[string]any{"files": ranked})
}
