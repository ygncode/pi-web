package server

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"pi-web/internal/auth"
	"pi-web/internal/sessions"
)

type fakeShareRunner struct {
	authErr      error
	createOut    string
	createStderr string
	createErr    error
	createCalled bool
}

func (f *fakeShareRunner) authStatus() error { return f.authErr }
func (f *fakeShareRunner) createGist(htmlPath string) (string, string, error) {
	f.createCalled = true
	return f.createOut, f.createStderr, f.createErr
}

func newShareTestServer(t *testing.T, runner shareCmdRunner) (*Server, string) {
	t.Helper()
	root := t.TempDir()
	writeSessionFile(t, root, "--tmp--project--", "session.jsonl")
	s := &Server{
		sessionsDir:   root,
		cache:         sessions.NewCache(),
		shareRunner:   runner,
		renderExportSession: func(sess sessions.Session, theme string) string { return "<html></html>" },
	}
	return s, root
}

func TestHandleShareRejectsGet(t *testing.T) {
	s, _ := newShareTestServer(t, &fakeShareRunner{})
	req := httptest.NewRequest(http.MethodGet, "/share?id=session.jsonl", nil)
	rec := httptest.NewRecorder()
	s.handleShare(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestHandleShareRequiresID(t *testing.T) {
	s, _ := newShareTestServer(t, &fakeShareRunner{})
	req := httptest.NewRequest(http.MethodPost, "/share", nil)
	rec := httptest.NewRecorder()
	s.handleShare(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestHandleShareReportsAuthFailure(t *testing.T) {
	runner := &fakeShareRunner{authErr: errors.New("not logged in")}
	s, _ := newShareTestServer(t, runner)
	req := httptest.NewRequest(http.MethodPost, "/share?id=session.jsonl", nil)
	rec := httptest.NewRecorder()
	s.handleShare(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "not logged in") && !strings.Contains(rec.Body.String(), "gh auth login") {
		t.Fatalf("body = %q", rec.Body.String())
	}
	if runner.createCalled {
		t.Fatal("createGist must not run when auth check fails")
	}
}

func TestHandleShareRejectsUnknownSession(t *testing.T) {
	runner := &fakeShareRunner{}
	s, _ := newShareTestServer(t, runner)
	req := httptest.NewRequest(http.MethodPost, "/share?id=missing.jsonl", nil)
	rec := httptest.NewRecorder()
	s.handleShare(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	if runner.createCalled {
		t.Fatal("createGist must not run for unknown session")
	}
}

func TestHandleShareSucceeds(t *testing.T) {
	runner := &fakeShareRunner{
		createOut: "https://gist.github.com/setkyar/abc123\n",
	}
	s, _ := newShareTestServer(t, runner)
	req := httptest.NewRequest(http.MethodPost, "/share?id=session.jsonl", nil)
	rec := httptest.NewRecorder()
	s.handleShare(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %q", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"gistId":"abc123"`) {
		t.Fatalf("body missing gistId: %q", body)
	}
	if !strings.Contains(body, `"previewUrl":"https://pi.dev/session/#abc123"`) {
		t.Fatalf("body missing previewUrl: %q", body)
	}
	if !runner.createCalled {
		t.Fatal("expected createGist to be called")
	}
}

func TestHandleShareReportsCreateFailure(t *testing.T) {
	runner := &fakeShareRunner{
		createErr:    errors.New("exit status 1"),
		createStderr: "rate limited",
	}
	s, _ := newShareTestServer(t, runner)
	req := httptest.NewRequest(http.MethodPost, "/share?id=session.jsonl", nil)
	rec := httptest.NewRecorder()
	s.handleShare(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "rate limited") {
		t.Fatalf("body did not include stderr: %q", rec.Body.String())
	}
}

func TestShareEndpointEnforcesAuth(t *testing.T) {
	runner := &fakeShareRunner{createOut: "https://gist.github.com/u/x\n"}
	s, _ := newShareTestServer(t, runner)
	authMiddleware := auth.New("secret")
	handler := authMiddleware.Wrap(s.handleShare)

	// Missing token → 401
	req := httptest.NewRequest(http.MethodPost, "/share?id=session.jsonl", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("missing token: status = %d, want 401", rec.Code)
	}
	if runner.createCalled {
		t.Fatal("share must not run without auth")
	}

	// With token → 200
	req2 := httptest.NewRequest(http.MethodPost, "/share?id=session.jsonl", nil)
	req2.Header.Set("X-Pi-Token", "secret")
	rec2 := httptest.NewRecorder()
	handler(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("with token: status = %d body = %q", rec2.Code, rec2.Body.String())
	}
}
