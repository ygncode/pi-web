package server

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pi-web/internal/chat"
	"pi-web/internal/sessions"
	"pi-web/internal/workers"
)

type fakeSender struct {
	sessionID               string
	sessionPath             string
	chat                    chat.Request
	state                   workers.WorkerStatus
	status                  workers.WorkerStatus
	getStateCalls           int
	getStateErr             error
	ensureWorkerCalled      bool
	ensureWorkerSessionID   string
	ensureWorkerSessionPath string
	ensureWorkerCh          chan struct{}
	setModelSessionID       string
	setModelProvider        string
	setModelID              string
	setThinkingSessionID    string
	setThinkingLevel        string
	sendCh                  chan struct{}
	commands                []workers.SlashCommand
	commandsReady           bool
	commandsErr             error
	getCommandsCalls        int
}

func (f *fakeSender) Send(ctx context.Context, sessionID, sessionPath string, chat chat.Request) error {
	f.sessionID = sessionID
	f.sessionPath = sessionPath
	f.chat = chat
	if f.sendCh != nil {
		f.sendCh <- struct{}{}
	}
	return nil
}

func (f *fakeSender) SetModel(ctx context.Context, sessionID, sessionPath, provider, modelID string) error {
	f.setModelSessionID = sessionID
	f.setModelProvider = provider
	f.setModelID = modelID
	return nil
}

func (f *fakeSender) SetThinkingLevel(ctx context.Context, sessionID, sessionPath, level string) error {
	f.setThinkingSessionID = sessionID
	f.setThinkingLevel = level
	return nil
}

func (f *fakeSender) Abort(ctx context.Context, sessionID string) error {
	return nil
}

func (f *fakeSender) GetState(ctx context.Context, sessionID string) (workers.WorkerStatus, error) {
	f.getStateCalls++
	if f.getStateErr != nil {
		return workers.WorkerStatus{}, f.getStateErr
	}
	if f.state.State != "" || f.state.ThinkingLevel != "" || f.state.Model != "" || f.state.ModelProvider != "" {
		return f.state, nil
	}
	return workers.WorkerStatus{State: workers.WorkerStateIdle}, nil
}

func (f *fakeSender) GetCommands(ctx context.Context, sessionID string) ([]workers.SlashCommand, bool, error) {
	f.getCommandsCalls++
	return f.commands, f.commandsReady, f.commandsErr
}

func (f *fakeSender) Status(sessionID string) workers.WorkerStatus {
	if f.status.State != "" || f.status.ThinkingLevel != "" || f.status.Model != "" || f.status.ModelProvider != "" {
		return f.status
	}
	return workers.WorkerStatus{State: workers.WorkerStateIdle}
}

func (f *fakeSender) EnsureWorker(ctx context.Context, sessionID, sessionPath string) error {
	f.ensureWorkerCalled = true
	f.ensureWorkerSessionID = sessionID
	f.ensureWorkerSessionPath = sessionPath
	if f.ensureWorkerCh != nil {
		f.ensureWorkerCh <- struct{}{}
	}
	return nil
}

func TestHandleChatQueuesResolvedSession(t *testing.T) {
	root := t.TempDir()
	wantPath := writeSessionFile(t, root, "--tmp--project--", "session.jsonl")
	fake := &fakeSender{sendCh: make(chan struct{}, 1)}
	s := &Server{sessionsDir: root, chatSender: fake}
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	mw.WriteField("message", "hello")
	mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/chat?id=session.jsonl", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	s.handleChat(w, req)
	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	var got map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["status"] != "queued" {
		t.Fatalf("status body = %#v, want queued", got)
	}
	select {
	case <-fake.sendCh:
	case <-time.After(time.Second):
		t.Fatal("Send was not called asynchronously")
	}
	if fake.sessionID != "session.jsonl" || fake.sessionPath != wantPath || fake.chat.Message != "hello" {
		t.Fatalf("fake = %#v, want path %q", fake, wantPath)
	}
}

func TestHandleChatRejectsUnknownSession(t *testing.T) {
	s := &Server{sessionsDir: t.TempDir(), chatSender: &fakeSender{}}
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	mw.WriteField("message", "hello")
	mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/chat?id=missing.jsonl", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	s.handleChat(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
}

