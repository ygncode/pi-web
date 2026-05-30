package share

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"pi-web/internal/sessions"
)

type Runner interface {
	AuthStatus() error
	CreateGist(htmlPath string) (string, string, error)
}

type GhRunner struct{ GhPath string }

func (g GhRunner) AuthStatus() error {
	return exec.Command(g.GhPath, "auth", "status").Run()
}

func (g GhRunner) CreateGist(htmlPath string) (string, string, error) {
	cmd := exec.Command(g.GhPath, "gist", "create", "--public=false", htmlPath)
	out, err := cmd.Output()
	var stderr string
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			stderr = string(exitErr.Stderr)
		}
	}
	return string(out), stderr, err
}

func FindGh() string {
	candidates := []string{
		"/opt/homebrew/bin/gh",
		"/usr/local/bin/gh",
		"/usr/bin/gh",
		"/bin/gh",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	if p, err := exec.LookPath("gh"); err == nil {
		return p
	}
	return ""
}

type Dependencies struct {
	Runner  Runner
	Resolve func(id string) (sessions.Session, error)
	RenderExport func(sessions.Session, string) string
	FindGh  func() string
}

func Handle(w http.ResponseWriter, r *http.Request, deps Dependencies) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "missing id")
		return
	}

	runner := deps.Runner
	if runner == nil {
		findGh := deps.FindGh
		if findGh == nil {
			findGh = FindGh
		}
		ghPath := findGh()
		if ghPath == "" {
			writeJSONError(w, http.StatusBadRequest, "GitHub CLI (gh) not installed. Install from https://cli.github.com/")
			return
		}
		runner = GhRunner{GhPath: ghPath}
	}

	if err := runner.AuthStatus(); err != nil {
		writeJSONError(w, http.StatusBadRequest, "GitHub CLI not logged in. Run 'gh auth login' first.")
		return
	}

	resolved, err := deps.Resolve(id)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "session not found")
		return
	}
	theme := "dark"
	if cookie, err := r.Cookie("pi-web-theme"); err == nil {
		theme = cookie.Value
	}
	html := deps.RenderExport(resolved, theme)
	if html == "" {
		writeJSONError(w, http.StatusNotFound, "session not found")
		return
	}

	tmpDir, err := os.MkdirTemp(os.TempDir(), "pi-share-*")
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create temp dir: "+err.Error())
		return
	}
	defer os.RemoveAll(tmpDir)
	tmpFile := filepath.Join(tmpDir, "session.html")
	if err := os.WriteFile(tmpFile, []byte(html), 0644); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to write temp file: "+err.Error())
		return
	}

	stdout, stderr, err := runner.CreateGist(tmpFile)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{"error": "failed to create gist", "stderr": stderr})
		return
	}

	gistUrl := strings.TrimSpace(stdout)
	gistId := ""
	if parts := strings.Split(gistUrl, "/"); len(parts) > 0 {
		gistId = parts[len(parts)-1]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"gistUrl":    gistUrl,
		"gistId":     gistId,
		"previewUrl": "https://pi.dev/session/#" + gistId,
	})
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"error": message})
}
