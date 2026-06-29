package workers

import (
	"context"
	"sync"
	"testing"
	"time"

	"pi-web/internal/chat"
)

type fakeChatWorker struct {
	mu              sync.Mutex
	streaming       bool
	prompts         []map[string]any
	commands        []SlashCommand
	getCommandsCall int
}

func (f *fakeChatWorker) Prompt(ctx context.Context, chat chat.Request) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	cmd := map[string]any{"id": "test", "type": "prompt", "message": chat.Message}
	if f.streaming {
		cmd["streamingBehavior"] = "steer"
	}
	f.prompts = append(f.prompts, cmd)
	f.streaming = true
	return nil
}

func (f *fakeChatWorker) Compact(ctx context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.prompts = append(f.prompts, map[string]any{"id": "test", "type": "compact"})
	return nil
}

func (f *fakeChatWorker) Status() WorkerStatus {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.streaming {
		return WorkerStatus{State: WorkerStateRunning}
	}
	return WorkerStatus{State: WorkerStateIdle}
}

func (f *fakeChatWorker) SetModel(ctx context.Context, provider, modelID string) error { return nil }

func (f *fakeChatWorker) SetThinkingLevel(ctx context.Context, level string) error { return nil }
func (f *fakeChatWorker) Abort(ctx context.Context) error                          { return nil }

func (f *fakeChatWorker) GetState(ctx context.Context) (WorkerStatus, error) {
	return f.Status(), nil
}

func (f *fakeChatWorker) GetCommands(ctx context.Context) ([]SlashCommand, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.getCommandsCall++
	return f.commands, nil
}

func (f *fakeChatWorker) Close() error { return nil }

func TestManagerCreatesOneWorkerPerSession(t *testing.T) {
	created := 0
	manager := NewManager(func(sessionID, sessionPath string) (ChatWorker, error) {
		created++
		return &fakeChatWorker{}, nil
	})
	ctx := context.Background()
	if err := manager.Send(ctx, "a.jsonl", "/tmp/a.jsonl", chat.Request{Message: "a"}); err != nil {
		t.Fatal(err)
	}
	if err := manager.Send(ctx, "b.jsonl", "/tmp/b.jsonl", chat.Request{Message: "b"}); err != nil {
		t.Fatal(err)
	}
	if err := manager.Send(ctx, "a.jsonl", "/tmp/a.jsonl", chat.Request{Message: "again"}); err != nil {
		t.Fatal(err)
	}
	if created != 2 {
		t.Fatalf("created workers = %d, want 2", created)
	}
}

func TestManagerGetCommandsPeeksWithoutSpawning(t *testing.T) {
	created := 0
	manager := NewManager(func(string, string) (ChatWorker, error) {
		created++
		return &fakeChatWorker{}, nil
	})
	cmds, ready, err := manager.GetCommands(context.Background(), "missing.jsonl")
	if err != nil {
		t.Fatalf("GetCommands error: %v", err)
	}
	if ready {
		t.Fatalf("ready = true, want false when no worker exists")
	}
	if len(cmds) != 0 {
		t.Fatalf("commands = %#v, want none", cmds)
	}
	if created != 0 {
		t.Fatalf("created = %d, want 0 (peek must not spawn)", created)
	}
}

func TestManagerGetCommandsReturnsWorkerCommands(t *testing.T) {
	worker := &fakeChatWorker{commands: []SlashCommand{{Name: "skill:memory", Source: "skill"}}}
	manager := NewManager(func(string, string) (ChatWorker, error) { return worker, nil })
	if err := manager.EnsureWorker(context.Background(), "a.jsonl", "/tmp/a.jsonl"); err != nil {
		t.Fatal(err)
	}
	cmds, ready, err := manager.GetCommands(context.Background(), "a.jsonl")
	if err != nil {
		t.Fatalf("GetCommands error: %v", err)
	}
	if !ready {
		t.Fatalf("ready = false, want true when worker exists")
	}
	if len(cmds) != 1 || cmds[0].Name != "skill:memory" {
		t.Fatalf("commands = %#v", cmds)
	}
}

