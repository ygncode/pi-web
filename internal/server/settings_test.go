package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	_ "modernc.org/sqlite"
)

func newSettingsTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		key        TEXT PRIMARY KEY,
		value      TEXT,
		updated_at DATETIME
	)`)
	if err != nil {
		t.Fatalf("failed to create test table: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func decodeSettings(t *testing.T, body []byte) map[string]string {
	t.Helper()
	var resp struct {
		Settings map[string]string `json:"settings"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("failed to decode settings: %v (%s)", err, body)
	}
	return resp.Settings
}

func TestHandleGetSettingsDefaults(t *testing.T) {
	s := &Server{db: newSettingsTestDB(t)}

	req := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	w := httptest.NewRecorder()
	s.handleGetSettings(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	got := decodeSettings(t, w.Body.Bytes())
	if got["pi-web-theme"] != "dark" {
		t.Errorf("expected default theme 'dark', got %q", got["pi-web-theme"])
	}
	if len(got) != len(settingDefaults) {
		t.Errorf("expected %d settings, got %d", len(settingDefaults), len(got))
	}
}

func TestHandleSaveSettingsRoundTrip(t *testing.T) {
	s := &Server{db: newSettingsTestDB(t)}

	body := bytes.NewBufferString(`{"settings":{"pi-web-theme":"nord","pi-sessions:spinner-style":"braille"}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/settings", body)
	w := httptest.NewRecorder()
	s.handleSaveSettings(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if got := s.getSetting("pi-web-theme", "dark"); got != "nord" {
		t.Errorf("expected stored theme 'nord', got %q", got)
	}
	if got := s.ThemeSetting(); got != "nord" {
		t.Errorf("ThemeSetting expected 'nord', got %q", got)
	}

	// Other keys keep their defaults.
	all := s.getSettings()
	if all["pi-share:v1:done-sound"] != "cat.mp3" {
		t.Errorf("expected default done-sound, got %q", all["pi-share:v1:done-sound"])
	}
	if all["pi-sessions:spinner-style"] != "braille" {
		t.Errorf("expected stored spinner 'braille', got %q", all["pi-sessions:spinner-style"])
	}
}

func TestHandleSaveSettingsIgnoresUnknownKeys(t *testing.T) {
	s := &Server{db: newSettingsTestDB(t)}

	body := bytes.NewBufferString(`{"settings":{"pi-web:v1:right-sidebar-width":"320","pi-web-theme":"light"}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/settings", body)
	w := httptest.NewRecorder()
	s.handleSaveSettings(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var stored string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key = ?", "pi-web:v1:right-sidebar-width").Scan(&stored)
	if err != sql.ErrNoRows {
		t.Errorf("unknown key should not be persisted, got value %q (err %v)", stored, err)
	}
	if s.getSetting("pi-web-theme", "dark") != "light" {
		t.Errorf("known key in same request should still be saved")
	}
}

func TestHandleSaveSettingsEmptyBody(t *testing.T) {
	s := &Server{db: newSettingsTestDB(t)}
	req := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewBufferString(`{"settings":{}}`))
	w := httptest.NewRecorder()
	s.handleSaveSettings(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty settings, got %d", w.Code)
	}
}

func TestSettingsNoDBDegradesGracefully(t *testing.T) {
	s := &Server{} // db == nil

	// Reads return defaults.
	req := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	w := httptest.NewRecorder()
	s.handleGetSettings(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 without db, got %d", w.Code)
	}
	got := decodeSettings(t, w.Body.Bytes())
	if got["pi-web-theme"] != "dark" {
		t.Errorf("expected default theme without db, got %q", got["pi-web-theme"])
	}

	// Writes are a no-op but report success.
	body := bytes.NewBufferString(`{"settings":{"pi-web-theme":"nord"}}`)
	req2 := httptest.NewRequest(http.MethodPost, "/api/settings", body)
	w2 := httptest.NewRecorder()
	s.handleSaveSettings(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 no-op write without db, got %d", w2.Code)
	}
	if s.ThemeSetting() != "dark" {
		t.Errorf("expected theme to remain default without db")
	}
}

func TestGetPostHandlerRejectsOtherMethods(t *testing.T) {
	s := &Server{}
	called := false
	h := s.getPostHandler(
		func(w http.ResponseWriter, r *http.Request) { called = true },
		func(w http.ResponseWriter, r *http.Request) { called = true },
	)

	for _, method := range []string{http.MethodDelete, http.MethodPut, http.MethodPatch} {
		req := httptest.NewRequest(method, "/api/settings", nil)
		w := httptest.NewRecorder()
		h(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s: expected 405, got %d", method, w.Code)
		}
		if got := w.Header().Get("Allow"); got != "GET, POST" {
			t.Errorf("%s: expected Allow 'GET, POST', got %q", method, got)
		}
	}
	if called {
		t.Error("get/post handlers should not run for unsupported methods")
	}
}

func TestHandleGetSettingsWrongMethod(t *testing.T) {
	s := &Server{db: newSettingsTestDB(t)}
	req := httptest.NewRequest(http.MethodDelete, "/api/settings", nil)
	w := httptest.NewRecorder()
	s.handleGetSettings(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}
