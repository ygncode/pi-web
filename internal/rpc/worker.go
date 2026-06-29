package rpc

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"pi-web/internal/chat"
	"pi-web/internal/workers"
)

type piRPCWorker struct {
	mu                   sync.Mutex
	writeMu              sync.Mutex
	sessionPath          string
	startedAt            time.Time
	cmd                  *exec.Cmd
	stdin                io.WriteCloser
	status               workers.WorkerStatus
	seq                  atomic.Uint64
	pending              map[string]chan response
	currentModel         string
	currentProvider      string
	currentThinkingLevel string
	stderrBuf            *strings.Builder
	commands             []workers.SlashCommand
	commandsCached       bool
	lastActive           atomic.Int64 // unix nanos; only user-initiated actions update this
	lastStreamActivity   atomic.Int64 // unix nanos; stream/turn events keep worker visually running
	streamSink           StreamEventSink
	streamPreview        *streamPreviewAccumulator
}

func (w *piRPCWorker) touch() {
	w.lastActive.Store(time.Now().UnixNano())
}

func (w *piRPCWorker) IdleSince(now time.Time) time.Duration {
	last := w.lastActive.Load()
	if last == 0 {
		return 0
	}
	return now.Sub(time.Unix(0, last))
}

// PID returns the operating-system process ID of the underlying pi worker, or
// 0 if the process has not started or has already exited.
func (w *piRPCWorker) PID() int {
	if w.cmd == nil || w.cmd.Process == nil {
		return 0
	}
	return w.cmd.Process.Pid
}

// StartedAt reports when the worker process was spawned (for uptime).
func (w *piRPCWorker) StartedAt() time.Time {
	return w.startedAt
}

