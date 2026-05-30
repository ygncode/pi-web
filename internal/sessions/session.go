package sessions

import (
	"bufio"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Typed structs for ParseSummary — avoid map[string]any per line.
type summaryLine struct {
	Type      string      `json:"type"`
	Timestamp string      `json:"timestamp"`
	Name      string      `json:"name"`
	CWD       string      `json:"cwd"`
	ID        string      `json:"id"`
	Provider  string      `json:"provider"`
	ModelID   string      `json:"modelId"`
	Message   *summaryMsg `json:"message"`
}

type summaryMsg struct {
	Role     string          `json:"role"`
	Provider string          `json:"provider"`
	Model    string          `json:"model"`
	Content  json.RawMessage `json:"content"`
	Usage    summaryUsage    `json:"usage"`
}

type summaryUsage struct {
	TotalTokens float64     `json:"totalTokens"`
	Cost        summaryCost `json:"cost"`
}

type summaryCost struct {
	Total float64 `json:"total"`
}

type SessionSummary struct {
	ID                 string
	SessionUUID        string
	Filename           string
	Project            string
	LastActivity       string
	Name               string
	MessageCount       int
	TokenTotal         int
	CostTotal          float64
	Model              string
	ModelProvider      string
	ChatAvailable      bool
	ChatDisabledReason string
}

type Session struct {
	SessionSummary
	Header  map[string]any
	Entries []map[string]any
}

func SortSummariesByActivity(s []SessionSummary) {
	type sortableSummary struct {
		summary  SessionSummary
		activity time.Time
		valid    bool
		index    int
	}

	items := make([]sortableSummary, len(s))
	for i := range s {
		activity, err := time.Parse(time.RFC3339, s[i].LastActivity)
		items[i] = sortableSummary{
			summary:  s[i],
			activity: activity,
			valid:    err == nil,
			index:    i,
		}
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].valid != items[j].valid {
			return items[i].valid
		}
		if !items[i].activity.Equal(items[j].activity) {
			return items[i].activity.After(items[j].activity)
		}
		return items[i].index < items[j].index
	})

	for i := range items {
		s[i] = items[i].summary
	}
}

// SortSummariesByProjectActivity makes project groups contiguous. Projects are
// ordered by their newest session activity; sessions within each project are
// ordered newest-first.
func SortSummariesByProjectActivity(s []SessionSummary) {
	type projectGroup struct {
		project string
		items   []SessionSummary
		latest  time.Time
		valid   bool
		index   int
	}

	groups := make([]*projectGroup, 0)
	byProject := make(map[string]*projectGroup)
	for _, summary := range s {
		project := summary.Project
		group := byProject[project]
		if group == nil {
			group = &projectGroup{project: project, index: len(groups)}
			byProject[project] = group
			groups = append(groups, group)
		}
		group.items = append(group.items, summary)
		if activity, err := time.Parse(time.RFC3339, summary.LastActivity); err == nil {
			if !group.valid || activity.After(group.latest) {
				group.latest = activity
				group.valid = true
			}
		}
	}

	for _, group := range groups {
		SortSummariesByActivity(group.items)
	}

	sort.Slice(groups, func(i, j int) bool {
		if groups[i].valid != groups[j].valid {
			return groups[i].valid
		}
		if !groups[i].latest.Equal(groups[j].latest) {
			return groups[i].latest.After(groups[j].latest)
		}
		return groups[i].index < groups[j].index
	})

	out := s[:0]
	for _, group := range groups {
		out = append(out, group.items...)
	}
}

