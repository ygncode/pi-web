package rpc

import (
	"bytes"
	"context"
	"io"
	"strings"
	"testing"
	"time"

	"pi-web/internal/workers"
)

type nopWriteCloser struct{ w io.Writer }

func (n nopWriteCloser) Write(p []byte) (int, error) { return n.w.Write(p) }
func (n nopWriteCloser) Close() error                { return nil }

func waitForPending(t *testing.T, w *piRPCWorker, id string) {
	t.Helper()
	for i := 0; i < 1000; i++ {
		w.mu.Lock()
		_, ok := w.pending[id]
		w.mu.Unlock()
		if ok {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("pending request %q never registered", id)
}

func TestStatusReportsRunningDuringRecentStreamActivity(t *testing.T) {
	w := &piRPCWorker{
		status:  workers.WorkerStatus{State: workers.WorkerStateIdle},
		pending: make(map[string]chan response),
	}

	w.handleRPCLine(`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"hello"}}`)

	if got := w.Status(); got.State != workers.WorkerStateRunning {
		t.Fatalf("status = %q, want running", got.State)
	}
}

func TestStatusReturnsIdleAfterAgentEnd(t *testing.T) {
	w := &piRPCWorker{
		status:  workers.WorkerStatus{State: workers.WorkerStateRunning},
		pending: make(map[string]chan response),
	}

	w.handleRPCLine(`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"hello"}}`)
	w.handleRPCLine(`{"type":"agent_end"}`)

	if got := w.Status(); got.State != workers.WorkerStateIdle {
		t.Fatalf("status = %q, want idle", got.State)
	}
}

func TestStatusDoesNotStayRunningAfterStreamActivityExpires(t *testing.T) {
	w := &piRPCWorker{
		status:  workers.WorkerStatus{State: workers.WorkerStateIdle},
		pending: make(map[string]chan response),
	}

	w.handleRPCLine(`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"hello"}}`)
	time.Sleep(2200 * time.Millisecond)

	if got := w.Status(); got.State != workers.WorkerStateIdle {
		t.Fatalf("status = %q, want idle after stream activity expires", got.State)
	}
}

func TestHandleRPCLineTracksTurnEndAsStreamActivity(t *testing.T) {
	w := &piRPCWorker{
		status:  workers.WorkerStatus{State: workers.WorkerStateIdle},
		pending: make(map[string]chan response),
	}

	w.handleRPCLine(`{"type":"turn_end"}`)

	if got := w.Status(); got.State != workers.WorkerStateRunning {
		t.Fatalf("status = %q, want running", got.State)
	}
}

func TestHandleRPCLineEmitsStreamPreviewCallbacks(t *testing.T) {
	var previews []StreamPreview
	w := &piRPCWorker{
		status:        workers.WorkerStatus{State: workers.WorkerStateIdle},
		pending:       make(map[string]chan response),
		streamSink:    func(preview StreamPreview) { previews = append(previews, preview) },
		streamPreview: &streamPreviewAccumulator{},
	}

	w.handleRPCLine(`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"hel"}}`)
	w.handleRPCLine(`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"lo"}}`)

	if len(previews) != 2 {
		t.Fatalf("previews = %d, want 2", len(previews))
	}
	if previews[0].Content != "hel" || previews[0].Done {
		t.Fatalf("first preview = %+v", previews[0])
	}
	if previews[1].Content != "hello" || previews[1].Done {
		t.Fatalf("second preview = %+v", previews[1])
	}
}

func TestHandleRPCLineEmitsDonePreviewOnAgentEnd(t *testing.T) {
	var previews []StreamPreview
	w := &piRPCWorker{
		status:        workers.WorkerStatus{State: workers.WorkerStateIdle},
		pending:       make(map[string]chan response),
		streamSink:    func(preview StreamPreview) { previews = append(previews, preview) },
		streamPreview: &streamPreviewAccumulator{},
	}

	w.handleRPCLine(`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"hello"}}`)
	w.handleRPCLine(`{"type":"agent_end"}`)

	if len(previews) != 2 {
		t.Fatalf("previews = %d, want 2", len(previews))
	}
	if previews[1].Content != "hello" || !previews[1].Done {
		t.Fatalf("done preview = %+v", previews[1])
	}
}

func TestHandleRPCLineTracksMessageEndAsStreamActivity(t *testing.T) {
	w := &piRPCWorker{
		status:  workers.WorkerStatus{State: workers.WorkerStateIdle},
		pending: make(map[string]chan response),
	}

	w.handleRPCLine(`{"type":"message_end"}`)

	if got := w.Status(); got.State != workers.WorkerStateRunning {
		t.Fatalf("status = %q, want running", got.State)
	}
}

func TestGetCommandsReturnsCachedWithoutRPC(t *testing.T) {
	w := &piRPCWorker{
		pending:        make(map[string]chan response),
		commands:       []workers.SlashCommand{{Name: "skill:memory", Source: "skill"}},
		commandsCached: true,
	}
	// stdin is nil: the cache path must not attempt any RPC write.
	got, err := w.GetCommands(context.Background())
	if err != nil {
		t.Fatalf("GetCommands error: %v", err)
	}
	if len(got) != 1 || got[0].Name != "skill:memory" {
		t.Fatalf("got = %#v", got)
	}
}

func TestGetCommandsParsesResponseAndCaches(t *testing.T) {
	var buf bytes.Buffer
	w := &piRPCWorker{
		stdin:   nopWriteCloser{&buf},
		pending: make(map[string]chan response),
	}

	type result struct {
		cmds []workers.SlashCommand
		err  error
	}
	resCh := make(chan result, 1)
	go func() {
		cmds, err := w.GetCommands(context.Background())
		resCh <- result{cmds, err}
	}()

	waitForPending(t, w, "req-1")
	w.handleRPCLine(`{"type":"response","id":"req-1","command":"get_commands","success":true,"data":{"commands":[{"name":"skill:memory","description":"mem","source":"skill"},{"name":"btw","description":"side chat","source":"extension"}]}}`)

	got := <-resCh
	if got.err != nil {
		t.Fatalf("GetCommands error: %v", got.err)
	}
	if len(got.cmds) != 2 {
		t.Fatalf("commands = %#v", got.cmds)
	}
	if got.cmds[0].Name != "skill:memory" || got.cmds[0].Source != "skill" || got.cmds[0].Description != "mem" {
		t.Fatalf("first command = %#v", got.cmds[0])
	}

	// Second call must hit the cache: no further RPC write to stdin.
	buf.Reset()
	cached, err := w.GetCommands(context.Background())
	if err != nil {
		t.Fatalf("cached GetCommands error: %v", err)
	}
	if len(cached) != 2 {
		t.Fatalf("cached commands = %#v", cached)
	}
	if buf.Len() != 0 {
		t.Fatalf("cache hit wrote to stdin: %q", buf.String())
	}
}

func TestHandleRPCLineIgnoresMalformedJSON(t *testing.T) {
	w := &piRPCWorker{
		status:  workers.WorkerStatus{State: workers.WorkerStateIdle},
		pending: make(map[string]chan response),
	}

	w.handleRPCLine(`{not-json}`)

	if got := w.Status(); got.State != workers.WorkerStateIdle {
		t.Fatalf("status = %q, want idle", got.State)
	}
}

func TestHandleRPCLineTracksThinkingAndTextStreamEvents(t *testing.T) {
	w := &piRPCWorker{
		status:  workers.WorkerStatus{State: workers.WorkerStateIdle},
		pending: make(map[string]chan response),
	}

	for _, line := range []string{
		`{"type":"message_update","assistantMessageEvent":{"type":"thinking_end"}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"text_start"}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"text_end","content":"done"}}`,
	} {
		w.handleRPCLine(line)
		if got := w.Status(); got.State != workers.WorkerStateRunning {
			t.Fatalf("line %s => status = %q, want running", strings.TrimSpace(line), got.State)
		}
	}
}
