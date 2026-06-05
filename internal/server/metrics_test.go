package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"pi-web/internal/auth"
	"pi-web/internal/workers"
)

// snapshotSender extends fakeSender (which already satisfies ChatSender) with
// the optional workerSnapshotter capability the metrics handler looks for.
type snapshotSender struct {
	fakeSender
	snaps []workers.WorkerSnapshot
}

func (s *snapshotSender) Snapshot() []workers.WorkerSnapshot { return s.snaps }

// stubSampler returns canned readings, or an error for PIDs in errPIDs.
type stubSampler struct {
	byPID   map[int]processSample
	errPIDs map[int]bool
}

func (s stubSampler) Sample(pid int) (processSample, error) {
	if s.errPIDs[pid] {
		return processSample{}, errSampler
	}
	return s.byPID[pid], nil
}

var errSampler = &sampleErr{}

type sampleErr struct{}

func (*sampleErr) Error() string { return "sample failed" }

func newMetricsServer(sender ChatSender, sampler processSampler) *Server {
	return &Server{
		now:            time.Now,
		startedAt:      time.Now().Add(-5 * time.Minute),
		chatSender:     sender,
		metricsSampler: sampler,
		metricsCPULast: make(map[int]cpuMark),
		auth:           auth.New(""),
	}
}

func decodeMetrics(t *testing.T, s *Server) metricsResponse {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	w := httptest.NewRecorder()
	s.handleMetrics(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var resp metricsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v (body=%s)", err, w.Body.String())
	}
	return resp
}

func TestMetricsReportsProcessAndWorkers(t *testing.T) {
	sender := &snapshotSender{snaps: []workers.WorkerSnapshot{
		{SessionID: "a.jsonl", PID: 101, State: workers.WorkerStateRunning, Model: "opus", UptimeS: 120, IdleForS: 0},
	}}
	sampler := stubSampler{byPID: map[int]processSample{
		101: {RSSBytes: 200 << 20, CPUTimeS: 5},
	}}
	s := newMetricsServer(sender, sampler)

	resp := decodeMetrics(t, s)

	if resp.Process.PID == 0 {
		t.Error("process pid should be non-zero")
	}
	if resp.Process.UptimeS < 250 {
		t.Errorf("process uptime = %v, want >= ~300", resp.Process.UptimeS)
	}
	if resp.Process.Goroutines == 0 {
		t.Error("goroutines should be non-zero")
	}
	if len(resp.Workers) != 1 {
		t.Fatalf("workers len = %d, want 1", len(resp.Workers))
	}
	wm := resp.Workers[0]
	if wm.SessionID != "a.jsonl" || wm.PID != 101 || wm.State != "running" {
		t.Errorf("worker fields wrong: %#v", wm)
	}
	if !wm.Sampled || wm.RSSBytes != 200<<20 || wm.CPUTimeS != 5 {
		t.Errorf("worker sampling wrong: %#v", wm)
	}
}

func TestMetricsFlagsZombie(t *testing.T) {
	sender := &snapshotSender{snaps: []workers.WorkerSnapshot{
		{SessionID: "stale.jsonl", PID: 1, State: workers.WorkerStateIdle, IdleForS: workers.DefaultIdleTTL.Seconds() + 60},
		{SessionID: "fresh.jsonl", PID: 2, State: workers.WorkerStateIdle, IdleForS: 5},
	}}
	sampler := stubSampler{byPID: map[int]processSample{1: {}, 2: {}}}
	s := newMetricsServer(sender, sampler)

	resp := decodeMetrics(t, s)

	byID := map[string]workerMetrics{}
	for _, w := range resp.Workers {
		byID[w.SessionID] = w
	}
	if !byID["stale.jsonl"].Zombie {
		t.Error("worker idle past TTL should be flagged zombie")
	}
	if byID["fresh.jsonl"].Zombie {
		t.Error("freshly idle worker should not be flagged zombie")
	}
}

func TestMetricsRunningWorkerNeverZombie(t *testing.T) {
	sender := &snapshotSender{snaps: []workers.WorkerSnapshot{
		{SessionID: "busy.jsonl", PID: 1, State: workers.WorkerStateRunning, IdleForS: workers.DefaultIdleTTL.Seconds() + 600},
	}}
	s := newMetricsServer(sender, stubSampler{byPID: map[int]processSample{1: {}}})
	resp := decodeMetrics(t, s)
	if resp.Workers[0].Zombie {
		t.Error("running worker must never be flagged zombie regardless of idle time")
	}
}