// ParseSummary streams path line-by-line, accumulating only the fields the
// index page needs. Lines are discarded after parsing — unlike ParseFile,
// the full conversation is not retained in memory.
func ParseSummary(path, dirName, fileName string) (SessionSummary, error) {
	f, err := os.Open(path)
	if err != nil {
		return SessionSummary{}, err
	}
	defer f.Close()

	s := SessionSummary{
		ID:            fileName,
		Filename:      fileName,
		Project:       cleanProjectName(dirName),
		ChatAvailable: true,
	}

	var headerName, sessionInfoName, firstUserText, headerCwd string
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if len(line) == 0 {
			continue
		}
		var raw summaryLine
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}
		switch raw.Type {
		case "session":
			if raw.Name != "" {
				headerName = raw.Name
			}
			if raw.CWD != "" {
				headerCwd = raw.CWD
			}
			if raw.ID != "" {
				s.SessionUUID = raw.ID
			}
		case "session_info":
			if raw.Name != "" {
				sessionInfoName = raw.Name
			}
		case "message":
			if raw.Timestamp != "" {
				s.LastActivity = raw.Timestamp
			}
			if raw.Message == nil {
				continue
			}
			msg := raw.Message
			s.MessageCount++
			s.TokenTotal += int(msg.Usage.TotalTokens)
			s.CostTotal += msg.Usage.Cost.Total
			if msg.Model != "" {
				s.Model = msg.Model
				s.ModelProvider = msg.Provider
			}
			if firstUserText == "" && msg.Role == "user" {
				firstUserText = extractRawText(msg.Content)
			}
		case "model_change":
			if raw.Timestamp != "" {
				s.LastActivity = raw.Timestamp
			}
			if raw.ModelID != "" {
				s.Model = raw.ModelID
				s.ModelProvider = raw.Provider
			}
		default:
			if raw.Timestamp != "" {
				s.LastActivity = raw.Timestamp
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return SessionSummary{}, err
	}

	if s.LastActivity == "" {
		if info, err := os.Stat(path); err == nil {
			s.LastActivity = info.ModTime().Format(time.RFC3339)
		}
	}

	switch {
	case sessionInfoName != "":
		s.Name = sessionInfoName
	case headerName != "":
		s.Name = headerName
	case firstUserText != "":
		s.Name = truncate(firstUserText, 80)
	default:
		s.Name = fileName
	}

	if headerCwd != "" {
		s.Project = headerCwd
		if _, err := os.Stat(headerCwd); err != nil {
			s.ChatAvailable = false
			s.ChatDisabledReason = "This session can be viewed, but chat is disabled because its working directory no longer exists."
		}
	}

	return s, nil
}

// extractRawText pulls plain text from a json.RawMessage content value
// (string or content-block array). Used by ParseSummary.
func extractRawText(content json.RawMessage) string {
	if len(content) == 0 {
		return ""
	}
	if content[0] == '"' {
		var s string
		if json.Unmarshal(content, &s) == nil {
			return s
		}
	}
	if content[0] == '[' {
		var blocks []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}
		if json.Unmarshal(content, &blocks) == nil {
			var buf strings.Builder
			for _, b := range blocks {
				if b.Type == "text" && b.Text != "" {
					buf.WriteString(b.Text)
				}
			}
			return buf.String()
		}
	}
	return ""
}

// ExtractMessageText pulls plain text from a message content value (string or
// content-block array). Used by both the parser and the session page renderer.
func ExtractMessageText(content any) string {
	return extractMessageText(content)
}

func extractMessageText(content any) string {
	switch v := content.(type) {
	case string:
		return v
	case []any:
		var buf strings.Builder
		for _, item := range v {
			if block, ok := item.(map[string]any); ok {
				if t, _ := block["type"].(string); t == "text" {
					if txt, _ := block["text"].(string); txt != "" {
						buf.WriteString(txt)
					}
				}
			}
		}
		return buf.String()
	}
	return ""
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "…"
}

var ErrEmptySessionName = errors.New("session name is empty")

// RenameSession persists a display-name change by appending a session_info
// entry. Parsers already treat the latest session_info.name as authoritative,
// so this preserves JSONL history instead of rewriting existing entries.
func RenameSession(path, name string, now func() time.Time) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return ErrEmptySessionName
	}
	if now == nil {
		now = time.Now
	}

	entry := struct {
		Type      string `json:"type"`
		Timestamp string `json:"timestamp"`
		Name      string `json:"name"`
	}{
		Type:      "session_info",
		Timestamp: now().UTC().Format(time.RFC3339),
		Name:      name,
	}
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	f, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND, 0)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.Write(append(data, '\n'))
	return err
}

