package rpc

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestParseToolProgressCompactsSubagent(t *testing.T) {
	long := strings.Repeat("x", 9000)
	line := `{"type":"tool_execution_update","toolCallId":"c1","toolName":"subagent","partialResult":{"content":[],"details":{"mode":"parallel","results":[` +
		`{"agent":"scout","task":"find models","status":"running","model":"router/glm-5.3","messages":[{"role":"assistant","content":[{"type":"toolCall","name":"grep","arguments":{"pattern":"model"}},{"type":"text","text":"` + long + `"}]}]},` +
		`{"agent":"scout","task":"find providers","status":"pending","messages":[]}]}}}`
	tp := parseToolProgress(line)
	if tp == nil {
		t.Fatal("expected progress")
	}
	if tp.ToolCallID != "c1" || tp.ToolName != "subagent" {
		t.Fatalf("bad ids: %+v", tp)
	}
	var d progressDetails
	if err := json.Unmarshal(tp.Details, &d); err != nil {
		t.Fatal(err)
	}
	if d.Mode != "parallel" || len(d.Results) != 2 {
		t.Fatalf("bad details: %+v", d)
	}
	r := d.Results[0]
	if r.Status != "running" || r.Model != "router/glm-5.3" || len(r.Items) != 2 || r.Items[0].Name != "grep" {
		t.Fatalf("bad result: %+v", r)
	}
	if n := len([]rune(r.Output)); n > progressTextLimit+1 {
		t.Fatalf("output not clipped: %d", n)
	}
	if len(tp.Details) > 8000 {
		t.Fatalf("details too large: %d", len(tp.Details))
	}
}

func TestParseToolProgressIgnoresOtherTools(t *testing.T) {
	if parseToolProgress(`{"type":"tool_execution_update","toolCallId":"c","toolName":"bash","partialResult":{"details":{}}}`) != nil {
		t.Fatal("bash must not be forwarded")
	}
	if parseToolProgress(`not json`) != nil {
		t.Fatal("garbage must be ignored")
	}
}

func TestToolProgressThrottle(t *testing.T) {
	th := newToolProgressThrottle()
	now := time.Unix(0, 0)
	th.now = func() time.Time { return now }
	if !th.allow("a") || th.allow("a") {
		t.Fatal("second immediate update must be throttled")
	}
	if !th.allow("b") {
		t.Fatal("other calls are independent")
	}
	now = now.Add(toolProgressInterval)
	if !th.allow("a") {
		t.Fatal("allowed after interval")
	}
}
