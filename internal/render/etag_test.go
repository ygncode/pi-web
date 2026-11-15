package render

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteJSONConditionalServesBodyAndETag(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/x", nil)
	if WriteJSONConditional(w, r, map[string]string{"a": "b"}) {
		t.Fatal("first call must not 304")
	}
	if w.Header().Get("ETag") == "" {
		t.Fatal("missing ETag")
	}
	if w.Header().Get("Cache-Control") != "private, must-revalidate" {
		t.Fatalf("Cache-Control = %q", w.Header().Get("Cache-Control"))
	}
	if w.Body.String() != `{"a":"b"}` {
		t.Fatalf("body = %q", w.Body.String())
	}
}

func TestWriteJSONConditionalReturns304(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/x", nil)
	WriteJSONConditional(w, r, map[string]string{"a": "b"})
	etag := w.Header().Get("ETag")

	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodGet, "/x", nil)
	r2.Header.Set("If-None-Match", etag)
	if !WriteJSONConditional(w2, r2, map[string]string{"a": "b"}) {
		t.Fatal("matching etag must 304")
	}
	if w2.Code != http.StatusNotModified || w2.Body.Len() != 0 {
		t.Fatalf("code=%d body=%q", w2.Code, w2.Body.String())
	}
}

func TestWriteJSONConditionalChangedPayload(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/x", nil)
	WriteJSONConditional(w, r, map[string]string{"a": "b"})
	etag := w.Header().Get("ETag")

	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodGet, "/x", nil)
	r2.Header.Set("If-None-Match", etag)
	if WriteJSONConditional(w2, r2, map[string]string{"a": "c"}) {
		t.Fatal("changed payload must 200")
	}
	if w2.Code != http.StatusOK || w2.Body.String() != `{"a":"c"}` {
		t.Fatalf("code=%d body=%q", w2.Code, w2.Body.String())
	}
}

func TestMatchesETagWeakAndList(t *testing.T) {
	etag := ETagOf([]byte("x"))
	if !MatchesETag(`W/`+etag, etag) {
		t.Fatal("weak candidate must match")
	}
	if !MatchesETag(`"other", `+etag, etag) {
		t.Fatal("list containing etag must match")
	}
	if MatchesETag(`"other"`, etag) {
		t.Fatal("different etag must not match")
	}
	if MatchesETag("", etag) {
		t.Fatal("empty header must not match")
	}
	if !MatchesETag("*", etag) {
		t.Fatal("* must match")
	}
}
