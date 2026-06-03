package rpc

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"testing"

	"pi-web/internal/chat"
)

func readJSONLLines(r io.Reader) ([]string, error) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 10*1024*1024)
	var lines []string
	for scanner.Scan() {
		line := strings.TrimSuffix(scanner.Text(), "\r")
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return lines, nil
}

func TestSplitJSONLLinesHandlesCRLF(t *testing.T) {
	lines, err := readJSONLLines(bytes.NewBufferString("{\"a\":1}\r\n{\"b\":2}\n"))
	if err != nil {
		t.Fatalf("readJSONLLines error: %v", err)
	}
	if len(lines) != 2 || lines[0] != `{"a":1}` || lines[1] != `{"b":2}` {
		t.Fatalf("lines = %#v", lines)
	}
}

func TestBuildPromptCommandUsesSteerWhenStreaming(t *testing.T) {
	cmd := BuildPromptCommand("req-1", chat.Request{Message: "hello"}, true)
	if cmd["id"] != "req-1" || cmd["type"] != "prompt" || cmd["streamingBehavior"] != "steer" {
		t.Fatalf("cmd = %#v", cmd)
	}
}

func TestBuildPromptCommandOmitsSteerWhenIdle(t *testing.T) {
	cmd := BuildPromptCommand("req-1", chat.Request{Message: "hello"}, false)
	if _, ok := cmd["streamingBehavior"]; ok {
		t.Fatalf("streamingBehavior present for idle command")
	}
}

func TestBuildGetCommandsCommand(t *testing.T) {
	cmd := BuildGetCommandsCommand("req-7")
	if cmd["id"] != "req-7" || cmd["type"] != "get_commands" {
		t.Fatalf("cmd = %#v", cmd)
	}
}

func TestWriteRPCCommandWritesJSONLine(t *testing.T) {
	var buf bytes.Buffer
	if err := WriteCommand(&buf, map[string]any{"type": "get_state"}); err != nil {
		t.Fatalf("WriteCommand error: %v", err)
	}
	if got := buf.String(); got != "{\"type\":\"get_state\"}\n" {
		t.Fatalf("output = %q", got)
	}
	var decoded map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &decoded); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
}

func TestReadJSONLLinesPropagatesNonEOF(t *testing.T) {
	_, err := readJSONLLines(errReader{})
	if err == nil {
		t.Fatalf("expected error")
	}
}

type errReader struct{}

func (errReader) Read([]byte) (int, error) { return 0, errors.New("boom") }
