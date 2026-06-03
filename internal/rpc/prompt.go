package rpc

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// PromptOpts configures a one-shot, ephemeral prompt run.
type PromptOpts struct {
	// Message is the user prompt to send.
	Message string
	// Model is a "provider/id" (optionally ":thinking") pattern, or "" for pi's
	// default model.
	Model string
	// SystemPrompt overrides pi's default coding-assistant system prompt.
	SystemPrompt string
}

// OneShotPrompt spawns an ephemeral, tool-less `pi --mode rpc`, sends a single
// prompt, accumulates the assistant's reply text, and tears the subprocess
// down. It is the structured-RPC analogue of OneShot for sessionless
// completions (e.g. generating a session title) and never writes to the
// sessions directory.
//
// The flags matter:
//   - --no-session       ephemeral; nothing is persisted to the sessions dir.
//   - --no-tools         single non-agentic turn (no tool loop).
//   - --no-extensions    skip extension discovery / UI noise.
//   - --no-context-files don't load AGENTS.md/CLAUDE.md into the prompt.
func OneShotPrompt(ctx context.Context, opts PromptOpts) (string, error) {
	if strings.TrimSpace(opts.Message) == "" {
		return "", errors.New("prompt message is empty")
	}
	if _, err := exec.LookPath("pi"); err != nil {
		return "", fmt.Errorf("pi executable not found: %w", err)
	}

	args := []string{"--mode", "rpc", "--no-session", "--no-tools", "--no-extensions", "--no-context-files"}
	if strings.TrimSpace(opts.Model) != "" {
		args = append(args, "--model", opts.Model)
	}
	if strings.TrimSpace(opts.SystemPrompt) != "" {
		args = append(args, "--system-prompt", opts.SystemPrompt)
	}

	cmd := exec.CommandContext(ctx, "pi", args...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return "", err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	var stderrBuf strings.Builder
	cmd.Stderr = &stderrBuf

	if err := cmd.Start(); err != nil {
		return "", err
	}
	// Keep stdin open for the lifetime of the call: closing it early makes pi
	// shut down before the turn runs. We close it in the teardown below.
	defer func() {
		_ = stdin.Close()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
	}()

	reqID := fmt.Sprintf("title-%d", time.Now().UnixNano())
	promptCmd := map[string]any{
		"id":                reqID,
		"type":              "prompt",
		"message":           opts.Message,
		"streamingBehavior": "steer",
	}
	if err := WriteCommand(stdin, promptCmd); err != nil {
		return "", err
	}

	type result struct {
		text string
		err  error
	}
	resCh := make(chan result, 1)
	go func() {
		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
		var text string
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || line[0] != '{' {
				continue
			}
			var probe struct {
				Type string `json:"type"`
				ID   string `json:"id"`
			}
			if err := json.Unmarshal([]byte(line), &probe); err != nil {
				continue
			}
			switch probe.Type {
			case "agent_end":
				// The clean, complete reply is the last assistant message here.
				if t := assistantTextFromAgentEnd(line); t != "" {
					text = t
				}
			case "response":
				if probe.ID != reqID {
					continue
				}
				resCh <- result{text: text}
				return
			}
		}
		if err := scanner.Err(); err != nil {
			resCh <- result{err: err}
			return
		}
		resCh <- result{err: fmt.Errorf("pi closed stdout without a prompt response (stderr: %q)", stderrBuf.String())}
	}()

	select {
	case r := <-resCh:
		if r.err != nil {
			return "", r.err
		}
		return strings.TrimSpace(r.text), nil
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

// assistantTextFromAgentEnd pulls the final assistant text out of an agent_end
// event line: messages[last assistant].content[] joined over type=="text".
func assistantTextFromAgentEnd(line string) string {
	var ev struct {
		Messages []struct {
			Role    string `json:"role"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal([]byte(line), &ev); err != nil {
		return ""
	}
	for i := len(ev.Messages) - 1; i >= 0; i-- {
		if ev.Messages[i].Role != "assistant" {
			continue
		}
		var b strings.Builder
		for _, c := range ev.Messages[i].Content {
			if c.Type == "text" {
				b.WriteString(c.Text)
			}
		}
		if b.Len() > 0 {
			return b.String()
		}
	}
	return ""
}