func TestMetricsSamplerErrorDegradesGracefully(t *testing.T) {
	sender := &snapshotSender{snaps: []workers.WorkerSnapshot{
		{SessionID: "good.jsonl", PID: 10, State: workers.WorkerStateIdle},
		{SessionID: "bad.jsonl", PID: 11, State: workers.WorkerStateIdle},
	}}
	sampler := stubSampler{
		byPID:   map[int]processSample{10: {RSSBytes: 1 << 20, CPUTimeS: 1}},
		errPIDs: map[int]bool{11: true},
	}
	s := newMetricsServer(sender, sampler)

	resp := decodeMetrics(t, s)

	byID := map[string]workerMetrics{}
	for _, w := range resp.Workers {
		byID[w.SessionID] = w
	}
	if !byID["good.jsonl"].Sampled || byID["good.jsonl"].RSSBytes != 1<<20 {
		t.Errorf("good worker should be sampled: %#v", byID["good.jsonl"])
	}
	if byID["bad.jsonl"].Sampled {
		t.Error("worker whose sample errored should report sampled=false")
	}
}

func TestMetricsRequiresAuth(t *testing.T) {
	sender := &snapshotSender{}
	s := newMetricsServer(sender, stubSampler{})
	s.auth = auth.New("secret")

	mux := http.NewServeMux()
	mux.HandleFunc("/api/metrics", s.auth.Wrap(s.handleMetrics))

	req := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	req.Header.Set("Accept", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status without token = %d, want 401", w.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	req2.Header.Set("Accept", "application/json")
	req2.Header.Set("Authorization", "Bearer secret")
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("status with token = %d, want 200", w2.Code)
	}
}

func TestCPUPercentDeltaMath(t *testing.T) {
	s := newMetricsServer(&snapshotSender{}, stubSampler{})
	t0 := time.Unix(1000, 0)

	// First sample has no baseline → 0%.
	if pct := s.cpuPercent(7, 10, t0); pct != 0 {
		t.Fatalf("first sample pct = %v, want 0", pct)
	}
	// 2 CPU-seconds over 4 wall-seconds → 50%.
	if pct := s.cpuPercent(7, 12, t0.Add(4*time.Second)); pct != 50 {
		t.Fatalf("delta pct = %v, want 50", pct)
	}
	// Decreasing cumulative CPU (PID reuse) → clamped to 0.
	if pct := s.cpuPercent(7, 1, t0.Add(8*time.Second)); pct != 0 {
		t.Fatalf("negative delta pct = %v, want 0", pct)
	}
}

func TestPruneCPUMarksDropsDeadPIDs(t *testing.T) {
	s := newMetricsServer(&snapshotSender{}, stubSampler{})
	now := time.Now()
	s.cpuPercent(1, 5, now)
	s.cpuPercent(2, 5, now)
	s.pruneCPUMarks(map[int]bool{1: true})
	if _, ok := s.metricsCPULast[2]; ok {
		t.Error("dead PID 2 should have been pruned")
	}
	if _, ok := s.metricsCPULast[1]; !ok {
		t.Error("live PID 1 should remain")
	}
}

func TestPprofRoutes(t *testing.T) {
	s := newMetricsServer(&snapshotSender{}, stubSampler{})
	mux := http.NewServeMux()
	s.registerPprof(mux)

	// Index lists available profiles.
	req := httptest.NewRequest(http.MethodGet, "/api/debug/pprof/", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("index status = %d, want 200", w.Code)
	}
	if !bytes.Contains(w.Body.Bytes(), []byte("goroutine")) {
		t.Errorf("index should list profiles, got: %s", w.Body.String())
	}

	// A named profile resolves through the /api-stripped Index handler.
	req2 := httptest.NewRequest(http.MethodGet, "/api/debug/pprof/heap?debug=1", nil)
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("heap profile status = %d, want 200", w2.Code)
	}
}

func TestPprofRequiresAuth(t *testing.T) {
	s := newMetricsServer(&snapshotSender{}, stubSampler{})
	s.auth = auth.New("secret")
	mux := http.NewServeMux()
	s.registerPprof(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/debug/pprof/heap", nil)
	req.Header.Set("Accept", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("pprof without token = %d, want 401", w.Code)
	}
}