func TestManagerReportsMissingWorkerIdle(t *testing.T) {
	manager := NewManager(func(sessionID, sessionPath string) (ChatWorker, error) { return &fakeChatWorker{}, nil })
	status := manager.Status("missing.jsonl")
	if status.State != WorkerStateIdle {
		t.Fatalf("status = %q, want idle", status.State)
	}
}

func TestManagerEvictsErroredWorker(t *testing.T) {
	created := 0
	factory := func(sessionID, sessionPath string) (ChatWorker, error) {
		created++
		return &fakeChatWorker{}, nil
	}
	manager := NewManager(factory)
	ctx := context.Background()
	if err := manager.Send(ctx, "a.jsonl", "/tmp/a.jsonl", chat.Request{Message: "a"}); err != nil {
		t.Fatal(err)
	}
	// Force the existing worker into an error state.
	manager.mu.Lock()
	dead := manager.workers["a.jsonl"].(*fakeChatWorker)
	manager.mu.Unlock()
	dead.mu.Lock()
	dead.streaming = false
	dead.mu.Unlock()
	// Replace its Status by swapping in a wrapper that reports error.
	manager.mu.Lock()
	manager.workers["a.jsonl"] = erroredWorker{}
	manager.mu.Unlock()

	if err := manager.Send(ctx, "a.jsonl", "/tmp/a.jsonl", chat.Request{Message: "retry"}); err != nil {
		t.Fatal(err)
	}
	if created != 2 {
		t.Fatalf("created workers = %d, want 2 (errored worker should be replaced)", created)
	}
}

// reapableWorker implements idleReportable so the reaper will evict it once
// it has been idle longer than the manager's TTL.
type reapableWorker struct {
	idleFor time.Duration
	closed  bool
}

func (r *reapableWorker) Prompt(ctx context.Context, chat chat.Request) error          { return nil }
func (r *reapableWorker) Compact(ctx context.Context) error                            { return nil }
func (r *reapableWorker) SetModel(ctx context.Context, provider, modelID string) error { return nil }
func (r *reapableWorker) SetThinkingLevel(ctx context.Context, level string) error     { return nil }
func (r *reapableWorker) Abort(ctx context.Context) error                              { return nil }
func (r *reapableWorker) GetState(ctx context.Context) (WorkerStatus, error)           { return r.Status(), nil }
func (r *reapableWorker) GetCommands(ctx context.Context) ([]SlashCommand, error)      { return nil, nil }
func (r *reapableWorker) Status() WorkerStatus                                         { return WorkerStatus{State: WorkerStateIdle} }
func (r *reapableWorker) Close() error                                                 { r.closed = true; return nil }
func (r *reapableWorker) IdleSince(now time.Time) time.Duration                        { return r.idleFor }

func TestManagerReapsIdleWorkersBeyondTTL(t *testing.T) {
	w := &reapableWorker{idleFor: time.Hour}
	manager := NewManagerWithTTL(func(string, string) (ChatWorker, error) { return w, nil }, time.Minute)
	defer manager.Close()
	if err := manager.Send(context.Background(), "a.jsonl", "/tmp/a.jsonl", chat.Request{Message: "hi"}); err != nil {
		t.Fatal(err)
	}
	manager.reapOnce(time.Now())
	manager.mu.Lock()
	_, present := manager.workers["a.jsonl"]
	manager.mu.Unlock()
	if present {
		t.Fatalf("worker should have been reaped")
	}
	if !w.closed {
		t.Fatalf("reaped worker should have been Closed")
	}
}

func TestManagerKeepsFreshWorker(t *testing.T) {
	w := &reapableWorker{idleFor: time.Second}
	manager := NewManagerWithTTL(func(string, string) (ChatWorker, error) { return w, nil }, time.Minute)
	defer manager.Close()
	if err := manager.Send(context.Background(), "a.jsonl", "/tmp/a.jsonl", chat.Request{Message: "hi"}); err != nil {
		t.Fatal(err)
	}
	manager.reapOnce(time.Now())
	manager.mu.Lock()
	_, present := manager.workers["a.jsonl"]
	manager.mu.Unlock()
	if !present {
		t.Fatalf("fresh worker should not be reaped")
	}
}