func TestHandleChatRejectsBrokenSession(t *testing.T) {
	root := t.TempDir()
	dir := root + "/--tmp-project--"
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(dir+"/session.jsonl", []byte("{\"type\":\"session\",\"version\":3,\"id\":\"sid\",\"timestamp\":\"2026-05-06T00:00:00.000Z\",\"cwd\":\"/definitely/missing/path\"}\n"), 0644); err != nil {
		t.Fatal(err)
	}
	s := &Server{sessionsDir: root, chatSender: &fakeSender{}}
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	mw.WriteField("message", "hello")
	mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/chat?id=session.jsonl", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	s.handleChat(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409; body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "working directory no longer exists") {
		t.Fatalf("body = %q", w.Body.String())
	}
}

func TestHandleWorkerStatusDefaultsIdle(t *testing.T) {
	s := &Server{sessionsDir: t.TempDir(), chatSender: &fakeSender{}}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id=session.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleWorkerStatus(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); got != "{\"state\":\"idle\"}\n" {
		t.Fatalf("body = %q", got)
	}
}

func TestHandleWorkerStatusUsesRecentSessionFileActivity(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	now := time.Date(2026, 5, 7, 21, 0, 0, 0, time.UTC)
	s := &Server{
		sessionsDir: root,
		chatSender:  &fakeSender{},
		fileMod:     map[string]time.Time{"session.jsonl": now.Add(-400 * time.Millisecond)},
		now:         func() time.Time { return now },
	}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id=session.jsonl", nil)
	w := httptest.NewRecorder()

	s.handleWorkerStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); got != "{\"state\":\"running\"}\n" {
		t.Fatalf("body = %q", got)
	}
}

func TestHandleWorkerStatusIgnoresStaleSessionFileActivity(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	now := time.Date(2026, 5, 7, 21, 0, 0, 0, time.UTC)
	s := &Server{
		sessionsDir: root,
		chatSender:  &fakeSender{},
		fileMod:     map[string]time.Time{"session.jsonl": now.Add(-10 * time.Second)},
		now:         func() time.Time { return now },
	}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id=session.jsonl", nil)
	w := httptest.NewRecorder()

	s.handleWorkerStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); got != "{\"state\":\"idle\"}\n" {
		t.Fatalf("body = %q", got)
	}
}

func TestHandleWorkerStatusSkipsGetStateWhenLocalStatusRunning(t *testing.T) {
	sender := &fakeSender{status: workers.WorkerStatus{State: workers.WorkerStateRunning}}
	s := &Server{sessionsDir: t.TempDir(), chatSender: sender}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id=session.jsonl", nil)
	w := httptest.NewRecorder()

	s.handleWorkerStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if sender.getStateCalls != 0 {
		t.Fatalf("GetState calls = %d, want 0", sender.getStateCalls)
	}
	if got := w.Body.String(); got != "{\"state\":\"running\"}\n" {
		t.Fatalf("body = %q", got)
	}
}

// When an in-process chat worker has been resolved for the session
// (Model populated) and reports idle, the activity-window fallback must
// not override it — otherwise the Cancel button lingers after the
// assistant finishes because the JSONL write keeps the file mtime fresh.
func TestHandleWorkerStatusTrustsIdleWorkerOverRecentFileWrite(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	now := time.Date(2026, 5, 7, 21, 0, 0, 0, time.UTC)
	sender := &fakeSender{status: workers.WorkerStatus{State: workers.WorkerStateIdle, Model: "gpt-5.5"}}
	s := &Server{
		sessionsDir: root,
		chatSender:  sender,
		fileMod:     map[string]time.Time{"session.jsonl": now.Add(-100 * time.Millisecond)},
		now:         func() time.Time { return now },
	}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id=session.jsonl", nil)
	w := httptest.NewRecorder()

	s.handleWorkerStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, `"state":"idle"`) {
		t.Fatalf("body = %q, want state=idle", body)
	}
}

func TestHandleCommandsRejectsNonGET(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{sessionsDir: root, chatSender: &fakeSender{}}
	req := httptest.NewRequest(http.MethodPost, "/api/commands?id=session.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleCommands(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", w.Code)
	}
}