// ParseFile parses path in a single pass, collecting both the SessionSummary
// fields and the full Entries slice. This avoids the double-read that would
// result from calling ParseSummary followed by os.ReadFile.
func ParseFile(path, dirName, fileName string) (Session, error) {
	f, err := os.Open(path)
	if err != nil {
		return Session{}, err
	}
	defer f.Close()

	s := SessionSummary{
		ID:            fileName,
		Filename:      fileName,
		Project:       cleanProjectName(dirName),
		ChatAvailable: true,
	}

	var entries []map[string]any
	var header map[string]any
	var headerName, sessionInfoName, firstUserText, headerCwd string
	seenSessionHeaders := make(map[string]bool)

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var raw map[string]any
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}
		if raw["type"] == "session" {
			key := sessionHeaderKey(raw)
			if key != "" && seenSessionHeaders[key] {
				continue
			}
			if key != "" {
				seenSessionHeaders[key] = true
			}
		}
		entries = append(entries, raw)
		switch raw["type"] {
		case "session":
			header = raw
			if n, _ := raw["name"].(string); n != "" {
				headerName = n
			}
			if cwd, _ := raw["cwd"].(string); cwd != "" {
				headerCwd = cwd
			}
			if sid, _ := raw["id"].(string); sid != "" {
				s.SessionUUID = sid
			}
		case "session_info":
			if n, _ := raw["name"].(string); n != "" {
				sessionInfoName = n
			}
		case "message":
			if ts, ok := raw["timestamp"].(string); ok {
				s.LastActivity = ts
			}
			msg, ok := raw["message"].(map[string]any)
			if !ok {
				continue
			}
			s.MessageCount++
			if model, _ := msg["model"].(string); model != "" {
				s.Model = model
				s.ModelProvider, _ = msg["provider"].(string)
			}
			if usage, ok := msg["usage"].(map[string]any); ok {
				if t, ok := usage["totalTokens"].(float64); ok {
					s.TokenTotal += int(t)
				}
				if cost, ok := usage["cost"].(map[string]any); ok {
					if total, ok := cost["total"].(float64); ok {
						s.CostTotal += total
					}
				}
			}
			if firstUserText == "" {
				if role, _ := msg["role"].(string); role == "user" {
					firstUserText = extractMessageText(msg["content"])
				}
			}
		case "model_change":
			if ts, ok := raw["timestamp"].(string); ok {
				s.LastActivity = ts
			}
			if model, _ := raw["modelId"].(string); model != "" {
				s.Model = model
				s.ModelProvider, _ = raw["provider"].(string)
			}
		default:
			if ts, ok := raw["timestamp"].(string); ok {
				s.LastActivity = ts
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return Session{}, err
	}

	if s.LastActivity == "" {
		if info, err := os.Stat(path); err == nil {
			s.LastActivity = info.ModTime().Format(time.RFC3339)
		}
	}

	switch {
	case sessionInfoName != "":
		s.Name = sessionInfoName
	case headerName != "":
		s.Name = headerName
	case firstUserText != "":
		s.Name = truncate(firstUserText, 80)
	default:
		s.Name = fileName
	}

	if headerCwd != "" {
		s.Project = headerCwd
		if _, err := os.Stat(headerCwd); err != nil {
			s.ChatAvailable = false
			s.ChatDisabledReason = "This session can be viewed, but chat is disabled because its working directory no longer exists."
		}
	}

	return Session{SessionSummary: s, Header: header, Entries: entries}, nil
}

func sessionHeaderKey(raw map[string]any) string {
	id, _ := raw["id"].(string)
	timestamp, _ := raw["timestamp"].(string)
	cwd, _ := raw["cwd"].(string)
	if id == "" || timestamp == "" {
		return ""
	}
	return id + "\x00" + timestamp + "\x00" + cwd
}

// cleanProjectName reverses EncodeProjectName for display purposes.
// It handles both the new escape-based encoding (using _ as sentinel) and
// the legacy encoding (where - stood for /).
func cleanProjectName(dirName string) string {
	s := strings.TrimPrefix(dirName, "--")
	s = strings.TrimSuffix(s, "--")
	s = decodeProjectBody(s)
	return s
}

// EncodeProjectName converts an absolute filesystem path into a safe
// directory name by escaping / and _. The result is wrapped with "--"
// so callers can recognise encoded project directories.
//
//	/home/user/my-project → --home_-user_-my-project--
//	/home/user/_cache    → --home_-user_-__cache--
func EncodeProjectName(path string) string {
	s := strings.TrimSpace(path)
	s = strings.Trim(s, "/")
	// Escape _ first, then /.  Order matters: we must double _ before we
	// introduce any new _ in the / escape sequence.
	s = strings.ReplaceAll(s, "_", "__")
	s = strings.ReplaceAll(s, "/", "_-")
	return "--" + s + "--"
}

// DecodeProjectName reverses EncodeProjectName.  It accepts both the
// new escape-based encoding and the legacy encoding (where - meant /)
// so that existing session directories continue to work.
func DecodeProjectName(dirName string) string {
	s := strings.TrimPrefix(dirName, "--")
	s = strings.TrimSuffix(s, "--")
	s = decodeProjectBody(s)
	if s != "" && !strings.HasPrefix(s, "/") {
		s = "/" + s
	}
	return s
}

