package server

import (
	_ "embed"
	"net/http"
	"net/http/pprof"
	"os"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v4/process"

	"pi-web/internal/workers"
)

// processSample is a point-in-time resource reading for one OS process.
type processSample struct {
	RSSBytes uint64
	CPUTimeS float64 // cumulative CPU seconds (user + system)
}

// processSampler reads per-PID resource usage. Abstracted behind an interface
// so tests can inject canned values instead of depending on real OS stats.
type processSampler interface {
	Sample(pid int) (processSample, error)
}

// gopsutilSampler is the production sampler. Each call is a couple of cheap
// syscalls; it never blocks (no Percent(interval)) — %CPU is derived from
// cumulative CPU time across requests by the handler.
type gopsutilSampler struct{}

func (gopsutilSampler) Sample(pid int) (processSample, error) {
	p, err := process.NewProcess(int32(pid))
	if err != nil {
		return processSample{}, err
	}
	mem, err := p.MemoryInfo()
	if err != nil {
		return processSample{}, err
	}
	times, err := p.Times()
	if err != nil {
		return processSample{}, err
	}
	return processSample{RSSBytes: mem.RSS, CPUTimeS: times.User + times.System}, nil
}

// workerSnapshotter is the optional capability the chat sender (the worker
// manager) exposes for the dashboard. Implemented by *workers.Manager.
type workerSnapshotter interface {
	Snapshot() []workers.WorkerSnapshot
}

type metricsResponse struct {
	Process processMetrics  `json:"process"`
	Workers []workerMetrics `json:"workers"`
}

type processMetrics struct {
	PID            int     `json:"pid"`
	UptimeS        float64 `json:"uptime_s"`
	Goroutines     int     `json:"goroutines"`
	HeapAllocBytes uint64  `json:"heap_alloc_bytes"`
	SSEClients     int     `json:"sse_clients"`
	WatchedFiles   int     `json:"watched_files"`
}

type workerMetrics struct {
	SessionID  string  `json:"session_id"`
	PID        int     `json:"pid"`
	State      string  `json:"state"`
	Model      string  `json:"model,omitempty"`
	UptimeS    float64 `json:"uptime_s"`
	IdleForS   float64 `json:"idle_for_s"`
	RSSBytes   uint64  `json:"rss_bytes"`
	CPUTimeS   float64 `json:"cpu_time_s"`
	CPUPercent float64 `json:"cpu_percent"`
	Sampled    bool    `json:"sampled"`
	Zombie     bool    `json:"zombie"`
}

// cpuMark records the last CPU reading for a PID so %CPU can be computed as a
// delta on the next request.
type cpuMark struct {
	cpuTimeS float64
	at       time.Time
}

//go:embed metrics_dashboard.html
var metricsDashboardHTML []byte

// registerPprof mounts Go's runtime profiler under /api/debug/pprof/, gated by
// the same auth middleware as everything else. For deep "why is the app slow"
// dives, point the Go tool at it, e.g.:
//
//	go tool pprof http://localhost:31415/api/debug/pprof/heap
//
// pprof.Index hard-codes the /debug/pprof/ path prefix when routing to named
// profiles (heap, goroutine, …), so the index handler is given a path with the
// /api segment stripped. The special endpoints (cmdline/profile/symbol/trace)
// read query params and need no path rewrite, and their more specific patterns
// take precedence over the index subtree.
func (s *Server) registerPprof(mux *http.ServeMux) {
	index := http.StripPrefix("/api", http.HandlerFunc(pprof.Index))
	mux.HandleFunc("/api/debug/pprof/", s.auth.Wrap(index.ServeHTTP))
	mux.HandleFunc("/api/debug/pprof/cmdline", s.auth.Wrap(pprof.Cmdline))
	mux.HandleFunc("/api/debug/pprof/profile", s.auth.Wrap(pprof.Profile))
	mux.HandleFunc("/api/debug/pprof/symbol", s.auth.Wrap(pprof.Symbol))
	mux.HandleFunc("/api/debug/pprof/trace", s.auth.Wrap(pprof.Trace))
}