func TestHandleCommandsReturnsWorkerCommands(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	sender := &fakeSender{
		commands:      []workers.SlashCommand{{Name: "skill:memory", Description: "mem", Source: "skill"}},
		commandsReady: true,
	}
	s := &Server{sessionsDir: root, chatSender: sender}
	req := httptest.NewRequest(http.MethodGet, "/api/commands?id=session.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleCommands(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var body struct {
		Commands []workers.SlashCommand `json:"commands"`
		Ready    bool                   `json:"workerReady"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body decode: %v", err)
	}
	if !body.Ready {
		t.Fatalf("workerReady = false, want true")
	}
	if len(body.Commands) != 1 || body.Commands[0].Name != "skill:memory" {
		t.Fatalf("commands = %#v", body.Commands)
	}
	if sender.ensureWorkerCalled {
		t.Fatalf("EnsureWorker called without ?load=1")
	}
}

func TestHandleCommandsReportsNotReadyWithoutWorker(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{sessionsDir: root, chatSender: &fakeSender{commandsReady: false}}
	req := httptest.NewRequest(http.MethodGet, "/api/commands?id=session.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleCommands(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); !strings.Contains(got, `"commands":[]`) || !strings.Contains(got, `"workerReady":false`) {
		t.Fatalf("body = %q", got)
	}
}

func TestHandleCommandsLoadEnsuresWorker(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	sender := &fakeSender{commandsReady: true}
	s := &Server{sessionsDir: root, chatSender: sender}
	req := httptest.NewRequest(http.MethodGet, "/api/commands?id=session.jsonl&load=1", nil)
	w := httptest.NewRecorder()
	s.handleCommands(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if !sender.ensureWorkerCalled {
		t.Fatalf("EnsureWorker not called for ?load=1")
	}
}

func TestHandleCommandsDegradesOnQueryError(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	sender := &fakeSender{commandsReady: true, commandsErr: context.DeadlineExceeded}
	s := &Server{sessionsDir: root, chatSender: sender}
	req := httptest.NewRequest(http.MethodGet, "/api/commands?id=session.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleCommands(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (degraded)", w.Code)
	}
	if got := w.Body.String(); !strings.Contains(got, `"commands":[]`) {
		t.Fatalf("body = %q, want empty commands on error", got)
	}
}

func TestHandleSetThinkingLevelRequiresLevel(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	s := &Server{sessionsDir: root, chatSender: &fakeSender{}}
	req := httptest.NewRequest(http.MethodPost, "/api/set-thinking-level?id=session.jsonl", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleSetThinkingLevel(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	if !strings.Contains(w.Body.String(), "level required") {
		t.Fatalf("body = %q", w.Body.String())
	}
}

func TestHandleSetThinkingLevelRejectsMissingSession(t *testing.T) {
	s := &Server{sessionsDir: t.TempDir(), chatSender: &fakeSender{}}
	req := httptest.NewRequest(http.MethodPost, "/api/set-thinking-level?id=missing.jsonl", strings.NewReader(`{"level":"high"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleSetThinkingLevel(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
}

func TestHandleWorkerStatusUsesSessionStatusFile(t *testing.T) {
	root := t.TempDir()
	sessionsDir := filepath.Join(root, "sessions")
	statusDir := filepath.Join(root, "session-status")
	if err := os.MkdirAll(statusDir, 0755); err != nil {
		t.Fatal(err)
	}
	sessionID := "test-session.jsonl"
	status := map[string]any{
		"sessionId": sessionID,
		"state":     "running",
		"updatedAt": time.Now().UTC().Format(time.RFC3339),
	}
	data, _ := json.Marshal(status)
	if err := os.WriteFile(filepath.Join(statusDir, sessionID), data, 0644); err != nil {
		t.Fatal(err)
	}

	s := &Server{agentDir: root, sessionsDir: sessionsDir, chatSender: &fakeSender{}}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id="+sessionID, nil)
	w := httptest.NewRecorder()
	s.handleWorkerStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); got != "{\"state\":\"running\"}\n" {
		t.Fatalf("body = %q", got)
	}
}

func TestHandleWorkerStatusIgnoresStaleSessionStatusFile(t *testing.T) {
	root := t.TempDir()
	sessionsDir := filepath.Join(root, "sessions")
	statusDir := filepath.Join(root, "session-status")
	if err := os.MkdirAll(statusDir, 0755); err != nil {
		t.Fatal(err)
	}
	sessionID := "test-session.jsonl"
	status := map[string]any{
		"sessionId": sessionID,
		"state":     "running",
		"updatedAt": time.Now().Add(-30 * time.Second).UTC().Format(time.RFC3339),
	}
	data, _ := json.Marshal(status)
	if err := os.WriteFile(filepath.Join(statusDir, sessionID), data, 0644); err != nil {
		t.Fatal(err)
	}

	s := &Server{sessionsDir: sessionsDir, chatSender: &fakeSender{}}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id="+sessionID, nil)
	w := httptest.NewRecorder()
	s.handleWorkerStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); got != "{\"state\":\"idle\"}\n" {
		t.Fatalf("body = %q", got)
	}
}

func TestHandleWorkerStatusFallsThroughForIdleStatusFile(t *testing.T) {
	root := t.TempDir()
	sessionsDir := filepath.Join(root, "sessions")
	statusDir := filepath.Join(root, "session-status")
	if err := os.MkdirAll(statusDir, 0755); err != nil {
		t.Fatal(err)
	}
	sessionID := "test-session.jsonl"
	status := map[string]any{
		"sessionId": sessionID,
		"state":     "idle",
		"updatedAt": time.Now().UTC().Format(time.RFC3339),
	}
	data, _ := json.Marshal(status)
	if err := os.WriteFile(filepath.Join(statusDir, sessionID), data, 0644); err != nil {
		t.Fatal(err)
	}

	s := &Server{agentDir: root, sessionsDir: sessionsDir, chatSender: &fakeSender{}}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id="+sessionID, nil)
	w := httptest.NewRecorder()
	s.handleWorkerStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); got != "{\"state\":\"idle\"}\n" {
		t.Fatalf("body = %q", got)
	}
}