func NewPiWorkerWithStream(sessionPath string, streamSink StreamEventSink) (workers.ChatWorker, error) {
	if _, err := exec.LookPath("pi"); err != nil {
		return nil, fmt.Errorf("pi executable not found: %w", err)
	}
	cmd := exec.Command("pi", "--mode", "rpc")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	var stderrBuf strings.Builder
	cmd.Stderr = &stderrBuf
	worker := &piRPCWorker{
		sessionPath:   sessionPath,
		startedAt:     time.Now(),
		cmd:           cmd,
		stdin:         stdin,
		status:        workers.WorkerStatus{State: workers.WorkerStateIdle},
		pending:       make(map[string]chan response),
		stderrBuf:     &stderrBuf,
		streamSink:    streamSink,
		streamPreview: &streamPreviewAccumulator{},
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	go worker.consume(stdout)
	go worker.wait()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := worker.switchSession(ctx); err != nil {
		_ = worker.Close()
		return nil, err
	}
	// Best-effort: refresh model/thinking-level from pi so a respawned worker
	// doesn't show stale defaults after the in-memory cache was lost on reap.
	stateCtx, stateCancel := context.WithTimeout(context.Background(), 5*time.Second)
	_, _ = worker.GetState(stateCtx)
	stateCancel()
	worker.touch()
	return worker, nil
}

func (w *piRPCWorker) Prompt(ctx context.Context, chat chat.Request) error {
	w.touch()
	w.mu.Lock()
	streaming := w.status.State == workers.WorkerStateRunning
	w.status = workers.WorkerStatus{State: workers.WorkerStateRunning}
	w.mu.Unlock()
	id := w.nextID()
	if err := w.sendAndAwait(ctx, BuildPromptCommand(id, chat, streaming)); err != nil {
		w.mu.Lock()
		w.status = workers.WorkerStatus{State: workers.WorkerStateError, Error: err.Error()}
		w.mu.Unlock()
		return err
	}
	return nil
}

// Compact runs pi's session.compact() via the dedicated "compact" rpc command.
// It blocks until pi finishes summarising and persists the compacted session.
// Marks the worker Running for the duration so the UI reflects activity and the
// compact affordance stays disabled, mirroring Prompt.
func (w *piRPCWorker) Compact(ctx context.Context) error {
	w.touch()
	w.mu.Lock()
	w.status = workers.WorkerStatus{State: workers.WorkerStateRunning}
	w.mu.Unlock()
	if err := w.sendAndAwait(ctx, BuildCompactCommand(w.nextID())); err != nil {
		w.mu.Lock()
		w.status = workers.WorkerStatus{State: workers.WorkerStateError, Error: err.Error()}
		w.mu.Unlock()
		return err
	}
	w.mu.Lock()
	w.status = workers.WorkerStatus{State: workers.WorkerStateIdle}
	w.mu.Unlock()
	return nil
}

func (w *piRPCWorker) SetModel(ctx context.Context, provider, modelID string) error {
	w.touch()
	id := w.nextID()
	ch := make(chan response, 1)
	w.mu.Lock()
	w.pending[id] = ch
	w.mu.Unlock()

	cmd := map[string]any{
		"id":       id,
		"type":     "set_model",
		"provider": provider,
		"modelId":  modelID,
	}
	w.writeMu.Lock()
	err := WriteCommand(w.stdin, cmd)
	w.writeMu.Unlock()
	if err != nil {
		w.removePending(id)
		return err
	}

	select {
	case res := <-ch:
		if !res.Success {
			if res.Error != "" {
				return errors.New(res.Error)
			}
			return fmt.Errorf("rpc set_model rejected")
		}
		var m model
		if err := json.Unmarshal(res.Data, &m); err != nil {
			// Some responses wrap the model in a "model" field
			var wrapper struct {
				Model model `json:"model"`
			}
			if err2 := json.Unmarshal(res.Data, &wrapper); err2 == nil && wrapper.Model.ID != "" {
				m = wrapper.Model
			}
		}
		if m.ID == "" {
			return fmt.Errorf("set_model returned empty model id")
		}
		if m.Provider != provider || m.ID != modelID {
			return fmt.Errorf("set_model returned unexpected model: %s/%s (wanted %s/%s)", m.Provider, m.ID, provider, modelID)
		}
		w.mu.Lock()
		w.currentModel = m.ID
		w.currentProvider = m.Provider
		w.status = workers.WorkerStatus{State: workers.WorkerStateIdle, Model: m.ID, ModelName: m.Name, ModelProvider: m.Provider}
		w.mu.Unlock()
		// Refresh thinking level after model switch
		go w.refreshThinkingLevel()
		return nil
	case <-ctx.Done():
		w.removePending(id)
		return ctx.Err()
	}
}

func (w *piRPCWorker) SetThinkingLevel(ctx context.Context, level string) error {
	w.touch()
	return w.sendAndAwait(ctx, BuildSetThinkingLevelCommand(w.nextID(), level))
}

func (w *piRPCWorker) Abort(ctx context.Context) error {
	w.touch()
	if err := w.sendAndAwait(ctx, BuildAbortCommand(w.nextID())); err != nil {
		return err
	}
	w.mu.Lock()
	w.status.State = workers.WorkerStateIdle
	w.status.Error = ""
	w.mu.Unlock()
	return nil
}

func (w *piRPCWorker) GetState(ctx context.Context) (workers.WorkerStatus, error) {
	id := w.nextID()
	ch := make(chan response, 1)
	w.mu.Lock()
	w.pending[id] = ch
	w.mu.Unlock()

	w.writeMu.Lock()
	err := WriteCommand(w.stdin, BuildGetStateCommand(id))
	w.writeMu.Unlock()
	if err != nil {
		w.removePending(id)
		return workers.WorkerStatus{}, err
	}

	select {
	case res := <-ch:
		if !res.Success {
			if res.Error != "" {
				return workers.WorkerStatus{}, errors.New(res.Error)
			}
			return workers.WorkerStatus{}, fmt.Errorf("rpc get_state rejected")
		}
		var state struct {
			ThinkingLevel string `json:"thinkingLevel"`
			Model         model  `json:"model"`
		}
		_ = json.Unmarshal(res.Data, &state)
		w.mu.Lock()
		w.currentThinkingLevel = state.ThinkingLevel
		if state.Model.ID != "" {
			w.currentModel = state.Model.ID
			w.currentProvider = state.Model.Provider
			w.status.Model = state.Model.ID
			w.status.ModelName = state.Model.Name
			w.status.ModelProvider = state.Model.Provider
		}
		s := w.status
		s.ThinkingLevel = state.ThinkingLevel
		w.mu.Unlock()
		return s, nil
	case <-ctx.Done():
		w.removePending(id)
		return workers.WorkerStatus{}, ctx.Err()
	}
}

// GetCommands returns the slash commands pi loaded for this session (skills,
// prompt templates, and extension commands). The set is fixed for a worker's
// lifetime, so the first successful result is cached and reused. It does not
// call touch(): querying commands is a passive UI affordance and should not
// keep an idle worker alive.
func (w *piRPCWorker) GetCommands(ctx context.Context) ([]workers.SlashCommand, error) {
	w.mu.Lock()
	if w.commandsCached {
		cmds := w.commands
		w.mu.Unlock()
		return cmds, nil
	}
	w.mu.Unlock()

	id := w.nextID()
	ch := make(chan response, 1)
	w.mu.Lock()
	w.pending[id] = ch
	w.mu.Unlock()

	w.writeMu.Lock()
	err := WriteCommand(w.stdin, BuildGetCommandsCommand(id))
	w.writeMu.Unlock()
	if err != nil {
		w.removePending(id)
		return nil, err
	}

	select {
	case res := <-ch:
		if !res.Success {
			if res.Error != "" {
				return nil, errors.New(res.Error)
			}
			return nil, fmt.Errorf("rpc get_commands rejected")
		}
		var payload struct {
			Commands []workers.SlashCommand `json:"commands"`
		}
		if err := json.Unmarshal(res.Data, &payload); err != nil {
			return nil, err
		}
		w.mu.Lock()
		w.commands = payload.Commands
		w.commandsCached = true
		w.mu.Unlock()
		return payload.Commands, nil
	case <-ctx.Done():
		w.removePending(id)
		return nil, ctx.Err()
	}
}

func (w *piRPCWorker) refreshThinkingLevel() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, _ = w.GetState(ctx)
}

