package sessions

import (
	"bufio"
	"encoding/json"
	"os"
	"strings"
)

// TitleInputs is the subset of a session's state the auto-titler needs to
// decide whether (and how) to generate a title.
type TitleInputs struct {
	// FirstUserText is the raw text of the first user message (used for
	// title-once mode).
	FirstUserText string
	// LastUserText is the raw text of the most recent user message (used for
	// each-turn mode, where the title tracks the current focus).
	LastUserText string
	// CurrentName is the latest explicit display name (session_info or header),
	// or "" when the session has never been explicitly named.
	CurrentName string
	// HasExplicitName reports whether a session_info or header name is present.
	// A session whose name is only derived from the first message / filename has
	// no explicit name.
	HasExplicitName bool
	// AutoTitled reports whether the current name was written by pi-web's
	// auto-titler (marked session_info), as opposed to a user rename or header
	// name. Lets titling survive restarts without clobbering user-set names.
	AutoTitled bool
	// UserMsgCount is the number of user messages seen, used to detect new turns
	// for re-titling.
	UserMsgCount int
}

// ReadTitleInputs scans a session JSONL file for the auto-titler's inputs. It
// mirrors ParseSummary's name precedence (session_info over header) but only
// collects what titling needs, so it stays cheap on the watcher hot path.
func ReadTitleInputs(path string) (TitleInputs, error) {
	f, err := os.Open(path)
	if err != nil {
		return TitleInputs{}, err
	}
	defer f.Close()

	var out TitleInputs
	var headerName, sessionInfoName string
	var sessionInfoAuto bool

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 256*1024*1024)
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
		case "session_info":
			if raw.Name != "" {
				sessionInfoName = raw.Name
				sessionInfoAuto = raw.AutoTitle
			}
		case "message":
			if raw.Message == nil || raw.Message.Role != "user" {
				continue
			}
			out.UserMsgCount++
			text := extractRawText(raw.Message.Content)
			if out.FirstUserText == "" {
				out.FirstUserText = text
			}
			if text != "" {
				out.LastUserText = text
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return TitleInputs{}, err
	}

	switch {
	case sessionInfoName != "":
		out.CurrentName = sessionInfoName
		out.HasExplicitName = true
		out.AutoTitled = sessionInfoAuto
	case headerName != "":
		out.CurrentName = headerName
		out.HasExplicitName = true
	}
	return out, nil
}