func TestHandleWorkerStatusReturnsModelAndThinkingLevel(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	sender := &fakeSender{
		state: workers.WorkerStatus{
			State:         workers.WorkerStateIdle,
			Model:         "kimi-k2.6",
			ModelName:     "Kimi K2.6",
			ModelProvider: "opengo-work",
			ThinkingLevel: "medium",
		},
	}
	s := &Server{sessionsDir: root, chatSender: sender}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id=session.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleWorkerStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var got map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["model"] != "kimi-k2.6" {
		t.Fatalf("model = %q, want kimi-k2.6", got["model"])
	}
	if got["modelName"] != "Kimi K2.6" {
		t.Fatalf("modelName = %q, want Kimi K2.6", got["modelName"])
	}
	if got["modelProvider"] != "opengo-work" {
		t.Fatalf("modelProvider = %q, want opengo-work", got["modelProvider"])
	}
	if got["thinkingLevel"] != "medium" {
		t.Fatalf("thinkingLevel = %q, want medium", got["thinkingLevel"])
	}
}

func TestHandleWorkerStatusDoesNotSpawnWorkerWhenModelUnknown(t *testing.T) {
	root := t.TempDir()
	writeSessionFile(t, root, "test-project", "session.jsonl")
	sender := &fakeSender{
		ensureWorkerCh: make(chan struct{}, 1),
		state: workers.WorkerStatus{
			State:         workers.WorkerStateIdle,
			Model:         "kimi-k2.6",
			ModelProvider: "opengo-work",
			ThinkingLevel: "medium",
		},
	}
	s := &Server{sessionsDir: root, chatSender: sender}
	req := httptest.NewRequest(http.MethodGet, "/api/worker-status?id=session.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleWorkerStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if sender.ensureWorkerCalled {
		t.Fatal("worker-status should not prewarm/create workers")
	}
}