// handleMetricsPage serves the self-contained dashboard. Same-origin fetches to
// /api/metrics authenticate automatically via the auth cookie.
func (s *Server) handleMetricsPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(metricsDashboardHTML)
}

// handleMetrics returns a non-blocking snapshot of process- and worker-level
// resource usage for the dashboard.
func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	now := s.now()

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)

	s.clientsMu.RLock()
	sseClients := len(s.clients)
	s.clientsMu.RUnlock()

	s.fileModMu.RLock()
	watched := len(s.fileMod)
	s.fileModMu.RUnlock()

	resp := metricsResponse{
		Process: processMetrics{
			PID:            os.Getpid(),
			UptimeS:        now.Sub(s.startedAt).Seconds(),
			Goroutines:     runtime.NumGoroutine(),
			HeapAllocBytes: ms.HeapAlloc,
			SSEClients:     sseClients,
			WatchedFiles:   watched,
		},
		Workers: []workerMetrics{},
	}

	var snaps []workers.WorkerSnapshot
	if snapr, ok := s.chatSender.(workerSnapshotter); ok {
		snaps = snapr.Snapshot()
	}

	sampler := s.metricsSampler
	if sampler == nil {
		sampler = gopsutilSampler{}
	}

	live := make(map[int]bool, len(snaps))
	for _, sn := range snaps {
		wm := workerMetrics{
			SessionID: sn.SessionID,
			PID:       sn.PID,
			State:     string(sn.State),
			Model:     sn.Model,
			UptimeS:   sn.UptimeS,
			IdleForS:  sn.IdleForS,
			Zombie:    sn.State == workers.WorkerStateIdle && sn.IdleForS > workers.DefaultIdleTTL.Seconds(),
		}
		if sn.PID > 0 {
			if smp, err := sampler.Sample(sn.PID); err == nil {
				wm.RSSBytes = smp.RSSBytes
				wm.CPUTimeS = smp.CPUTimeS
				wm.CPUPercent = s.cpuPercent(sn.PID, smp.CPUTimeS, now)
				wm.Sampled = true
				live[sn.PID] = true
			}
		}
		resp.Workers = append(resp.Workers, wm)
	}
	s.pruneCPUMarks(live)

	writeJSON(w, 0, resp)
}

// cpuPercent computes a worker's CPU usage as the change in cumulative CPU time
// over wall-clock time since the previous sample. The first sample for a PID
// has no baseline and reports 0.
func (s *Server) cpuPercent(pid int, cpuTimeS float64, now time.Time) float64 {
	s.metricsCPUMu.Lock()
	defer s.metricsCPUMu.Unlock()
	if s.metricsCPULast == nil {
		s.metricsCPULast = make(map[int]cpuMark)
	}
	prev, ok := s.metricsCPULast[pid]
	s.metricsCPULast[pid] = cpuMark{cpuTimeS: cpuTimeS, at: now}
	if !ok {
		return 0
	}
	wall := now.Sub(prev.at).Seconds()
	if wall <= 0 {
		return 0
	}
	pct := (cpuTimeS - prev.cpuTimeS) / wall * 100
	if pct < 0 {
		// CPU time only ever increases; a negative delta means the PID was
		// reused for a different process. Treat as a fresh baseline.
		return 0
	}
	return pct
}

// pruneCPUMarks drops baselines for PIDs no longer present so the cache can't
// grow without bound as workers come and go.
func (s *Server) pruneCPUMarks(live map[int]bool) {
	s.metricsCPUMu.Lock()
	defer s.metricsCPUMu.Unlock()
	for pid := range s.metricsCPULast {
		if !live[pid] {
			delete(s.metricsCPULast, pid)
		}
	}
}
