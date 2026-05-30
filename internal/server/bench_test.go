package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"pi-web/internal/auth"
	"pi-web/internal/sessions"
)

func generateLargeSessionContent(n int, cwd string) string {
	var sb strings.Builder
	sb.WriteString(`{"type":"session","version":3,"id":"bench-session-id","name":"Benchmark Session","timestamp":"2026-01-01T00:00:00Z","cwd":"` + cwd + `"}` + "\n")
	for i := 0; i < n; i++ {
		ts := fmt.Sprintf("2026-01-01T%02d:%02d:%02dZ", i/3600, (i/60)%60, i%60)
		if i%2 == 0 {
			sb.WriteString(`{"type":"message","id":"` + fmt.Sprintf("msg%06d", i) + `","timestamp":"` + ts + `","message":{"role":"user","content":"User message ` + fmt.Sprintf("%d", i) + ` with some realistic content.","usage":{"totalTokens":50,"cost":{"total":0.001}}}}` + "\n")
		} else {
			sb.WriteString(`{"type":"message","id":"` + fmt.Sprintf("msg%06d", i) + `","timestamp":"` + ts + `","message":{"role":"assistant","content":[{"type":"text","text":"Assistant response ` + fmt.Sprintf("%d", i) + ` with detailed explanation and technical content."}],"usage":{"totalTokens":200,"cost":{"total":0.004}}}}` + "\n")
		}
	}
	return sb.String()
}

func newBenchServer(b *testing.B, numSessions, messagesPerSession int) (*Server, string) {
	b.Helper()
	dir := b.TempDir()
	cwd := filepath.Join(dir, "cwd")
	os.MkdirAll(cwd, 0755)

	var lastID string
	for i := 0; i < numSessions; i++ {
		proj := filepath.Join(dir, fmt.Sprintf("--project-%02d--", i%5))
		os.MkdirAll(proj, 0755)
		name := fmt.Sprintf("session-%03d.jsonl", i)
		path := filepath.Join(proj, name)
		os.WriteFile(path, []byte(generateLargeSessionContent(messagesPerSession, cwd)), 0644)
		lastID = name
	}

	srv := New(Deps{
		AgentDir:    dir,
		SessionsDir: dir,
		Auth:        auth.New(""),
		Cache:       sessions.NewCache(),
		RenderIndex: func(w io.Writer, _ []sessions.SessionSummary) error { return nil },
		RenderLiveSession: func(s sessions.Session) string {
			return fmt.Sprintf("<html><body>%d entries</body></html>", len(s.Entries))
		},
		RenderExportSession: func(s sessions.Session, theme string) string { return "" },
		Models:              func(ctx context.Context) (json.RawMessage, error) { return nil, nil },
	})
	return srv, lastID
}

func BenchmarkHandleIndexCold10(b *testing.B) {
	srv, _ := newBenchServer(b, 10, 50)
	defer srv.Shutdown()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Reset cache each iteration to simulate cold start.
		srv.cache = sessions.NewCache()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		srv.handleIndex(rec, req)
		if rec.Code != http.StatusOK {
			b.Fatalf("unexpected status %d", rec.Code)
		}
	}
}

func BenchmarkHandleIndexWarm10(b *testing.B) {
	srv, _ := newBenchServer(b, 10, 50)
	defer srv.Shutdown()

	// Warm the cache.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	srv.handleIndex(httptest.NewRecorder(), req)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		srv.handleIndex(rec, req)
		if rec.Code != http.StatusOK {
			b.Fatalf("unexpected status %d", rec.Code)
		}
	}
}

func BenchmarkHandleIndexWarm100(b *testing.B) {
	srv, _ := newBenchServer(b, 100, 50)
	defer srv.Shutdown()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	srv.handleIndex(httptest.NewRecorder(), req)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		srv.handleIndex(rec, req)
		if rec.Code != http.StatusOK {
			b.Fatalf("unexpected status %d", rec.Code)
		}
	}
}

func BenchmarkHandleSessionCold(b *testing.B) {
	srv, sessionID := newBenchServer(b, 50, 100)
	defer srv.Shutdown()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Use a fresh cache each time to simulate cold path.
		srv.cache = sessions.NewCache()
		req := httptest.NewRequest(http.MethodGet, "/session?id="+sessionID, nil)
		rec := httptest.NewRecorder()
		srv.handleSession(rec, req)
		if rec.Code != http.StatusOK {
			b.Fatalf("unexpected status %d", rec.Code)
		}
	}
}

func BenchmarkHandleSessionWarm(b *testing.B) {
	srv, sessionID := newBenchServer(b, 50, 100)
	defer srv.Shutdown()

	// Warm: load all to populate path index.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	srv.handleIndex(httptest.NewRecorder(), req)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest(http.MethodGet, "/session?id="+sessionID, nil)
		rec := httptest.NewRecorder()
		srv.handleSession(rec, req)
		if rec.Code != http.StatusOK {
			b.Fatalf("unexpected status %d", rec.Code)
		}
	}
}