// decodeProjectBody decodes the content between the "--" wrappers.
// New format (contains _):  __ → _,  _- → /
// Legacy format (no _):     -  → /
func decodeProjectBody(s string) string {
	if strings.Contains(s, "_") {
		// New escape-based encoding.  Order: unescape / first, then _.
		s = strings.ReplaceAll(s, "_-", "/")
		s = strings.ReplaceAll(s, "__", "_")
	} else {
		// Legacy encoding: every - was a /.
		s = strings.ReplaceAll(s, "-", "/")
	}
	return s
}

const maxRecentLocations = 10

type recentLocationDir struct {
	name    string
	modTime time.Time
}

func ListRecentLocations(sessionsDir string) ([]string, error) {
	entries, err := os.ReadDir(sessionsDir)
	if err != nil {
		return nil, err
	}
	dirs := make([]recentLocationDir, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		dirs = append(dirs, recentLocationDir{name: e.Name(), modTime: info.ModTime()})
	}
	sort.Slice(dirs, func(i, j int) bool {
		return dirs[i].modTime.After(dirs[j].modTime)
	})

	locations := make([]string, 0, maxRecentLocations)
	seen := make(map[string]bool)
	for _, dir := range dirs {
		loc := resolveLocation(sessionsDir, dir.name)
		if loc == "" || seen[loc] {
			continue
		}
		seen[loc] = true
		locations = append(locations, loc)
		if len(locations) == maxRecentLocations {
			break
		}
	}
	return locations, nil
}

// resolveLocation returns the projects absolute path for the given
// project directory name.  It first tries DecodeProjectName; if the
// result exists on disk it is returned directly.  Otherwise it falls
// back to reading the cwd from a session JSONL file inside the
// directory — this recovers legacy-encoded directories whose names
// contain literal hyphens that DecodeProjectName misinterprets as
// path separators.
func resolveLocation(sessionsDir, dirName string) string {
	loc := DecodeProjectName(dirName)
	if loc != "" {
		if info, err := os.Stat(loc); err == nil && info.IsDir() {
			return loc
		}
	}
	// Decoded path doesn't exist (or decoded to empty).  Try to recover
	// the real cwd from a session file inside the project directory.
	cwd := readSessionCWD(filepath.Join(sessionsDir, dirName))
	if cwd != "" {
		return cwd
	}
	return loc
}

// readSessionCWD opens a *.jsonl file in dir, reads its session header
// line, and returns the cwd field.  Returns "" on any error.  Any file
// in the directory will do — all sessions in the same project share
// the same cwd.
func readSessionCWD(dir string) string {
	matches, err := filepath.Glob(filepath.Join(dir, "*.jsonl"))
	if err != nil || len(matches) == 0 {
		return ""
	}
	f, err := os.Open(matches[0])
	if err != nil {
		return ""
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 1*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if len(line) == 0 {
			continue
		}
		var raw struct {
			Type string `json:"type"`
			CWD  string `json:"cwd"`
		}
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}
		if raw.Type == "session" && raw.CWD != "" {
			return raw.CWD
		}
		// Only the first (session) line matters.
		break
	}
	return ""
}

type InitialSettings struct {
	ModelProvider string
	ModelID       string
	ThinkingLevel string
}

func CreateSessionFile(sessionsDir, path string) (string, error) {
	return CreateSessionFileWithSettings(sessionsDir, path, InitialSettings{})
}

func CreateSessionFileWithSettings(sessionsDir, path string, settings InitialSettings) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", errors.New("path is required")
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
		return "", errors.New("path must be absolute")
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := os.MkdirAll(path, 0755); err != nil {
			return "", err
		}
	}

	projectDir := filepath.Join(sessionsDir, EncodeProjectName(path))
	rel, err := filepath.Rel(sessionsDir, projectDir)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", errors.New("invalid path")
	}
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return "", err
	}

	id := randomUUID()
	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05.000Z")
	filename := timestamp + "_" + id + ".jsonl"
	filePath := filepath.Join(projectDir, filename)

	header := map[string]any{
		"type":      "session",
		"version":   3,
		"id":        id,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		"cwd":       path,
	}
	data, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	var fileData []byte
	fileData = append(fileData, data...)
	fileData = append(fileData, '\n')
	var parentID any
	if settings.ModelProvider != "" && settings.ModelID != "" {
		entryID := randomEntryID()
		line, err := json.Marshal(map[string]any{
			"type":      "model_change",
			"id":        entryID,
			"parentId":  parentID,
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
			"provider":  settings.ModelProvider,
			"modelId":   settings.ModelID,
			"implicit":  true,
		})
		if err != nil {
			return "", err
		}
		fileData = append(fileData, line...)
		fileData = append(fileData, '\n')
		parentID = entryID
	}
	if settings.ThinkingLevel != "" {
		entryID := randomEntryID()
		line, err := json.Marshal(map[string]any{
			"type":          "thinking_level_change",
			"id":            entryID,
			"parentId":      parentID,
			"timestamp":     time.Now().UTC().Format(time.RFC3339Nano),
			"thinkingLevel": settings.ThinkingLevel,
			"implicit":      true,
		})
		if err != nil {
			return "", err
		}
		fileData = append(fileData, line...)
		fileData = append(fileData, '\n')
	}
	if err := os.WriteFile(filePath, fileData, 0644); err != nil {
		return "", err
	}
	return filename, nil
}

