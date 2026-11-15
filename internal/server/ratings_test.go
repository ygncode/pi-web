package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMessageRatingRoundTrip(t *testing.T) {
	s := newTestServer(t)
	post := func(body string) int {
		req := httptest.NewRequest(http.MethodPost, "/api/message-rating?id=s1.jsonl", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		s.handleMessageRating(w, req)
		return w.Code
	}
	get := func() string {
		w := httptest.NewRecorder()
		s.handleMessageRating(w, httptest.NewRequest(http.MethodGet, "/api/message-rating?id=s1.jsonl", nil))
		return w.Body.String()
	}
	if c := post(`{"entryId":"e1","rating":1}`); c != 200 {
		t.Fatalf("post %d", c)
	}
	if c := post(`{"entryId":"e2","rating":-1}`); c != 200 {
		t.Fatalf("post %d", c)
	}
	if got := get(); !strings.Contains(got, `"e1":1`) || !strings.Contains(got, `"e2":-1`) {
		t.Fatalf("ratings = %s", got)
	}
	post(`{"entryId":"e1","rating":0}`)
	if got := get(); strings.Contains(got, `"e1"`) {
		t.Fatalf("rating not cleared: %s", got)
	}
	if c := post(`{"entryId":"e1","rating":5}`); c != 400 {
		t.Fatalf("invalid rating accepted: %d", c)
	}
}
