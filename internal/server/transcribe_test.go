package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTranscribeProxiesToWhisper(t *testing.T) {
	var gotAudio, gotLang, gotType string
	whisper := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(200)
			return
		}
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Fatalf("multipart: %v", err)
		}
		f, fh, _ := r.FormFile("file")
		b, _ := io.ReadAll(f)
		gotAudio, gotLang, gotType = string(b), r.FormValue("language"), fh.Header.Get("Content-Type")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"text":"olá mundo","language":"pt"}`))
	}))
	defer whisper.Close()
	s := newTestServer(t)
	s.whisperBase = whisper.URL

	w := httptest.NewRecorder()
	s.handleTranscribe(w, httptest.NewRequest(http.MethodGet, "/api/transcribe", nil))
	if !strings.Contains(w.Body.String(), `"available":true`) {
		t.Fatalf("availability = %s", w.Body.String())
	}

	req := httptest.NewRequest(http.MethodPost, "/api/transcribe?language=pt", strings.NewReader("AUDIO"))
	req.Header.Set("Content-Type", "audio/mp4")
	w = httptest.NewRecorder()
	s.handleTranscribe(w, req)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "olá mundo") {
		t.Fatalf("transcribe = %d %s", w.Code, w.Body.String())
	}
	if gotAudio != "AUDIO" || gotLang != "pt" || gotType != "audio/mp4" {
		t.Fatalf("forwarded %q %q %q", gotAudio, gotLang, gotType)
	}
}

func TestTranscribeUnavailableWithoutServer(t *testing.T) {
	s := newTestServer(t)
	s.whisperBase = ""
	t.Setenv("PI_WEB_WHISPER_URL", "")
	w := httptest.NewRecorder()
	s.handleTranscribe(w, httptest.NewRequest(http.MethodGet, "/api/transcribe", nil))
	if !strings.Contains(w.Body.String(), `"available":false`) {
		t.Fatalf("got %s", w.Body.String())
	}
	w = httptest.NewRecorder()
	s.handleTranscribe(w, httptest.NewRequest(http.MethodPost, "/api/transcribe", strings.NewReader("x")))
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("code %d", w.Code)
	}
}
