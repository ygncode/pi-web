package server

// Voice input: the composer mic records audio in the browser and posts it here;
// pi-web forwards it to a local OpenAI-compatible Whisper server
// (PI_WEB_WHISPER_URL, e.g. http://127.0.0.1:8786) so audio never leaves the
// host. GET reports availability so the UI can fall back to Web Speech.

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"strings"
	"time"
)

const maxAudioBytes = 25 << 20

func (s *Server) whisperURL() string {
	if s.whisperBase != "" {
		return strings.TrimRight(s.whisperBase, "/")
	}
	return strings.TrimRight(os.Getenv("PI_WEB_WHISPER_URL"), "/")
}

func (s *Server) handleTranscribe(w http.ResponseWriter, r *http.Request) {
	base := s.whisperURL()
	client := &http.Client{Timeout: 120 * time.Second}
	switch r.Method {
	case http.MethodGet:
		ok := false
		if base != "" {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/health", nil)
			if resp, err := client.Do(req); err == nil {
				ok = resp.StatusCode == http.StatusOK
				resp.Body.Close()
			}
		}
		writeJSON(w, 0, map[string]any{"available": ok})
	case http.MethodPost:
		if base == "" {
			writeJSONError(w, http.StatusServiceUnavailable, "transcription server not configured")
			return
		}
		audio, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxAudioBytes))
		if err != nil || len(audio) == 0 {
			writeJSONError(w, http.StatusBadRequest, "audio body required (max 25MB)")
			return
		}
		lang := r.URL.Query().Get("language")
		if lang == "" {
			lang = "auto"
		}
		ctype := r.Header.Get("Content-Type")
		if ctype == "" {
			ctype = "application/octet-stream"
		}
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", `form-data; name="file"; filename="audio"`)
		h.Set("Content-Type", ctype)
		part, _ := mw.CreatePart(h)
		_, _ = part.Write(audio)
		_ = mw.WriteField("language", lang)
		_ = mw.WriteField("model", "whisper-1")
		_ = mw.Close()
		req, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, base+"/v1/audio/transcriptions", &buf)
		req.Header.Set("Content-Type", mw.FormDataContentType())
		resp, err := client.Do(req)
		if err != nil {
			writeJSONError(w, http.StatusBadGateway, "transcription server unavailable")
			return
		}
		defer resp.Body.Close()
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, io.LimitReader(resp.Body, 1<<20))
	default:
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}