func TestHandleNewSessionPreinitializesWorker(t *testing.T) {
	root := t.TempDir()
	fake := &fakeSender{ensureWorkerCh: make(chan struct{}, 1)}
	s := &Server{
		sessionsDir: root,
		chatSender:  fake,
	}
	req := httptest.NewRequest(http.MethodPost, "/api/new-session", strings.NewReader(`{"path":"/tmp/test-project"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleNewSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["ok"] != true {
		t.Fatalf("ok = %v, want true", body["ok"])
	}
	id, _ := body["id"].(string)
	if id == "" {
		t.Fatal("missing id in response")
	}

	// Verify EnsureWorker was called
	select {
	case <-fake.ensureWorkerCh:
		if !fake.ensureWorkerCalled {
			t.Fatal("EnsureWorker not marked as called")
		}
		if fake.ensureWorkerSessionID == "" {
			t.Fatal("EnsureWorker called with empty sessionID")
		}
	case <-time.After(time.Second):
		t.Fatal("EnsureWorker was not called within 1s")
	}

	// Verify file was created
	projectDir := filepath.Join(root, sessions.EncodeProjectName("/tmp/test-project"))
	entries, err := os.ReadDir(projectDir)
	if err != nil {
		t.Fatalf("expected project dir to exist: %v", err)
	}
	if len(entries) == 0 {
		t.Fatal("expected session file to be created")
	}
}

func TestHandleNewSessionCopiesSourceModelAndThinking(t *testing.T) {
	root := t.TempDir()
	_ = writeSessionFile(t, root, "--tmp--source--", "source.jsonl")
	fake := &fakeSender{state: workers.WorkerStatus{State: workers.WorkerStateIdle, ModelProvider: "openai", Model: "gpt-5", ThinkingLevel: "high"}}
	s := &Server{sessionsDir: root, chatSender: fake}

	req := httptest.NewRequest(http.MethodPost, "/api/new-session", strings.NewReader(`{"path":"/tmp/test-project","sourceSessionId":"source.jsonl"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleNewSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	id, _ := body["id"].(string)
	if id == "" {
		t.Fatal("missing id in response")
	}

	waitForCondition(t, time.Second, func() bool {
		return fake.ensureWorkerSessionID == id
	})
	if fake.setModelSessionID != "" || fake.setThinkingSessionID != "" {
		t.Fatalf("new session initialization should not append visible setting changes, got setModel=%q setThinking=%q", fake.setModelSessionID, fake.setThinkingSessionID)
	}
	projectDir := filepath.Join(root, sessions.EncodeProjectName("/tmp/test-project"))
	data, err := os.ReadFile(filepath.Join(projectDir, id))
	if err != nil {
		t.Fatal(err)
	}
	content := string(data)
	if !strings.Contains(content, `"type":"model_change"`) || !strings.Contains(content, `"implicit":true`) {
		t.Fatalf("new session file missing implicit model setting: %s", content)
	}
	if !strings.Contains(content, `"type":"thinking_level_change"`) || !strings.Contains(content, `"thinkingLevel":"high"`) {
		t.Fatalf("new session file missing implicit thinking setting: %s", content)
	}
}

func TestHandleNewSessionWithoutChatSender(t *testing.T) {
	root := t.TempDir()
	s := &Server{sessionsDir: root}
	req := httptest.NewRequest(http.MethodPost, "/api/new-session", strings.NewReader(`{"path":"/tmp/no-sender"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleNewSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["ok"] != true {
		t.Fatalf("ok = %v, want true", body["ok"])
	}
	id, _ := body["id"].(string)
	if id == "" {
		t.Fatal("missing id in response")
	}
}

func TestHandleNewSessionRejectsMissingPath(t *testing.T) {
	root := t.TempDir()
	s := &Server{sessionsDir: root}
	req := httptest.NewRequest(http.MethodPost, "/api/new-session", strings.NewReader(`{"path":""}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.handleNewSession(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleNewSessionRejectsGetMethod(t *testing.T) {
	root := t.TempDir()
	s := &Server{sessionsDir: root}
	req := httptest.NewRequest(http.MethodGet, "/api/new-session", nil)
	w := httptest.NewRecorder()
	s.handleNewSession(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
	}
}

func waitForCondition(t *testing.T, timeout time.Duration, fn func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if fn() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !fn() {
		t.Fatal("condition not met before timeout")
	}
}
