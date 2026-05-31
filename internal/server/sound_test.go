package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestHandleApiSounds(t *testing.T) {
	tmp := t.TempDir()
	assetsDir := filepath.Join(tmp, "pi-web", "assets")
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create custom sounds
	_ = os.WriteFile(filepath.Join(assetsDir, "custom1.mp3"), []byte("mp3"), 0644)
	_ = os.WriteFile(filepath.Join(assetsDir, "another.mp3"), []byte("mp3"), 0644)
	_ = os.WriteFile(filepath.Join(assetsDir, "not-an-mp3.txt"), []byte("txt"), 0644)

	s := &Server{
		agentDir: tmp,
	}

	req := httptest.NewRequest(http.MethodGet, "/api/sounds", nil)
	w := httptest.NewRecorder()
	s.handleApiSounds(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}

	sounds, ok := resp["sounds"].([]any)
	if !ok {
		t.Fatal("expected sounds array")
	}

	if len(sounds) != 2 {
		t.Fatalf("expected 2 sounds, got %d", len(sounds))
	}

	// Should be sorted alphabetically
	if sounds[0].(string) != "another.mp3" || sounds[1].(string) != "custom1.mp3" {
		t.Fatalf("unexpected sounds list or sorting: %v", sounds)
	}

	defaultSound, _ := resp["default"].(string)
	if defaultSound != "cat.mp3" {
		t.Fatalf("expected default cat.mp3, got %q", defaultSound)
	}
}

func TestHandleSounds(t *testing.T) {
	tmp := t.TempDir()
	assetsDir := filepath.Join(tmp, "pi-web", "assets")
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create custom sound
	customData := []byte("custom mp3 data")
	_ = os.WriteFile(filepath.Join(assetsDir, "my-sound.mp3"), customData, 0644)

	s := &Server{
		agentDir: tmp,
	}

	// 1. Test serving custom sound
	req := httptest.NewRequest(http.MethodGet, "/sounds/my-sound.mp3", nil)
	w := httptest.NewRecorder()
	s.handleSounds(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	if string(w.Body.Bytes()) != string(customData) {
		t.Fatalf("expected custom data, got %q", w.Body.Bytes())
	}
	if w.Header().Get("Content-Type") != "audio/mpeg" {
		t.Fatalf("expected audio/mpeg Content-Type, got %q", w.Header().Get("Content-Type"))
	}

	// 2. Test serving missing non-default sound returns 404
	req2 := httptest.NewRequest(http.MethodGet, "/sounds/nonexistent.mp3", nil)
	w2 := httptest.NewRecorder()
	s.handleSounds(w2, req2)

	if w2.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for missing non-default sound, got %d", w2.Code)
	}

	// 2b. Test cat.mp3 falls back to embedded when missing on disk
	req2b := httptest.NewRequest(http.MethodGet, "/sounds/cat.mp3", nil)
	w2b := httptest.NewRecorder()
	s.handleSounds(w2b, req2b)

	if w2b.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for embedded cat.mp3 fallback, got %d", w2b.Code)
	}
	if w2b.Header().Get("Content-Type") != "audio/mpeg" {
		t.Fatalf("expected audio/mpeg Content-Type for cat.mp3 fallback, got %q", w2b.Header().Get("Content-Type"))
	}

	// 3. Test invalid extension
	req3 := httptest.NewRequest(http.MethodGet, "/sounds/invalid.txt", nil)
	w3 := httptest.NewRecorder()
	s.handleSounds(w3, req3)

	if w3.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for non-mp3, got %d", w3.Code)
	}
}
