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

// get returns the cached listing for cwd, walking via fn on a miss or expiry.
func (c *fileWalkCache) get(cwd string, fn func() ([]files.Entry, error)) ([]files.Entry, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if rec, ok := c.entries[cwd]; ok && c.now().Before(rec.expires) {
		return rec.list, nil
	}
	list, err := fn()
	if err != nil {
		return nil, err
	}
	c.entries[cwd] = fileWalkRecord{list: list, expires: c.now().Add(c.ttl)}
	return list, nil
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

	entries, err := s.fileWalkCache().get(cwd, func() ([]files.Entry, error) {
		return files.Walk(cwd, files.Options{})
	})
	if err != nil {
		if errors.Is(err, files.ErrNotDir) {
			writeJSON(w, 0, map[string]any{"files": []files.Entry{}})
			return
		}
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	ranked := files.Rank(entries, r.URL.Query().Get("q"), 0)
	writeJSON(w, 0, map[string]any{"files": ranked})
}
