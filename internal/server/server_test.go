package server

import (
	"context"
	"encoding/json"
	"io"
	"testing"
	"time"

	"pi-web/internal/auth"
	"pi-web/internal/sessions"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	dir := t.TempDir()
	return New(Deps{
		AgentDir:      dir,
		SessionsDir:   dir,
		Auth:          auth.New(""),
		Cache:         sessions.NewCache(),
		RenderIndex:   func(w io.Writer, _ []sessions.SessionSummary) error { return nil },
		RenderLiveSession:   func(s sessions.Session, _ string) string { return "" },
		RenderExportSession: func(s sessions.Session, theme string) string { return "" },
		Models:        func(ctx context.Context) (json.RawMessage, error) { return nil, nil },
	})
}

func TestShutdownStopsBackgroundGoroutines(t *testing.T) {
	s := newTestServer(t)
	done := make(chan struct{})
	go func() {
		s.Shutdown()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Shutdown did not return within 2s — background goroutines did not exit")
	}
}

func TestShutdownIsIdempotent(t *testing.T) {
	s := newTestServer(t)
	s.Shutdown()
	s.Shutdown() // must not panic
}
