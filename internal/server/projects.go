package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"pi-web/internal/sessions"
)

var (
	errEmptyPath    = errors.New("path is required")
	errRelativePath = errors.New("path must be absolute")
)

// projectPrefsSchema creates the table that records which projects are shown on
// the index page. A project is "enabled" when it should appear; new projects
// discovered after the first run default to disabled (allowlist), while the
// very first run seeds every existing project as enabled so the homepage looks
// unchanged until the user starts curating.
const projectPrefsSchema = `CREATE TABLE IF NOT EXISTS project_prefs (
	project_path TEXT PRIMARY KEY,
	enabled INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'discovered',
	updated_at DATETIME
)`

// appSettingsSchema holds simple key/value app preferences. Currently only the
// project-filter master switch.
const appSettingsSchema = `CREATE TABLE IF NOT EXISTS app_settings (
	key TEXT PRIMARY KEY,
	value TEXT
)`

const settingProjectFilterEnabled = "project_filter_enabled"

// projectFilterEnabled reports whether the homepage should be filtered to only
// enabled projects. Off by default: with the filter off every project (and any
// new session) shows up normally.
func (s *Server) projectFilterEnabled() bool {
	if s.db == nil {
		return false
	}
	var v string
	if err := s.db.QueryRow("SELECT value FROM app_settings WHERE key = ?", settingProjectFilterEnabled).Scan(&v); err != nil {
		return false
	}
	return v == "1"
}

func (s *Server) setProjectFilterEnabled(enabled bool) {
	if s.db == nil {
		return
	}
	v := "0"
	if enabled {
		v = "1"
	}
	_, _ = s.db.Exec(`INSERT INTO app_settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value`, settingProjectFilterEnabled, v)
}

type projectEntry struct {
	Path         string `json:"path"`
	Enabled      bool   `json:"enabled"`
	SessionCount int    `json:"sessionCount"`
	Source       string `json:"source"`
}

func (s *Server) nowTime() time.Time {
	if s.now != nil {
		return s.now()
	}
	return time.Now()
}

// distinctProjects returns the unique, non-empty project paths in first-seen
// order.
func distinctProjects(summaries []sessions.SessionSummary) []string {
	seen := make(map[string]bool)
	out := make([]string, 0)
	for _, sum := range summaries {
		if sum.Project == "" || seen[sum.Project] {
			continue
		}
		seen[sum.Project] = true
		out = append(out, sum.Project)
	}
	return out
}

// syncProjectPrefs records any not-yet-tracked discovered projects. On the very
// first run (empty table) every discovered project is enabled; afterwards new
// projects are inserted disabled so they stay hidden until the user enables
// them. Existing rows are never modified.
func (s *Server) syncProjectPrefs(discovered []string) {
	if s.db == nil || len(discovered) == 0 {
		return
	}
	var count int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM project_prefs").Scan(&count); err != nil {
		return
	}
	defaultEnabled := 0
	if count == 0 {
		defaultEnabled = 1
	}
	now := s.nowTime()
	for _, p := range discovered {
		if p == "" {
			continue
		}
		_, _ = s.db.Exec(`INSERT INTO project_prefs (project_path, enabled, source, updated_at)
			VALUES (?, ?, 'discovered', ?)
			ON CONFLICT(project_path) DO NOTHING`, p, defaultEnabled, now)
	}
}

// enabledProjectSet returns the set of enabled project paths. The second return
// value is false when preferences are unavailable (no database), in which case
// callers should treat every project as enabled.
func (s *Server) enabledProjectSet() (map[string]bool, bool) {
	if s.db == nil {
		return nil, false
	}
	rows, err := s.db.Query("SELECT project_path FROM project_prefs WHERE enabled = 1")
	if err != nil {
		return nil, false
	}
	defer rows.Close()
	set := make(map[string]bool)
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, false
		}
		set[p] = true
	}
	return set, true
}

// filterEnabledSummaries drops sessions whose project is disabled. Sessions with
// an empty project are always kept. With no database it is a no-op.
func (s *Server) filterEnabledSummaries(summaries []sessions.SessionSummary) []sessions.SessionSummary {
	if s.db == nil || !s.projectFilterEnabled() {
		return summaries
	}
	s.syncProjectPrefs(distinctProjects(summaries))
	enabled, ok := s.enabledProjectSet()
	if !ok {
		return summaries
	}
	out := make([]sessions.SessionSummary, 0, len(summaries))
	for _, sum := range summaries {
		if sum.Project == "" || enabled[sum.Project] {
			out = append(out, sum)
		}
	}
	return out
}

