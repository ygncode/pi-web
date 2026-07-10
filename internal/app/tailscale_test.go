package app

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func writeFakeTailscale(t *testing.T, dir, script string) string {
	t.Helper()
	if runtime.GOOS == "windows" {
		// The fake CLI is a shell script; the code under test is
		// platform-neutral exec.Command plumbing.
		t.Skip("fake tailscale CLI requires a Unix shell")
	}
	binPath := filepath.Join(dir, "tailscale")
	if err := os.WriteFile(binPath, []byte(script), 0755); err != nil {
		t.Fatalf("write fake tailscale: %v", err)
	}
	oldPath := os.Getenv("PATH")
	t.Setenv("PATH", dir+string(os.PathListSeparator)+oldPath)
	return binPath
}

func TestConfigureTailscaleServeRunsServeCommandWhenNoExistingRule(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "tailscale-args.log")
	writeFakeTailscale(t, dir, `#!/bin/sh
if [ "$1" = "status" ] && [ "$2" = "--json" ]; then
  printf '%s\n' '{"BackendState":"Running","Self":{"DNSName":"macbook.tailnet.ts.net."}}'
  exit 0
fi
if [ "$1" = "serve" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then
  printf '%s\n' '{}'
  exit 0
fi
if [ "$1" = "serve" ]; then
  printf '%s\n' "$*" > "`+logPath+`"
  exit 0
fi
echo "unexpected tailscale args: $*" >&2
exit 2
`)

	url, ok, err := configureTailscaleServe(context.Background(), "31415")
	if err != nil {
		t.Fatalf("configureTailscaleServe returned error: %v", err)
	}
	if !ok {
		t.Fatalf("ok = false, want true")
	}
	if url != "https://macbook.tailnet.ts.net:31415" {
		t.Fatalf("url = %q, want tailscale HTTPS URL", url)
	}

	logged, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("read fake tailscale log: %v", err)
	}
	got := strings.TrimSpace(string(logged))
	want := "serve --bg --https=31415 http://127.0.0.1:31415"
	if got != want {
		t.Fatalf("tailscale serve args = %q, want %q", got, want)
	}
}

func TestConfigureTailscaleServeDoesNothingWhenSameRuleExists(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "tailscale-args.log")
	writeFakeTailscale(t, dir, `#!/bin/sh
if [ "$1" = "status" ] && [ "$2" = "--json" ]; then
  printf '%s\n' '{"BackendState":"Running","Self":{"DNSName":"macbook.tailnet.ts.net."}}'
  exit 0
fi
if [ "$1" = "serve" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then
  printf '%s\n' '{"HTTPS":{"31415":{"Handlers":{"/":{"Proxy":"http://127.0.0.1:31415"}}}}}'
  exit 0
fi
if [ "$1" = "serve" ]; then
  printf '%s\n' "$*" > "`+logPath+`"
  exit 0
fi
exit 2
`)

	url, ok, err := configureTailscaleServe(context.Background(), "31415")
	if err != nil {
		t.Fatalf("configureTailscaleServe returned error: %v", err)
	}
	if !ok {
		t.Fatalf("ok = false, want true")
	}
	if url != "https://macbook.tailnet.ts.net:31415" {
		t.Fatalf("url = %q, want tailscale HTTPS URL", url)
	}
	if _, err := os.Stat(logPath); !os.IsNotExist(err) {
		t.Fatalf("tailscale serve was run despite matching existing rule")
	}
}

func TestConfigureTailscaleServeDoesNotOverwriteDifferentRule(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "tailscale-args.log")
	writeFakeTailscale(t, dir, `#!/bin/sh
if [ "$1" = "status" ] && [ "$2" = "--json" ]; then
  printf '%s\n' '{"BackendState":"Running","Self":{"DNSName":"macbook.tailnet.ts.net."}}'
  exit 0
fi
if [ "$1" = "serve" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then
  printf '%s\n' '{"HTTPS":{"31415":{"Handlers":{"/":{"Proxy":"http://127.0.0.1:9000"}}}}}'
  exit 0
fi
if [ "$1" = "serve" ]; then
  printf '%s\n' "$*" > "`+logPath+`"
  exit 0
fi
exit 2
`)

	_, ok, err := configureTailscaleServe(context.Background(), "31415")
	if err == nil || !strings.Contains(err.Error(), "already configured") {
		t.Fatalf("configureTailscaleServe error = %v, want conflict", err)
	}
	if ok {
		t.Fatalf("ok = true, want false")
	}
	if _, err := os.Stat(logPath); !os.IsNotExist(err) {
		t.Fatalf("tailscale serve was run despite conflicting existing rule")
	}
}

func TestTailscaleSelfDNSRejectsStoppedBackend(t *testing.T) {
	dir := t.TempDir()
	writeFakeTailscale(t, dir, `#!/bin/sh
if [ "$1" = "status" ] && [ "$2" = "--json" ]; then
  printf '%s\n' '{"BackendState":"Stopped","Self":{"DNSName":"macbook.tailnet.ts.net."}}'
  exit 0
fi
exit 2
`)

	_, err := tailscaleSelfDNS(context.Background())
	if err == nil || !strings.Contains(err.Error(), "BackendState=Stopped") {
		t.Fatalf("tailscaleSelfDNS error = %v, want BackendState error", err)
	}
}

func TestConfigureTailscaleServeOverallDeadlinePreventsLateServe(t *testing.T) {
	oldCommandTimeout := tailscaleCommandTimeout
	tailscaleCommandTimeout = time.Second
	t.Cleanup(func() { tailscaleCommandTimeout = oldCommandTimeout })

	dir := t.TempDir()
	logPath := filepath.Join(dir, "tailscale-args.log")
	writeFakeTailscale(t, dir, `#!/bin/sh
if [ "$1" = "status" ] && [ "$2" = "--json" ]; then
  printf '%s\n' '{"BackendState":"Running","Self":{"DNSName":"macbook.tailnet.ts.net."}}'
  exit 0
fi
if [ "$1" = "serve" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then
  exec sleep 1
fi
if [ "$1" = "serve" ]; then
  printf '%s\n' "$*" > "`+logPath+`"
  exit 0
fi
exit 2
`)

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	_, ok, err := configureTailscaleServe(ctx, "31415")
	if err == nil {
		t.Fatalf("configureTailscaleServe error = nil, want deadline error")
	}
	if ok {
		t.Fatalf("ok = true, want false")
	}

	// If configure work escaped the deadline, it could still invoke serve --bg later.
	time.Sleep(100 * time.Millisecond)
	if _, err := os.Stat(logPath); !os.IsNotExist(err) {
		t.Fatalf("tailscale serve was run after overall deadline")
	}
}
