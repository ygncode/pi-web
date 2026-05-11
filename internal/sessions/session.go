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
	ChatAvailable      bool
	ChatDisabledReason string
}

type Session struct {
	SessionSummary
	Header  map[string]any
	Entries []map[string]any
}

func LoadAll(dir string) ([]Session, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var sessions []Session
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
			path := filepath.Join(subDir, f.Name())
			sess, err := ParseFile(path, e.Name(), f.Name())
			if err != nil {
				continue
			}
			sessions = append(sessions, sess)
		}
	}

	SortByActivity(sessions)
	return sessions, nil
}

func SortByActivity(sessions []Session) {
	sort.Slice(sessions, func(i, j int) bool {
		ti, _ := time.Parse(time.RFC3339, sessions[i].LastActivity)
		tj, _ := time.Parse(time.RFC3339, sessions[j].LastActivity)
		return ti.After(tj)
	})
}

func SortSummariesByActivity(s []SessionSummary) {
	sort.Slice(s, func(i, j int) bool {
		ti, _ := time.Parse(time.RFC3339, s[i].LastActivity)
		tj, _ := time.Parse(time.RFC3339, s[j].LastActivity)
		return ti.After(tj)
	})
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
		if line == "" {
			continue
		}
		var raw map[string]any
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}
		if raw["type"] == "session" {
			if n, _ := raw["name"].(string); n != "" {
				headerName = n
			}
			if cwd, _ := raw["cwd"].(string); cwd != "" {
				headerCwd = cwd
			}
			if sid, _ := raw["id"].(string); sid != "" {
				s.SessionUUID = sid
			}
			continue
		}
		if raw["type"] == "session_info" {
			if n, _ := raw["name"].(string); n != "" {
				sessionInfoName = n
			}
			continue
		}
		if ts, ok := raw["timestamp"].(string); ok {
			s.LastActivity = ts
		}
		if raw["type"] == "message" {
			msg, ok := raw["message"].(map[string]any)
			if !ok {
				continue
			}
			s.MessageCount++
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
		if _, err := os.Stat(headerCwd); err != nil {
			s.ChatAvailable = false
			s.ChatDisabledReason = "This session can be viewed, but chat is disabled because its working directory no longer exists."
		}
	}

	return s, nil
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
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func ParseFile(path, dirName, fileName string) (Session, error) {
	summary, err := ParseSummary(path, dirName, fileName)
	if err != nil {
		return Session{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Session{}, err
	}
	sess := Session{SessionSummary: summary}
	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var raw map[string]any
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}
		sess.Entries = append(sess.Entries, raw)
		if raw["type"] == "session" {
			sess.Header = raw
		}
	}
	return sess, nil
}

func cleanProjectName(dirName string) string {
	s := strings.TrimPrefix(dirName, "--")
	s = strings.TrimSuffix(s, "--")
	s = strings.ReplaceAll(s, "--", "/")
	return s
}

func EncodeProjectName(path string) string {
	s := strings.TrimSpace(path)
	s = strings.Trim(s, "/")
	s = strings.ReplaceAll(s, "/", "-")
	return "--" + s + "--"
}

func DecodeProjectName(dirName string) string {
	s := strings.TrimPrefix(dirName, "--")
	s = strings.TrimSuffix(s, "--")
	s = strings.ReplaceAll(s, "-", "/")
	if s != "" && !strings.HasPrefix(s, "/") {
		s = "/" + s
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
		loc := DecodeProjectName(dir.name)
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

func CreateSessionFile(sessionsDir, path string) (string, error) {
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
	if err := os.WriteFile(filePath, append(data, '\n'), 0644); err != nil {
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