const streamActivityWindow = 2 * time.Second

func (w *piRPCWorker) Status() workers.WorkerStatus {
	w.mu.Lock()
	defer w.mu.Unlock()
	s := w.status
	s.Model = w.currentModel
	s.ModelProvider = w.currentProvider
	s.ThinkingLevel = w.currentThinkingLevel
	if s.State == workers.WorkerStateIdle && w.hasRecentStreamActivityLocked(time.Now()) {
		s.State = workers.WorkerStateRunning
	}
	return s
}

func (w *piRPCWorker) Close() error {
	if w.stdin != nil {
		_ = w.stdin.Close()
	}
	if w.cmd != nil && w.cmd.Process != nil {
		_ = w.cmd.Process.Kill()
	}
	return nil
}

func (w *piRPCWorker) nextID() string {
	return fmt.Sprintf("req-%d", w.seq.Add(1))
}

func (w *piRPCWorker) switchSession(ctx context.Context) error {
	return w.sendAndAwait(ctx, buildSwitchSessionCommand(w.nextID(), w.sessionPath))
}

func (w *piRPCWorker) sendAndAwait(ctx context.Context, cmd map[string]any) error {
	id, _ := cmd["id"].(string)
	if id == "" {
		return errors.New("rpc command missing id")
	}
	ch := make(chan response, 1)
	w.mu.Lock()
	w.pending[id] = ch
	w.mu.Unlock()

	w.writeMu.Lock()
	err := WriteCommand(w.stdin, cmd)
	w.writeMu.Unlock()
	if err != nil {
		w.removePending(id)
		return err
	}

	select {
	case res := <-ch:
		if !res.Success {
			if res.Error != "" {
				return errors.New(res.Error)
			}
			return fmt.Errorf("rpc %s rejected", res.Command)
		}
		return nil
	case <-ctx.Done():
		w.removePending(id)
		return ctx.Err()
	}
}