func (s *Server) handleApiProjects(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	summaries, err := s.loadSummaries()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	counts := make(map[string]int)
	for _, sum := range summaries {
		if sum.Project != "" {
			counts[sum.Project]++
		}
	}
	s.syncProjectPrefs(distinctProjects(summaries))

	enabled := make(map[string]bool)
	source := make(map[string]string)
	if s.db != nil {
		rows, err := s.db.Query("SELECT project_path, enabled, source FROM project_prefs")
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var p, src string
				var en int
				if err := rows.Scan(&p, &en, &src); err != nil {
					continue
				}
				enabled[p] = en == 1
				source[p] = src
			}
		}
	}

	// Union of projects that have sessions and projects recorded in prefs
	// (e.g. registered paths without sessions yet).
	paths := make(map[string]bool)
	for p := range counts {
		paths[p] = true
	}
	for p := range enabled {
		paths[p] = true
	}

	entries := make([]projectEntry, 0, len(paths))
	for p := range paths {
		src := source[p]
		if src == "" {
			src = "discovered"
		}
		en := enabled[p]
		// Without a database we cannot persist prefs; report everything enabled.
		if s.db == nil {
			en = true
		}
		entries = append(entries, projectEntry{
			Path:         p,
			Enabled:      en,
			SessionCount: counts[p],
			Source:       src,
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].SessionCount != entries[j].SessionCount {
			return entries[i].SessionCount > entries[j].SessionCount
		}
		return entries[i].Path < entries[j].Path
	})

	writeJSON(w, 0, map[string]any{
		"projects":      entries,
		"filterEnabled": s.projectFilterEnabled(),
	})
}

func (s *Server) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		Path   string `json:"path"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	if s.db == nil {
		writeJSONError(w, http.StatusInternalServerError, "preferences are unavailable")
		return
	}

	if body.Action == "enable-filter" || body.Action == "disable-filter" {
		s.setProjectFilterEnabled(body.Action == "enable-filter")
		writeJSON(w, 0, map[string]any{"ok": true, "filterEnabled": s.projectFilterEnabled()})
		return
	}

	if body.Action == "enable-all" || body.Action == "disable-all" {
		s.setAllProjectsEnabled(body.Action == "enable-all")
		writeJSON(w, 0, map[string]any{"ok": true})
		return
	}

	path := body.Path
	if body.Action == "register" {
		normalized, err := normalizeProjectPath(path)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		path = normalized
	}
	if strings.TrimSpace(path) == "" {
		writeJSONError(w, http.StatusBadRequest, "path is required")
		return
	}

	now := s.nowTime()
	var err error
	switch body.Action {
	case "enable":
		_, err = s.db.Exec(`INSERT INTO project_prefs (project_path, enabled, source, updated_at)
			VALUES (?, 1, 'discovered', ?)
			ON CONFLICT(project_path) DO UPDATE SET enabled=1, updated_at=excluded.updated_at`, path, now)
	case "disable":
		_, err = s.db.Exec(`INSERT INTO project_prefs (project_path, enabled, source, updated_at)
			VALUES (?, 0, 'discovered', ?)
			ON CONFLICT(project_path) DO UPDATE SET enabled=0, updated_at=excluded.updated_at`, path, now)
	case "register":
		_, err = s.db.Exec(`INSERT INTO project_prefs (project_path, enabled, source, updated_at)
			VALUES (?, 1, 'registered', ?)
			ON CONFLICT(project_path) DO UPDATE SET enabled=1, updated_at=excluded.updated_at`, path, now)
	case "remove":
		_, err = s.db.Exec("DELETE FROM project_prefs WHERE project_path = ?", path)
	default:
		writeJSONError(w, http.StatusBadRequest, "unknown action")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to update project: "+err.Error())
		return
	}
	writeJSON(w, 0, map[string]any{"ok": true, "path": path})
}

// setAllProjectsEnabled flips every known project (discovered ∪ registered) to
// enabled or disabled in one shot. Discovered projects are synced first so they
// exist as rows before the bulk update.
func (s *Server) setAllProjectsEnabled(enabled bool) {
	if s.db == nil {
		return
	}
	if summaries, err := s.loadSummaries(); err == nil {
		s.syncProjectPrefs(distinctProjects(summaries))
	}
	val := 0
	if enabled {
		val = 1
	}
	_, _ = s.db.Exec("UPDATE project_prefs SET enabled = ?, updated_at = ?", val, s.nowTime())
}

// normalizeProjectPath expands a leading ~ and cleans the path so a registered
// project matches the cwd recorded in future session headers.
func normalizeProjectPath(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", errEmptyPath
	}
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		path = filepath.Join(home, path[2:])
	}
	path = filepath.Clean(path)
	if !filepath.IsAbs(path) {
		return "", errRelativePath
	}
	return path, nil
}
