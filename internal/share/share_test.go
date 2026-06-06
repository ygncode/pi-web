package share

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"pi-web/internal/sessions"
)

// fakeRunner is a configurable Runner stub: it records the html path it was
// handed and returns canned auth/gist results so Handle can be exercised
// without a real gh binary or network.
type fakeRunner struct {
	authErr     error
	gistStdout  string
	gistStderr  string
	gistErr     error
	gotHTMLPath string
}

func (f *fakeRunner) AuthStatus() error { return f.authErr }

func (f *fakeRunner) CreateGist(htmlPath string) (string, string, error) {
	f.gotHTMLPath = htmlPath
	return f.gistStdout, f.gistStderr, f.gistErr
}

// baseDeps returns Dependencies that resolve any id to a fixed session and
// render a recognizable HTML body. Individual tests override fields as needed.
func baseDeps(runner Runner) Dependencies {
	return Dependencies{
		Runner: runner,
		Resolve: func(id string) (sessions.Session, error) {
			return sessions.Session{}, nil
		},
		RenderExport: func(sessions.Session, string) string {
			return "<html>exported</html>"
		},
	}
}

func TestHandlePreviewReturnsHTML(t *testing.T) {
	deps := baseDeps(nil) // preview must not need a runner
	deps.RenderExport = func(_ sessions.Session, theme string) string {
		return "<html>theme=" + theme + "</html>"
	}

	req := httptest.NewRequest(http.MethodGet, "/share?id=abc&preview=1", nil)
	req.AddCookie(&http.Cookie{Name: "pi-web-theme", Value: "nord"})
	rec := httptest.NewRecorder()

	Handle(rec, req, deps)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Fatalf("content-type = %q, want text/html", ct)
	}
	if body := rec.Body.String(); body != "<html>theme=nord</html>" {
		t.Fatalf("body = %q; want themed export html", body)
	}
}

func TestHandlePreviewRejectsNonGet(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/share?id=abc&preview=1", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, baseDeps(nil))

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestHandlePreviewMissingID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/share?preview=1", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, baseDeps(nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestHandleRejectsNonPost(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/share?id=abc", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, baseDeps(&fakeRunner{}))

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestHandleMissingID(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/share", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, baseDeps(&fakeRunner{}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestHandleGhNotInstalled(t *testing.T) {
	deps := baseDeps(nil) // nil runner forces the FindGh path
	deps.FindGh = func() string { return "" }

	req := httptest.NewRequest(http.MethodPost, "/share?id=abc", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, deps)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "gh") {
		t.Fatalf("body = %q; want a gh-not-installed message", rec.Body.String())
	}
}

func TestHandleAuthFailure(t *testing.T) {
	runner := &fakeRunner{authErr: errors.New("not logged in")}

	req := httptest.NewRequest(http.MethodPost, "/share?id=abc", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, baseDeps(runner))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "auth login") {
		t.Fatalf("body = %q; want a gh-auth-login hint", rec.Body.String())
	}
}

func TestHandleResolveFailure(t *testing.T) {
	deps := baseDeps(&fakeRunner{})
	deps.Resolve = func(id string) (sessions.Session, error) {
		return sessions.Session{}, errors.New("nope")
	}

	req := httptest.NewRequest(http.MethodPost, "/share?id=missing", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, deps)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestHandleEmptyExportIsNotFound(t *testing.T) {
	deps := baseDeps(&fakeRunner{})
	deps.RenderExport = func(sessions.Session, string) string { return "" }

	req := httptest.NewRequest(http.MethodPost, "/share?id=abc", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, deps)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestHandleGistFailureReportsStderr(t *testing.T) {
	runner := &fakeRunner{gistErr: errors.New("boom"), gistStderr: "gh: rate limited"}

	req := httptest.NewRequest(http.MethodPost, "/share?id=abc", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, baseDeps(runner))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "rate limited") {
		t.Fatalf("body = %q; want surfaced stderr", rec.Body.String())
	}
}

func TestHandleSuccess(t *testing.T) {
	runner := &fakeRunner{gistStdout: "https://gist.github.com/user/deadbeef\n"}
	deps := baseDeps(runner)
	deps.RenderExport = func(sessions.Session, string) string { return "<html>snapshot</html>" }

	req := httptest.NewRequest(http.MethodPost, "/share?id=abc", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, deps)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body := rec.Body.String()
	for _, want := range []string{
		`"gistUrl":"https://gist.github.com/user/deadbeef"`,
		`"gistId":"deadbeef"`,
		`"previewUrl":"https://pi.dev/session/#deadbeef"`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("body = %q; missing %q", body, want)
		}
	}

	// The runner should have been handed a real temp file containing the
	// rendered snapshot.
	if runner.gotHTMLPath == "" {
		t.Fatal("CreateGist never received an html path")
	}
	if filepath.Base(runner.gotHTMLPath) != "session.html" {
		t.Fatalf("html path = %q; want a session.html file", runner.gotHTMLPath)
	}
}

func TestHandleDefaultsThemeWithoutCookie(t *testing.T) {
	var gotTheme string
	deps := baseDeps(&fakeRunner{gistStdout: "https://gist.github.com/u/abc"})
	deps.RenderExport = func(_ sessions.Session, theme string) string {
		gotTheme = theme
		return "<html>x</html>"
	}

	req := httptest.NewRequest(http.MethodPost, "/share?id=abc", nil)
	rec := httptest.NewRecorder()

	Handle(rec, req, deps)

	if gotTheme != "dark" {
		t.Fatalf("theme = %q; want dark default", gotTheme)
	}
}

func TestFindGhPrefersLocalBinary(t *testing.T) {
	// FindGh checks a fixed list of absolute paths before falling back to
	// PATH lookup. We can't write to those, but we can assert the fallback:
	// with an empty PATH and no candidates present, it returns "".
	t.Setenv("PATH", "")
	if got := FindGh(); got != "" {
		// A real /usr/bin/gh etc. may exist on the host; only assert when the
		// well-known candidates are genuinely absent.
		for _, c := range []string{"/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh", "/bin/gh"} {
			if _, err := os.Stat(c); err == nil {
				return // a candidate legitimately exists; nothing to assert
			}
		}
		t.Fatalf("FindGh = %q; want empty when no gh on PATH or known paths", got)
	}
}
