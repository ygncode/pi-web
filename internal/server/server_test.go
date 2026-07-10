package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pi-web/internal/auth"
	"pi-web/internal/sessions"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	dir := t.TempDir()
	s, err := New(Deps{
		AgentDir:            dir,
		SessionsDir:         dir,
		Auth:                auth.New(""),
		Cache:               sessions.NewCache(),
		RenderExportSession: func(s sessions.Session, theme string) string { return "" },
		Models:              func(ctx context.Context) (json.RawMessage, error) { return nil, nil },
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	// Close the server's sqlite handle before TempDir cleanup: Windows cannot
	// delete a file that is still open.
	t.Cleanup(s.Shutdown)
	return s
}

func TestHandleCustomThemesServesConfiguredStylesheet(t *testing.T) {
	s := newTestServer(t)
	webDir := filepath.Join(s.agentDir, "pi-web")
	if err := os.MkdirAll(webDir, 0755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	css := `[data-theme="custom"] { --body-bg: #010203; }`
	if err := os.WriteFile(filepath.Join(webDir, "custom-themes.css"), []byte(css), 0644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/custom-themes.css", nil)
	w := httptest.NewRecorder()
	s.handleCustomThemes(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Content-Type"); !strings.Contains(got, "text/css") {
		t.Fatalf("expected text/css content type, got %q", got)
	}
	if got := w.Body.String(); got != css {
		t.Fatalf("expected configured CSS %q, got %q", css, got)
	}
}

func TestHandleCustomThemesFallbackWhenMissing(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/custom-themes.css", nil)
	w := httptest.NewRecorder()
	s.handleCustomThemes(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if got := w.Header().Get("Content-Type"); !strings.Contains(got, "text/css") {
		t.Fatalf("expected text/css content type, got %q", got)
	}
	if !strings.Contains(w.Body.String(), "No custom themes configured") {
		t.Fatalf("expected fallback CSS comment, got %q", w.Body.String())
	}
}

func TestCustomThemesPublicWhenAuthEnabled(t *testing.T) {
	// The login gate loads /custom-themes.css before the user authenticates, so
	// the route must stay reachable without a token even when auth is on.
	dir := t.TempDir()
	s, err := New(Deps{
		AgentDir:            dir,
		SessionsDir:         dir,
		Auth:                auth.New("secret"),
		Cache:               sessions.NewCache(),
		RenderExportSession: func(s sessions.Session, theme string) string { return "" },
		Models:              func(ctx context.Context) (json.RawMessage, error) { return nil, nil },
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	t.Cleanup(s.Shutdown)
	mux := http.NewServeMux()
	s.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/custom-themes.css", nil)
	req.Header.Set("Accept", "text/css")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GET /custom-themes.css without token = %d, want 200 (public)", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); !strings.Contains(got, "text/css") {
		t.Fatalf("Content-Type = %q, want text/css", got)
	}
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