// ForkSessionFile creates a new session file by copying entries from sourcePath
// up to and including forkEntryID. The new session is placed in the same
// project directory as the source and includes a parentSession reference.
func ForkSessionFile(sessionsDir, sourcePath, forkEntryID string, now func() time.Time) (string, error) {
	return createBranchSessionFile(sessionsDir, sourcePath, forkEntryID, now, true)
}

// CloneSessionFile creates a new session file by copying all entries on the
// active branch from sourcePath (from leafEntryID back to root). The new
// session is placed in the same project directory.
func CloneSessionFile(sessionsDir, sourcePath, leafEntryID string, now func() time.Time) (string, error) {
	return createBranchSessionFile(sessionsDir, sourcePath, leafEntryID, now, false)
}

func createBranchSessionFile(sessionsDir, sourcePath, targetEntryID string, now func() time.Time, isFork bool) (string, error) {
	if now == nil {
		now = time.Now
	}

	f, err := os.Open(sourcePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	var header map[string]any
	var entries []map[string]any
	seenSessionHeaders := make(map[string]bool)

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var raw map[string]any
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}
		if raw["type"] == "session" {
			key := sessionHeaderKey(raw)
			if key != "" && seenSessionHeaders[key] {
				continue
			}
			if key != "" {
				seenSessionHeaders[key] = true
			}
			header = raw
			continue
		}
		entries = append(entries, raw)
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}

	cwd, _ := header["cwd"].(string)
	if cwd == "" {
		return "", errors.New("source session missing cwd")
	}

	// Build by-id map
	byID := make(map[string]map[string]any)
	for _, e := range entries {
		if id, ok := e["id"].(string); ok && id != "" {
			byID[id] = e
		}
	}

	// Walk from target back to root
	var pathEntries []map[string]any
	currentID := targetEntryID
	for currentID != "" {
		entry, ok := byID[currentID]
		if !ok {
			break
		}
		pathEntries = append(pathEntries, entry)
		parentID, _ := entry["parentId"].(string)
		if parentID == "" || parentID == currentID {
			break
		}
		currentID = parentID
	}

	if len(pathEntries) == 0 {
		return "", errors.New("target entry not found")
	}

	// Reverse to chronological order (root → target)
	for i, j := 0, len(pathEntries)-1; i < j; i, j = i+1, j-1 {
		pathEntries[i], pathEntries[j] = pathEntries[j], pathEntries[i]
	}

	projectDir := filepath.Join(sessionsDir, EncodeProjectName(cwd))
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return "", err
	}

	id := randomUUID()
	timestamp := now().UTC().Format("2006-01-02T15-04-05.000Z")
	filename := timestamp + "_" + id + ".jsonl"
	filePath := filepath.Join(projectDir, filename)

	newHeader := map[string]any{
		"type":          "session",
		"version":       3,
		"id":            id,
		"timestamp":     now().UTC().Format(time.RFC3339Nano),
		"cwd":           cwd,
		"parentSession": sourcePath,
	}
	if isFork {
		newHeader["forkedFrom"] = targetEntryID
	}

	var fileData []byte
	hdata, err := json.Marshal(newHeader)
	if err != nil {
		return "", err
	}
	fileData = append(fileData, hdata...)
	fileData = append(fileData, '\n')

	for _, entry := range pathEntries {
		line, err := json.Marshal(entry)
		if err != nil {
			continue
		}
		fileData = append(fileData, line...)
		fileData = append(fileData, '\n')
	}

	if err := os.WriteFile(filePath, fileData, 0644); err != nil {
		return "", err
	}
	return filename, nil
}

func randomUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func randomEntryID() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return fmt.Sprintf("%x", b)
}
