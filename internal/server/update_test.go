package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"pi-web/internal/updater"
)

func TestHandleVersionReturnsCurrent(t *testing.T) {
	s := &Server{updater: updater.New("dev")}
	req := httptest.NewRequest(http.MethodGet, "/api/version", nil)
	w := httptest.NewRecorder()
	s.handleVersion(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d want 200", w.Code)
	}
	var info updater.Info
	if err := json.Unmarshal(w.Body.Bytes(), &info); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if info.Current != "dev" {
		t.Errorf("current=%q want dev", info.Current)
	}
	if info.HasUpdate {
		t.Errorf("dev should not report update")
	}
}

func TestHandleVersionRejectsNonGet(t *testing.T) {
	s := &Server{updater: updater.New("dev")}
	req := httptest.NewRequest(http.MethodPost, "/api/version", nil)
	w := httptest.NewRecorder()
	s.handleVersion(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status=%d want 405", w.Code)
	}
}

func TestHandleUpdateRunsInstall(t *testing.T) {
	called := false
	s := &Server{
		updater:    updater.New("0.0.1-beta.24"),
		runInstall: func(ctx context.Context) error { called = true; return nil },
	}
	req := httptest.NewRequest(http.MethodPost, "/api/update", nil)
	w := httptest.NewRecorder()
	s.handleUpdate(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !called {
		t.Errorf("runInstall not called")
	}
	var resp struct {
		Status       string `json:"status"`
		NeedsRestart bool   `json:"needsRestart"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if !resp.NeedsRestart {
		t.Errorf("expected needsRestart true, got %+v", resp)
	}
}

func TestHandleUpdateSurfacesError(t *testing.T) {
	s := &Server{
		updater:    updater.New("0.0.1-beta.24"),
		runInstall: func(ctx context.Context) error { return errors.New("boom") },
	}
	req := httptest.NewRequest(http.MethodPost, "/api/update", nil)
	w := httptest.NewRecorder()
	s.handleUpdate(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d want 500", w.Code)
	}
}

func TestHandleUpdateUnavailableWhenNoInstaller(t *testing.T) {
	s := &Server{updater: updater.New("0.0.1-beta.24")}
	req := httptest.NewRequest(http.MethodPost, "/api/update", nil)
	w := httptest.NewRecorder()
	s.handleUpdate(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d want 503", w.Code)
	}
}

func TestHandleRestartInvokesRunRestart(t *testing.T) {
	done := make(chan struct{})
	s := &Server{
		updater:    updater.New("0.0.1-beta.24"),
		runRestart: func() error { close(done); return nil },
	}
	req := httptest.NewRequest(http.MethodPost, "/api/restart", nil)
	w := httptest.NewRecorder()
	s.handleRestart(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d want 200", w.Code)
	}
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("runRestart was not invoked")
	}
}
