package app

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"pi-web/internal/auth"
	"pi-web/internal/frontend"
	"pi-web/internal/rpc"
	"pi-web/internal/server"
	"pi-web/internal/sessions"
	"pi-web/internal/ui"
	"pi-web/internal/updater"
	"pi-web/internal/workers"
	"pi-web/web"
)

const defaultPort = "31415"
const tokenEnvVar = "PI_WEB_TOKEN"

// Main runs the pi-web application. version is supplied by cmd/pi-web so
// release builds can set it with -ldflags "-X main.version=...".
func Main(version string) {
	port := flag.String("p", defaultPort, "port to listen on")
	hostOverride := flag.String("host", "", "host/IP to bind; defaults to 127.0.0.1")
	open := flag.Bool("o", false, "auto-open browser")
	insecure := flag.Bool("insecure", false, "allow non-loopback bind without "+tokenEnvVar+" (DANGEROUS)")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println(version)
		os.Exit(0)
	}

	agentDir := piAgentDir()
	if err := seedSoundsDir(agentDir); err != nil {
		fmt.Fprintf(os.Stderr, "failed to seed sounds directory: %v\n", err)
	}
	sessionsDir := filepath.Join(agentDir, "sessions")
	if _, err := os.Stat(sessionsDir); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "sessions directory not found: %s\n", sessionsDir)
		os.Exit(1)
	}

	bindHost := chooseBindHost(*hostOverride)
	token := os.Getenv(tokenEnvVar)
	tokenRequired := token == "" && !isLoopbackHost(bindHost) && !*insecure
	if tokenRequired {
		fmt.Fprintf(os.Stderr,
			"refusing to bind %s without %s set: anyone reachable on this address could view sessions and drive pi.\n"+
				"  set %s=$(openssl rand -hex 16) to require a token, or pass --insecure to override.\n",
			bindHost, tokenEnvVar, tokenEnvVar)
		os.Exit(1)
	}
	authMiddleware := auth.New(token)

	versionChecker := updater.New(version)

	var srv *server.Server
	manager := workers.NewManager(func(sessionID, sessionPath string) (workers.ChatWorker, error) {
		return rpc.NewPiWorkerWithStream(sessionPath, func(preview rpc.StreamPreview) {
			if srv != nil {
				srv.BroadcastChatPreview(sessionID, preview)
			}
		})
	})
	srv = server.New(server.Deps{
		AgentDir:            agentDir,
		SessionsDir:         sessionsDir,
		Auth:                authMiddleware,
		ChatSender:          manager,
		Cache:               sessions.NewCache(),
		RenderIndex:         ui.RenderIndex,
		RenderLiveSession:   ui.RenderLiveSessionPage,
		RenderExportSession: ui.RenderExportSessionPage,
		RenderSettings:      ui.RenderSettings,
		Models: func(ctx context.Context) (json.RawMessage, error) {
			return defaultModelsCache.get(ctx)
		},
		Updater:    versionChecker,
		RunInstall: runInstall,
		RunRestart: runRestart,
	})

	ui.SetThemeProvider(srv.ThemeSetting)
	ui.SetFontProvider(srv.FontStyles)

	mux := http.NewServeMux()
	srv.Register(mux)
	ui.RegisterPWAHandlers(mux)
	dfs := web.DistFS()
	if scripts, err := frontend.LoadScripts(dfs, frontend.IndexEntry, frontend.SessionEntry, frontend.SettingsEntry, frontend.LiveEntry); err == nil {
		for _, script := range scripts {
			switch script.Entry {
			case frontend.IndexEntry:
				ui.SetIndexScriptPath(script.Path)
			case frontend.SessionEntry:
				ui.SetSessionScriptPath(script.Path)
			case frontend.SettingsEntry:
				ui.SetSettingsScriptPath(script.Path)
			}
			mux.HandleFunc(script.Path, frontend.ServeJS(script.JS, script.Path != "/static/assets/index.js"))
		}
		// Serve all other hashed assets (lazy chunks, runtime) from the embed FS.
		mux.HandleFunc("/static/assets/", frontend.ServeStaticAssets(dfs))
	} else {
		fmt.Fprintf(os.Stderr, "WARNING: failed to load Vite frontend scripts: %v (frontend JS will be unavailable)\n", err)
	}

	addr := net.JoinHostPort(bindHost, *port)
	url := fmt.Sprintf("http://%s", net.JoinHostPort(bindHost, *port))
	var tailscaleURL string
	var tailscaleServe bool
	if *hostOverride == "" {
		tsCtx, tsCancel := context.WithTimeout(context.Background(), tailscaleConfigureTimeout)
		tsURL, tsOk, tsErr := configureTailscaleServe(tsCtx, *port)
		tsCancel()
		if tsErr == nil && tsOk {
			tailscaleURL = tsURL
			tailscaleServe = true
		} else if tsErr != nil {
			if tsCtx.Err() == context.DeadlineExceeded {
				fmt.Fprintf(os.Stderr, "Tailscale Serve timed out after %s; continuing without it\n", tailscaleConfigureTimeout)
			} else {
				fmt.Fprintf(os.Stderr, "Tailscale Serve unavailable: %v\n", tsErr)
			}
		}
	}
	fmt.Printf("Pi Sessions Viewer -> %s\n", url)
	if tailscaleURL != "" {
		fmt.Printf("Tailscale HTTPS -> %s\n", tailscaleURL)
	}
	fmt.Printf("Serving from: %s\n", sessionsDir)
	if authMiddleware.Enabled() {
		fmt.Println("Auth: enabled (set PI_WEB_TOKEN to require token)")
	} else {
		fmt.Printf("Auth: disabled — set %s to require a token for access.\n", tokenEnvVar)
	}

	stateFilePath, err := writeStateFile(agentDir, bindHost, *port, tailscaleServe, tailscaleURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
	defer func() {
		if stateFile != nil {
			_ = stateFile.Close()
		}
		_ = os.Remove(stateFilePath)
	}()

	if *open {
		go func() {
			time.Sleep(300 * time.Millisecond)
			openBrowser(url)
		}()
	}

	warmModelsCache()

	httpServer := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
		// WriteTimeout intentionally 0 — SSE streams are long-lived.
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go versionChecker.Start(ctx)

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
		srv.Shutdown()
		_ = manager.Close()
	}()

	serveErr := httpServer.ListenAndServe()
	if serveErr != nil && serveErr != http.ErrServerClosed {
		fmt.Fprintf(os.Stderr, "server error: %v\n", serveErr)
		os.Exit(1)
	}
}