func TestManagerDoesNotReapRunningWorker(t *testing.T) {
	// streaming=true → Status reports running, so reap should skip even if idle for > TTL.
	w := &runningReapable{}
	manager := NewManagerWithTTL(func(string, string) (ChatWorker, error) { return w, nil }, time.Minute)
	defer manager.Close()
	if err := manager.Send(context.Background(), "a.jsonl", "/tmp/a.jsonl", chat.Request{Message: "hi"}); err != nil {
		t.Fatal(err)
	}
	manager.reapOnce(time.Now())
	manager.mu.Lock()
	_, present := manager.workers["a.jsonl"]
	manager.mu.Unlock()
	if !present {
		t.Fatalf("running worker should not be reaped")
	}
}

type runningReapable struct{}

func (runningReapable) Prompt(ctx context.Context, chat chat.Request) error          { return nil }
func (runningReapable) Compact(ctx context.Context) error                            { return nil }
func (runningReapable) SetModel(ctx context.Context, provider, modelID string) error { return nil }
func (runningReapable) SetThinkingLevel(ctx context.Context, level string) error     { return nil }
func (runningReapable) Abort(ctx context.Context) error                              { return nil }
func (runningReapable) GetState(ctx context.Context) (WorkerStatus, error) {
	return WorkerStatus{State: WorkerStateRunning}, nil
}
func (runningReapable) GetCommands(ctx context.Context) ([]SlashCommand, error) { return nil, nil }
func (runningReapable) Status() WorkerStatus                  { return WorkerStatus{State: WorkerStateRunning} }
func (runningReapable) Close() error                          { return nil }
func (runningReapable) IdleSince(now time.Time) time.Duration { return time.Hour }

type erroredWorker struct{}

func (erroredWorker) Prompt(ctx context.Context, chat chat.Request) error          { return nil }
func (erroredWorker) Compact(ctx context.Context) error                            { return nil }
func (erroredWorker) SetModel(ctx context.Context, provider, modelID string) error { return nil }
func (erroredWorker) SetThinkingLevel(ctx context.Context, level string) error     { return nil }
func (erroredWorker) Abort(ctx context.Context) error                              { return nil }
func (erroredWorker) GetState(ctx context.Context) (WorkerStatus, error) {
	return WorkerStatus{State: WorkerStateError}, nil
}
func (erroredWorker) GetCommands(ctx context.Context) ([]SlashCommand, error) { return nil, nil }
func (erroredWorker) Status() WorkerStatus {
	return WorkerStatus{State: WorkerStateError, Error: "dead"}
}
func (erroredWorker) Close() error { return nil }

// inspectableWorker implements the optional inspector interface so Snapshot can
// surface PID, uptime, and idle duration.
type inspectableWorker struct {
	pid       int
	startedAt time.Time
	idleFor   time.Duration
	status    WorkerStatus
}

func (w *inspectableWorker) Prompt(context.Context, chat.Request) error    { return nil }
func (w *inspectableWorker) Compact(context.Context) error                 { return nil }
func (w *inspectableWorker) SetModel(context.Context, string, string) error { return nil }
func (w *inspectableWorker) SetThinkingLevel(context.Context, string) error { return nil }
func (w *inspectableWorker) Abort(context.Context) error                    { return nil }
func (w *inspectableWorker) GetState(context.Context) (WorkerStatus, error) { return w.status, nil }
func (w *inspectableWorker) GetCommands(context.Context) ([]SlashCommand, error) {
	return nil, nil
}
func (w *inspectableWorker) Status() WorkerStatus                  { return w.status }
func (w *inspectableWorker) Close() error                          { return nil }
func (w *inspectableWorker) PID() int                              { return w.pid }
func (w *inspectableWorker) StartedAt() time.Time                  { return w.startedAt }
func (w *inspectableWorker) IdleSince(now time.Time) time.Duration { return w.idleFor }

func TestManagerSnapshotEmptyWhenNoWorkers(t *testing.T) {
	manager := NewManager(func(string, string) (ChatWorker, error) { return &fakeChatWorker{}, nil })
	if snaps := manager.Snapshot(); len(snaps) != 0 {
		t.Fatalf("Snapshot() = %#v, want empty", snaps)
	}
}

