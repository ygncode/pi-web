package sessions

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type cacheEntry struct {
	modTime time.Time
	dirName string
	summary SessionSummary
}

type sessionCacheEntry struct {
	modTime time.Time
	session Session
}

type Cache struct {
	mu           sync.Mutex
	entries      map[string]cacheEntry        // keyed by full file path
	pathIndex    map[string]string            // filename -> full file path
	sessionCache map[string]sessionCacheEntry // path -> full parsed session

	parses int // diagnostic: number of ParseSummary calls
	hits   int // diagnostic: number of cache hits

	// Whole-scan result cache (see resultCacheTTL).
	resDir       string
	resAt        time.Time
	resSummaries []SessionSummary
	resErr       error
}

// resultCacheTTL bounds how long a full LoadAll scan is reused. Directory
// listings over NFS cost ~1 stat per project dir per call (800+ dirs here);
// without it every index poll re-walked them all (~0.8s server-side). New
// sessions appear within the TTL window, which is fine for a UI that polls.
const resultCacheTTL = 1500 * time.Millisecond

// Invalidate drops the whole-scan result cache so the next LoadAll re-walks
// the tree (used by tests and by anything that writes sessions directly).
func (c *Cache) Invalidate() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.resDir = ""
}

func NewCache() *Cache {
	return &Cache{
		entries:      make(map[string]cacheEntry),
		pathIndex:    make(map[string]string),
		sessionCache: make(map[string]sessionCacheEntry),
	}
}

// LoadAll returns summaries for every session under dir. Files whose modtime
// hasn't changed since the previous call are returned from the cache; files
// that are new or modified are re-parsed; files that have disappeared are
// evicted. It also maintains a path index for O(1) lookup by filename.
func (c *Cache) LoadAll(dir string) ([]SessionSummary, error) {
	c.mu.Lock()
	if c.resDir == dir && time.Since(c.resAt) < resultCacheTTL {
		out, err := c.resSummaries, c.resErr
		c.mu.Unlock()
		return out, err
	}
	c.mu.Unlock()

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	// Collect all files to consider, along with their info, before locking.
	type fileRecord struct {
		path    string
		dirName string
		name    string
		modTime time.Time
	}
	var records []fileRecord
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		subDir := filepath.Join(dir, e.Name())
		subs, err := os.ReadDir(subDir)
		if err != nil {
			continue
		}
		for _, f := range subs {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".jsonl") {
				continue
			}
			info, err := f.Info()
			if err != nil {
				continue
			}
			records = append(records, fileRecord{
				path:    filepath.Join(subDir, f.Name()),
				dirName: e.Name(),
				name:    f.Name(),
				modTime: info.ModTime(),
			})
		}
	}

	c.mu.Lock()

	// Determine which files need parsing (new or modified).
	type parseWork struct {
		rec fileRecord
	}
	var toparse []parseWork
	seen := make(map[string]struct{}, len(records))
	cached := make([]SessionSummary, 0, len(records))

	for _, rec := range records {
		seen[rec.path] = struct{}{}
		if ce, ok := c.entries[rec.path]; ok && ce.modTime.Equal(rec.modTime) && ce.dirName == rec.dirName {
			c.hits++
			cached = append(cached, ce.summary)
		} else {
			toparse = append(toparse, parseWork{rec})
		}
	}

	// Evict files no longer present.
	for p := range c.entries {
		if _, ok := seen[p]; !ok {
			delete(c.entries, p)
			delete(c.pathIndex, filepath.Base(p))
		}
	}

	c.mu.Unlock()

	if len(toparse) == 0 {
		SortSummariesByActivity(cached)
		return cached, nil
	}

	// Parse files concurrently.
	type result struct {
		rec     fileRecord
		summary SessionSummary
		err     error
	}
	results := make([]result, len(toparse))
	var wg sync.WaitGroup
	// Use higher concurrency — SSDs handle many concurrent reads well.
	concurrency := len(toparse)
	if concurrency > 32 {
		concurrency = 32
	}
	if concurrency < 1 {
		concurrency = 1
	}
	sem := make(chan struct{}, concurrency)
	for i, w := range toparse {
		wg.Add(1)
		go func(i int, w parseWork) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			summary, err := ParseSummary(w.rec.path, w.rec.dirName, w.rec.name)
			results[i] = result{rec: w.rec, summary: summary, err: err}
		}(i, w)
	}
	wg.Wait()

	c.mu.Lock()
	summaries := make([]SessionSummary, 0, len(records))
	summaries = append(summaries, cached...)
	for _, res := range results {
		if res.err != nil {
			continue
		}
		c.parses++
		c.entries[res.rec.path] = cacheEntry{
			modTime: res.rec.modTime,
			dirName: res.rec.dirName,
			summary: res.summary,
		}
		c.pathIndex[res.rec.name] = res.rec.path
		summaries = append(summaries, res.summary)
	}
	// Rebuild pathIndex for all cached entries too (idempotent).
	for path, ce := range c.entries {
		name := filepath.Base(path)
		if _, exists := c.pathIndex[name]; !exists {
			c.pathIndex[name] = path
			_ = ce
		}
	}
	c.mu.Unlock()

	SortSummariesByActivity(summaries)

	c.mu.Lock()
	c.resDir = dir
	c.resAt = time.Now()
	c.resSummaries = summaries
	c.resErr = nil
	c.mu.Unlock()

	return summaries, nil
}

// FindPath returns the full filesystem path for a session filename, using the
// in-memory path index built by LoadAll. Returns ("", false) if not found.
func (c *Cache) FindPath(name string) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	p, ok := c.pathIndex[name]
	return p, ok
}

// ProjectForID returns the cached project path for a session without touching
// the filesystem. LoadAll and Resolve both populate the cache records it reads.
func (c *Cache) ProjectForID(name string) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	path, ok := c.pathIndex[name]
	if !ok {
		return "", false
	}
	if entry, ok := c.entries[path]; ok {
		return entry.summary.Project, true
	}
	if entry, ok := c.sessionCache[path]; ok {
		return entry.session.Project, true
	}
	return "", false
}

// Resolve resolves a session by filename ID. It tries the in-memory path index
// first (O(1)) and falls back to a directory scan if the index is cold.
// Parsed sessions are cached by modtime so repeated reads of unchanged files
// skip disk I/O entirely.
func (c *Cache) Resolve(sessionsDir, id string) (ResolvedSession, error) {
	if id == "" || filepath.Base(id) != id || filepath.Ext(id) != ".jsonl" {
		return ResolvedSession{}, ErrInvalidSessionID
	}

	path, ok := c.FindPath(id)
	if !ok {
		var err error
		path, err = findPathByFilename(sessionsDir, id)
		if err != nil {
			return ResolvedSession{}, err
		}
		c.mu.Lock()
		c.pathIndex[id] = path
		c.mu.Unlock()
	}

	info, err := os.Stat(path)
	if err != nil {
		return ResolvedSession{}, err
	}
	modTime := info.ModTime()

	c.mu.Lock()
	ce, hasCached := c.sessionCache[path]
	c.mu.Unlock()

	if hasCached && ce.modTime.Equal(modTime) {
		return ResolvedSession{Session: ce.session, Path: path}, nil
	}

	sess, err := ParseFile(path, filepath.Base(filepath.Dir(path)), id)
	if err != nil {
		return ResolvedSession{}, err
	}

	c.mu.Lock()
	c.sessionCache[path] = sessionCacheEntry{modTime: modTime, session: sess}
	c.mu.Unlock()

	return ResolvedSession{Session: sess, Path: path}, nil
}