func openBrowser(url string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
		args = []string{url}
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start", url}
	default:
		cmd = "xdg-open"
		args = []string{url}
	}
	exec.Command(cmd, args...).Start()
}

// piAgentDir returns the Pi agent config directory.
// It respects the PI_CODING_AGENT_DIR environment variable, falling back to
// ~/.pi/agent.
func piAgentDir() string {
	if dir := os.Getenv("PI_CODING_AGENT_DIR"); dir != "" {
		return dir
	}
	home, _ := os.UserHomeDir()
	if home == "" {
		home = os.Getenv("HOME")
	}
	return filepath.Join(home, ".pi", "agent")
}

// piWebDir returns the pi-web data directory inside the Pi agent dir.
func piWebDir() string {
	return filepath.Join(piAgentDir(), "pi-web")
}

// stateFile is held open for the lifetime of the process so the flock stays
// in effect. Closing it releases the lock.
var stateFile *os.File

func writeStateFile(agentDir, host, port string, tailscale bool, tailscaleURL string) (string, error) {
	webDir := filepath.Join(agentDir, "pi-web")
	if err := os.MkdirAll(webDir, 0755); err != nil {
		return "", err
	}
	path := filepath.Join(webDir, "pi-web-state.json")

	// Migrate old state file from pre-pi-web directory layout.
	// Only migrate when the new path does not already exist; otherwise
	// os.Rename would unlink a destination inode that another pi-web
	// process may already hold a flock on, defeating the single-instance
	// lock.
	oldPath := filepath.Join(agentDir, "pi-web-state.json")
	if _, err := os.Stat(oldPath); err == nil {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			_ = os.Rename(oldPath, path)
		}
	}

	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return "", err
	}
	if err := lockStateFile(f); err != nil {
		_ = f.Close()
		return "", err
	}
	data, err := json.Marshal(map[string]any{
		"pid":          os.Getpid(),
		"port":         port,
		"host":         host,
		"tailscale":    tailscale,
		"tailscaleUrl": tailscaleURL,
		"startedAt":    time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		_ = f.Close()
		return "", err
	}
	if err := f.Truncate(0); err != nil {
		_ = f.Close()
		return "", err
	}
	if _, err := f.WriteAt(data, 0); err != nil {
		_ = f.Close()
		return "", err
	}
	stateFile = f
	return path, nil
}

// seedSoundsDir ensures that ~/.pi/agent/pi-web/assets exists and seeds it with default sounds if empty.
func seedSoundsDir(agentDir string) error {
	soundsDir := filepath.Join(agentDir, "pi-web", "assets")
	if err := os.MkdirAll(soundsDir, 0755); err != nil {
		return fmt.Errorf("failed to create sounds directory: %w", err)
	}

	files, err := os.ReadDir(soundsDir)
	if err != nil {
		return fmt.Errorf("failed to read sounds directory: %w", err)
	}

	hasMP3 := false
	for _, f := range files {
		if !f.IsDir() && filepath.Ext(strings.ToLower(f.Name())) == ".mp3" {
			hasMP3 = true
			break
		}
	}

	if !hasMP3 {
		// Seed cat.mp3
		catPath := filepath.Join(soundsDir, "cat.mp3")
		if err := os.WriteFile(catPath, ui.CatMP3, 0644); err != nil {
			return fmt.Errorf("failed to seed cat.mp3: %w", err)
		}
		// Seed done.mp3
		donePath := filepath.Join(soundsDir, "done.mp3")
		if err := os.WriteFile(donePath, ui.DoneMP3, 0644); err != nil {
			return fmt.Errorf("failed to seed done.mp3: %w", err)
		}
	}
	return nil
}

