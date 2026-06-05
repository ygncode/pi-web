package ui

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"pi-web/internal/sessions"
)

func sessionWithNEntries(n int) sessions.Session {
	entries := make([]map[string]any, n)
	for i := 0; i < n; i++ {
		entries[i] = map[string]any{
			"type":      "message",
			"id":        fmt.Sprintf("id%06d", i),
			"timestamp": "2026-05-06T00:00:00.000Z",
			"message":   map[string]any{"role": "user", "content": "m"},
		}
	}
	return sessions.Session{
		SessionSummary: sessions.SessionSummary{ID: "test.jsonl", Filename: "test.jsonl", ChatAvailable: true},
		Header:         map[string]any{"cwd": "/tmp", "name": "Test"},
		Entries:        entries,
	}
}

func decodeEmbed(t *testing.T, dataBase64 string) map[string]any {
	t.Helper()
	raw, err := base64.StdEncoding.DecodeString(dataBase64)
	if err != nil {
		t.Fatalf("base64 decode: %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("json decode: %v", err)
	}
	return payload
}

func TestPrepareSessionPageData_SmallSessionNotTruncated(t *testing.T) {
	sess := sessionWithNEntries(LargeSessionThreshold - 1)
	dataBase64, _, _ := prepareSessionPageData(sess, "")

	payload := decodeEmbed(t, dataBase64)
	entries, _ := payload["entries"].([]any)
	if len(entries) != LargeSessionThreshold-1 {
		t.Errorf("expected all %d entries embedded, got %d", LargeSessionThreshold-1, len(entries))
	}
	if truncated, _ := payload["truncated"].(bool); truncated {
		t.Errorf("truncated should be false for small session")
	}
	if from, _ := payload["from"].(float64); from != 0 {
		t.Errorf("from = %v, want 0", from)
	}
	if total, _ := payload["total"].(float64); int(total) != LargeSessionThreshold-1 {
		t.Errorf("total = %v, want %d", total, LargeSessionThreshold-1)
	}
}

func TestPrepareSessionPageData_LargeSessionTailEmbedded(t *testing.T) {
	const n = LargeSessionThreshold + 500
	sess := sessionWithNEntries(n)
	dataBase64, _, _ := prepareSessionPageData(sess, "")

	payload := decodeEmbed(t, dataBase64)
	entries, _ := payload["entries"].([]any)
	if len(entries) != LargeSessionTailEntries {
		t.Errorf("expected %d entries (tail) embedded, got %d", LargeSessionTailEntries, len(entries))
	}
	if truncated, _ := payload["truncated"].(bool); !truncated {
		t.Errorf("truncated should be true for large session")
	}
	wantFrom := n - LargeSessionTailEntries
	if from, _ := payload["from"].(float64); int(from) != wantFrom {
		t.Errorf("from = %v, want %d", from, wantFrom)
	}
	if total, _ := payload["total"].(float64); int(total) != n {
		t.Errorf("total = %v, want %d", total, n)
	}
	// First embedded entry should be at index wantFrom in the original slice.
	if first, ok := entries[0].(map[string]any); ok {
		wantID := fmt.Sprintf("id%06d", wantFrom)
		if got, _ := first["id"].(string); got != wantID {
			t.Errorf("first embedded id = %q, want %q", got, wantID)
		}
	}
}

func TestPrepareSessionPageData_LeafIDStillTailWhenTruncated(t *testing.T) {
	const n = LargeSessionThreshold + 100
	sess := sessionWithNEntries(n)
	dataBase64, _, _ := prepareSessionPageData(sess, "")

	payload := decodeEmbed(t, dataBase64)
	leafID, _ := payload["leafId"].(string)
	// LeafID is computed from the FULL session entries (not just the embedded
	// tail), so it should still point at the last entry of the original slice.
	want := fmt.Sprintf("id%06d", n-1)
	if !strings.Contains(leafID, want) {
		t.Errorf("leafId = %q, want it to contain %q (last entry of full session)", leafID, want)
	}
}