func TestManagerSnapshotReportsInspectorFields(t *testing.T) {
	w := &inspectableWorker{
		pid:       4242,
		startedAt: time.Now().Add(-90 * time.Second),
		idleFor:   30 * time.Second,
		status:    WorkerStatus{State: WorkerStateIdle, Model: "claude-opus"},
	}
	manager := NewManager(func(string, string) (ChatWorker, error) { return w, nil })
	if err := manager.EnsureWorker(context.Background(), "a.jsonl", "/tmp/a.jsonl"); err != nil {
		t.Fatal(err)
	}
	snaps := manager.Snapshot()
	if len(snaps) != 1 {
		t.Fatalf("Snapshot() len = %d, want 1", len(snaps))
	}
	s := snaps[0]
	if s.SessionID != "a.jsonl" {
		t.Errorf("SessionID = %q, want a.jsonl", s.SessionID)
	}
	if s.PID != 4242 {
		t.Errorf("PID = %d, want 4242", s.PID)
	}
	if s.State != WorkerStateIdle {
		t.Errorf("State = %q, want idle", s.State)
	}
	if s.Model != "claude-opus" {
		t.Errorf("Model = %q, want claude-opus", s.Model)
	}
	if s.UptimeS < 80 || s.UptimeS > 120 {
		t.Errorf("UptimeS = %v, want ~90", s.UptimeS)
	}
	if s.IdleForS < 29 || s.IdleForS > 31 {
		t.Errorf("IdleForS = %v, want ~30", s.IdleForS)
	}
}

func TestManagerSnapshotHandlesNonInspectableWorker(t *testing.T) {
	manager := NewManager(func(string, string) (ChatWorker, error) {
		return &fakeChatWorker{}, nil
	})
	if err := manager.EnsureWorker(context.Background(), "a.jsonl", "/tmp/a.jsonl"); err != nil {
		t.Fatal(err)
	}
	snaps := manager.Snapshot()
	if len(snaps) != 1 {
		t.Fatalf("Snapshot() len = %d, want 1", len(snaps))
	}
	if snaps[0].PID != 0 || snaps[0].UptimeS != 0 {
		t.Errorf("non-inspectable worker should report zero PID/uptime, got %#v", snaps[0])
	}
}

func TestBusyWorkerUsesSteeringCommand(t *testing.T) {
	worker := &fakeChatWorker{streaming: true}
	manager := NewManager(func(sessionID, sessionPath string) (ChatWorker, error) { return worker, nil })
	if err := manager.Send(context.Background(), "a.jsonl", "/tmp/a.jsonl", chat.Request{Message: "steer"}); err != nil {
		t.Fatal(err)
	}
	worker.mu.Lock()
	defer worker.mu.Unlock()
	if len(worker.prompts) != 1 {
		t.Fatalf("prompts = %d, want 1", len(worker.prompts))
	}
	if worker.prompts[0]["streamingBehavior"] != "steer" {
		t.Fatalf("streamingBehavior = %v, want steer", worker.prompts[0]["streamingBehavior"])
	}
}

func TestManagerFactoryReceivesSessionIDAndPath(t *testing.T) {
	var gotID, gotPath string
	manager := NewManager(func(sessionID, sessionPath string) (ChatWorker, error) {
		gotID = sessionID
		gotPath = sessionPath
		return &fakeChatWorker{}, nil
	})

	if err := manager.EnsureWorker(context.Background(), "a.jsonl", "/tmp/a.jsonl"); err != nil {
		t.Fatal(err)
	}
	if gotID != "a.jsonl" || gotPath != "/tmp/a.jsonl" {
		t.Fatalf("factory got id=%q path=%q, want a.jsonl /tmp/a.jsonl", gotID, gotPath)
	}
}

func TestEnsureWorkerCreatesWorkerWithoutSendingMessage(t *testing.T) {
	created := 0
	manager := NewManager(func(sessionID, sessionPath string) (ChatWorker, error) {
		created++
		return &fakeChatWorker{}, nil
	})
	ctx := context.Background()
	if err := manager.EnsureWorker(ctx, "a.jsonl", "/tmp/a.jsonl"); err != nil {
		t.Fatal(err)
	}
	if created != 1 {
		t.Fatalf("created workers = %d, want 1", created)
	}
	status := manager.Status("a.jsonl")
	if status.State != WorkerStateIdle {
		t.Fatalf("status = %q, want idle", status.State)
	}
}
