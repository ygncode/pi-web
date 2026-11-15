package rpc

// Live progress for long-running tools (the subagent extension). pi emits
// tool_execution_update events with the tool's latest partial result; for
// subagent that is the full child transcript, so it is compacted here to what
// the browser card shows (agent, status, model, usage, last few items, final
// text) and throttled per tool call before being broadcast over SSE.

import (
	"encoding/json"
	"sync"
	"time"
)

// ToolProgress is broadcast as the "tool-progress" SSE event.
type ToolProgress struct {
	ToolCallID string          `json:"toolCallId"`
	ToolName   string          `json:"toolName"`
	Details    json.RawMessage `json:"details"`
}

const (
	toolProgressInterval = 400 * time.Millisecond
	progressTextLimit    = 4000
	progressTaskLimit    = 400
	progressItemsKept    = 6
)

// liveProgressTools lists tool names whose partial results are forwarded.
var liveProgressTools = map[string]bool{"subagent": true}

type toolProgressThrottle struct {
	mu   sync.Mutex
	last map[string]time.Time
	now  func() time.Time
}

func newToolProgressThrottle() *toolProgressThrottle {
	return &toolProgressThrottle{last: map[string]time.Time{}, now: time.Now}
}

func (t *toolProgressThrottle) allow(id string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	n := t.now()
	if prev, ok := t.last[id]; ok && n.Sub(prev) < toolProgressInterval {
		return false
	}
	t.last[id] = n
	if len(t.last) > 256 { // forget old calls
		for k, v := range t.last {
			if n.Sub(v) > time.Hour {
				delete(t.last, k)
			}
		}
	}
	return true
}

type progressItem struct {
	Kind string `json:"kind"` // "tool" | "text"
	Name string `json:"name,omitempty"`
	Text string `json:"text"`
}

type progressResult struct {
	Agent  string          `json:"agent"`
	Task   string          `json:"task"`
	Status string          `json:"status,omitempty"`
	Model  string          `json:"model,omitempty"`
	Step   int             `json:"step,omitempty"`
	Exit   *int            `json:"exitCode,omitempty"`
	Usage  json.RawMessage `json:"usage,omitempty"`
	Items  []progressItem  `json:"items,omitempty"`
	Output string          `json:"output,omitempty"`
	Error  string          `json:"errorMessage,omitempty"`
}

type progressDetails struct {
	Mode    string           `json:"mode"`
	Results []progressResult `json:"results"`
}

func clip(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func clipTail(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return "…" + string(r[len(r)-n:])
}

// compactSubagentDetails shrinks subagent partial details to a card summary.
func compactSubagentDetails(raw json.RawMessage) (json.RawMessage, bool) {
	var in struct {
		Mode    string `json:"mode"`
		Results []struct {
			Agent        string          `json:"agent"`
			Task         string          `json:"task"`
			Status       string          `json:"status"`
			Model        string          `json:"model"`
			Step         int             `json:"step"`
			ExitCode     *int            `json:"exitCode"`
			Usage        json.RawMessage `json:"usage"`
			ErrorMessage string          `json:"errorMessage"`
			Messages     []struct {
				Role    string `json:"role"`
				Content []struct {
					Type      string          `json:"type"`
					Text      string          `json:"text"`
					Name      string          `json:"name"`
					Arguments json.RawMessage `json:"arguments"`
				} `json:"content"`
			} `json:"messages"`
		} `json:"results"`
	}
	if err := json.Unmarshal(raw, &in); err != nil || len(in.Results) == 0 {
		return nil, false
	}
	out := progressDetails{Mode: in.Mode}
	for _, r := range in.Results {
		pr := progressResult{
			Agent: r.Agent, Task: clip(r.Task, progressTaskLimit), Status: r.Status,
			Model: r.Model, Step: r.Step, Exit: r.ExitCode, Usage: r.Usage,
			Error: clip(r.ErrorMessage, 600),
		}
		var items []progressItem
		for _, m := range r.Messages {
			if m.Role != "assistant" {
				continue
			}
			for _, c := range m.Content {
				switch c.Type {
				case "toolCall":
					items = append(items, progressItem{Kind: "tool", Name: c.Name, Text: clip(string(c.Arguments), 160)})
				case "text":
					if c.Text != "" {
						items = append(items, progressItem{Kind: "text", Text: clip(c.Text, 240)})
						pr.Output = c.Text
					}
				}
			}
		}
		if len(items) > progressItemsKept {
			items = items[len(items)-progressItemsKept:]
		}
		pr.Items = items
		pr.Output = clipTail(pr.Output, progressTextLimit)
		out.Results = append(out.Results, pr)
	}
	b, err := json.Marshal(out)
	if err != nil {
		return nil, false
	}
	return b, true
}

// parseToolProgress turns a tool_execution_update RPC line into a broadcastable
// progress event (nil when the tool isn't tracked or the payload is unusable).
func parseToolProgress(line string) *ToolProgress {
	var ev struct {
		ToolCallID    string `json:"toolCallId"`
		ToolName      string `json:"toolName"`
		PartialResult struct {
			Details json.RawMessage `json:"details"`
		} `json:"partialResult"`
	}
	if err := json.Unmarshal([]byte(line), &ev); err != nil {
		return nil
	}
	if ev.ToolCallID == "" || !liveProgressTools[ev.ToolName] {
		return nil
	}
	d, ok := compactSubagentDetails(ev.PartialResult.Details)
	if !ok {
		return nil
	}
	return &ToolProgress{ToolCallID: ev.ToolCallID, ToolName: ev.ToolName, Details: d}
}
