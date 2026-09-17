package app

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

var (
	tailscaleCommandTimeout   = 10 * time.Second
	tailscaleConfigureTimeout = 12 * time.Second
)

func tailscaleCLI() (string, error) {
	if bin, err := exec.LookPath("tailscale"); err == nil {
		return bin, nil
	}

	for _, path := range []string{
		"/Applications/Tailscale.app/Contents/MacOS/Tailscale",
		"/Applications/Tailscale.app/Contents/MacOS/tailscale",
		"/opt/homebrew/bin/tailscale",
		"/usr/local/bin/tailscale",
		"/usr/bin/tailscale",
	} {
		if st, err := os.Stat(path); err == nil && !st.IsDir() && st.Mode()&0111 != 0 {
			return path, nil
		}
	}

	return "", fmt.Errorf("tailscale CLI not found in PATH or common install locations")
}

// tailscaleSelfDNS returns the Tailscale MagicDNS name for this node
// (e.g. "personal-laptop.tail9f98d.ts.net"). Returns an error if the
// tailscale CLI is unavailable, the node is not connected, or MagicDNS is off.
func tailscaleSelfDNS(ctx context.Context) (string, error) {
	bin, err := tailscaleCLI()
	if err != nil {
		return "", err
	}
	cmdCtx, cancel := context.WithTimeout(ctx, tailscaleCommandTimeout)
	defer cancel()
	out, err := exec.CommandContext(cmdCtx, bin, "status", "--json").Output()
	if err != nil {
		return "", fmt.Errorf("tailscale status failed: %w", err)
	}
	var status struct {
		BackendState string `json:"BackendState"`
		Self         struct {
			DNSName string `json:"DNSName"`
		} `json:"Self"`
	}
	if err := json.Unmarshal(out, &status); err != nil {
		// Include raw output in error so we can see what tailscale actually returned
		preview := string(out)
		if len(preview) > 200 {
			preview = preview[:200] + "..."
		}
		return "", fmt.Errorf("parse tailscale status: %w (raw: %q)", err, preview)
	}
	if status.BackendState != "Running" {
		return "", fmt.Errorf("tailscale not running (BackendState=%s)", status.BackendState)
	}
	name := strings.TrimSuffix(status.Self.DNSName, ".")
	if name == "" {
		return "", fmt.Errorf("tailscale Self.DNSName is empty; is MagicDNS enabled in your tailnet admin console?")
	}
	return name, nil
}

type serveRuleState int

const (
	serveRuleMissing serveRuleState = iota
	serveRuleSame
	serveRuleConflict
)

// configureTailscaleServe publishes the local HTTP server through Tailscale Serve.
// Tailscale owns HTTPS/certs; pi-web keeps listening only on localhost.
func configureTailscaleServe(ctx context.Context, port string) (string, bool, error) {
	hostname, err := tailscaleSelfDNS(ctx)
	if err != nil {
		return "", false, err
	}
	bin, err := tailscaleCLI()
	if err != nil {
		return "", false, err
	}
	target := "http://127.0.0.1:" + port
	url := "https://" + hostname + ":" + port

	state, err := tailscaleServeRuleState(ctx, bin, port, target)
	if err != nil {
		return "", false, err
	}
	switch state {
	case serveRuleSame:
		return url, true, nil
	case serveRuleConflict:
		return "", false, fmt.Errorf("tailscale HTTPS port %s is already configured for another service; not overwriting it. To replace it, run: tailscale serve --bg --https=%s %s", port, port, target)
	}

	cmdCtx, cancel := context.WithTimeout(ctx, tailscaleCommandTimeout)
	defer cancel()
	cmd := exec.CommandContext(cmdCtx, bin, "serve", "--bg", "--https="+port, target)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return "", false, fmt.Errorf("tailscale serve failed: %w", err)
	}
	return url, true, nil
}

// tailscaleServeConfig is the subset of `tailscale serve status --json`
// (ipn.ServeConfig) that decides whether our rule is already in place. The
// port appears as a bare key only under TCP, which holds no proxy target; the
// proxy lives under Web, keyed "<magicdns-name>:<port>".
type tailscaleServeConfig struct {
	TCP map[string]struct {
		HTTPS      bool   `json:"HTTPS"`
		HTTP       bool   `json:"HTTP"`
		TCPForward string `json:"TCPForward"`
	} `json:"TCP"`
	Web map[string]struct {
		Handlers map[string]struct {
			Proxy string `json:"Proxy"`
		} `json:"Handlers"`
	} `json:"Web"`
}

func tailscaleServeRuleState(ctx context.Context, bin, port, target string) (serveRuleState, error) {
	cmdCtx, cancel := context.WithTimeout(ctx, tailscaleCommandTimeout)
	defer cancel()
	out, err := exec.CommandContext(cmdCtx, bin, "serve", "status", "--json").Output()
	if err != nil {
		return serveRuleMissing, fmt.Errorf("tailscale serve status failed: %w", err)
	}
	var cfg tailscaleServeConfig
	if err := json.Unmarshal(out, &cfg); err != nil {
		return serveRuleMissing, fmt.Errorf("parse tailscale serve status: %w", err)
	}

	claimed := false
	for hostPort, web := range cfg.Web {
		if !strings.HasSuffix(hostPort, ":"+port) {
			continue
		}
		claimed = true
		for _, handler := range web.Handlers {
			if handler.Proxy == target {
				return serveRuleSame, nil
			}
		}
	}
	if claimed {
		return serveRuleConflict, nil
	}
	// A TCP entry with no matching Web proxy is someone else's rule (a raw
	// TCPForward, or an HTTPS terminator we did not create): do not overwrite it.
	if _, ok := cfg.TCP[port]; ok {
		return serveRuleConflict, nil
	}
	return serveRuleMissing, nil
}