func (w *piRPCWorker) removePending(id string) {
	w.mu.Lock()
	delete(w.pending, id)
	w.mu.Unlock()
}

func (w *piRPCWorker) consume(r io.Reader) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 10*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSuffix(scanner.Text(), "\r")
		if strings.TrimSpace(line) == "" {
			continue
		}
		w.handleRPCLine(line)
	}
	if err := scanner.Err(); err != nil {
		w.setError(err)
		return
	}
	w.setError(io.ErrUnexpectedEOF)
}

func (w *piRPCWorker) handleRPCLine(line string) {
	var meta struct {
		Type  string `json:"type"`
		Level string `json:"level"`
	}
	if err := json.Unmarshal([]byte(line), &meta); err != nil {
		return
	}
	switch meta.Type {
	case "response":
		var res response
		if err := json.Unmarshal([]byte(line), &res); err != nil {
			return
		}
		w.mu.Lock()
		ch := w.pending[res.ID]
		delete(w.pending, res.ID)
		w.mu.Unlock()
		if ch != nil {
			ch <- res
		}
	case "message_update":
		var msg struct {
			AssistantMessageEvent assistantMessageEvent `json:"assistantMessageEvent"`
		}
		if err := json.Unmarshal([]byte(line), &msg); err == nil {
			w.emitStreamPreview(msg.AssistantMessageEvent)
		}
		w.noteStreamActivity()
	case "message_end", "turn_end":
		w.noteStreamActivity()
		w.completeStreamPreview()
	case "agent_end":
		w.completeStreamPreview()
		w.mu.Lock()
		w.status = workers.WorkerStatus{State: workers.WorkerStateIdle}
		w.mu.Unlock()
		w.lastStreamActivity.Store(0)
	case "thinking_level_changed":
		if meta.Level != "" {
			w.mu.Lock()
			w.currentThinkingLevel = meta.Level
			w.mu.Unlock()
		}
	}
}

func (w *piRPCWorker) noteStreamActivity() {
	w.lastStreamActivity.Store(time.Now().UnixNano())
}

func (w *piRPCWorker) emitStreamPreview(event assistantMessageEvent) {
	if w.streamSink == nil || w.streamPreview == nil {
		return
	}
	if preview, ok := w.streamPreview.handleAssistantEvent(event); ok {
		w.streamSink(preview)
	}
}

func (w *piRPCWorker) completeStreamPreview() {
	if w.streamSink == nil || w.streamPreview == nil {
		return
	}
	if preview, ok := w.streamPreview.complete(); ok {
		w.streamSink(preview)
	}
}

func (w *piRPCWorker) hasRecentStreamActivityLocked(now time.Time) bool {
	last := w.lastStreamActivity.Load()
	if last == 0 {
		return false
	}
	return now.Sub(time.Unix(0, last)) <= streamActivityWindow
}

func (w *piRPCWorker) wait() {
	if err := w.cmd.Wait(); err != nil {
		w.setError(err)
	}
}

func (w *piRPCWorker) setError(err error) {
	err = w.withStderr(err)
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.status.State != workers.WorkerStateError {
		w.status = workers.WorkerStatus{State: workers.WorkerStateError, Error: err.Error()}
	}
	for id, ch := range w.pending {
		delete(w.pending, id)
		ch <- response{ID: id, Type: "response", Success: false, Error: err.Error()}
	}
}

func (w *piRPCWorker) withStderr(err error) error {
	if w.stderrBuf == nil {
		return err
	}
	stderr := strings.TrimSpace(w.stderrBuf.String())
	if stderr == "" {
		return err
	}
	const maxStderr = 4096
	if len(stderr) > maxStderr {
		stderr = "…" + stderr[len(stderr)-maxStderr:]
	}
	return fmt.Errorf("%w; stderr: %s", err, stderr)
}
