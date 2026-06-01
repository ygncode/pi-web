package render

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	payload := map[string]any{"ok": true, "value": 42}

	WriteJSON(rec, http.StatusAccepted, payload)

	if rec.Code != http.StatusAccepted {
		t.Errorf("expected status %d, got %d", http.StatusAccepted, rec.Code)
	}

	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", contentType)
	}

	var parsed map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &parsed); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	if parsed["ok"] != true || parsed["value"] != float64(42) {
		t.Errorf("unexpected body content: %v", parsed)
	}
}

func TestWriteJSONError(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteJSONError(rec, http.StatusBadRequest, "something went wrong")

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}

	var parsed map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &parsed); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	if parsed["error"] != "something went wrong" {
		t.Errorf("expected error message %q, got %q", "something went wrong", parsed["error"])
	}
}
