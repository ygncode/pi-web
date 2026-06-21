package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"pi-web/internal/sessions"

	_ "modernc.org/sqlite"
)

func newReviewsDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if _, err := db.Exec(reviewCommentsSchema); err != nil {
		t.Fatalf("create table: %v", err)
	}
	if _, err := db.Exec(reviewCommentsIndex); err != nil {
		t.Fatalf("create index: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func postReviewComment(t *testing.T, s *Server, session, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/diff/reviews?session="+session, bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	s.handleReviewComments(w, req)
	return w
}

func TestReviewCommentsCreateListDelete(t *testing.T) {
	s := &Server{db: newReviewsDB(t)}

	w := postReviewComment(t, s, "s1.jsonl", `{"file":"main.go","startLine":10,"endLine":12,"side":"new","body":"rename this"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("create status = %d: %s", w.Code, w.Body.String())
	}
	var created struct {
		Comment reviewComment `json:"comment"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Comment.ID == "" {
		t.Fatal("expected a generated id")
	}
	if created.Comment.CreatedAt == 0 {
		t.Fatal("expected createdAt to be set")
	}

	// List returns it, scoped to the session.
	listReq := httptest.NewRequest(http.MethodGet, "/api/diff/reviews?session=s1.jsonl", nil)
	lw := httptest.NewRecorder()
	s.handleReviewComments(lw, listReq)
	var listed struct {
		Comments []reviewComment `json:"comments"`
	}
	if err := json.Unmarshal(lw.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Comments) != 1 || listed.Comments[0].Body != "rename this" {
		t.Fatalf("unexpected list: %+v", listed.Comments)
	}

	// Another session sees none.
	otherReq := httptest.NewRequest(http.MethodGet, "/api/diff/reviews?session=other.jsonl", nil)
	ow := httptest.NewRecorder()
	s.handleReviewComments(ow, otherReq)
	var other struct {
		Comments []reviewComment `json:"comments"`
	}
	_ = json.Unmarshal(ow.Body.Bytes(), &other)
	if len(other.Comments) != 0 {
		t.Fatalf("expected session scoping, got %d", len(other.Comments))
	}

	// Delete removes it.
	delReq := httptest.NewRequest(http.MethodDelete, "/api/diff/reviews?session=s1.jsonl&id="+created.Comment.ID, nil)
	dw := httptest.NewRecorder()
	s.handleReviewComments(dw, delReq)
	if dw.Code != http.StatusOK {
		t.Fatalf("delete status = %d: %s", dw.Code, dw.Body.String())
	}
	after, err := s.listReviewComments("s1.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if len(after) != 0 {
		t.Fatalf("expected empty after delete, got %d", len(after))
	}
}

func TestReapOrphanedReviewComments(t *testing.T) {
	s := &Server{db: newReviewsDB(t)}

	// One comment on a session that still exists, one on a deleted session.
	if w := postReviewComment(t, s, "alive.jsonl", `{"file":"a.go","startLine":1,"endLine":2,"body":"keep"}`); w.Code != http.StatusOK {
		t.Fatalf("seed alive: %d %s", w.Code, w.Body.String())
	}
	if w := postReviewComment(t, s, "gone.jsonl", `{"file":"b.go","startLine":3,"endLine":4,"body":"reap"}`); w.Code != http.StatusOK {
		t.Fatalf("seed gone: %d %s", w.Code, w.Body.String())
	}

	// Only the alive session appears in the current list.
	s.reapOrphanedReviewComments([]sessions.SessionSummary{{ID: "alive.jsonl"}})

	alive, err := s.listReviewComments("alive.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if len(alive) != 1 {
		t.Fatalf("expected alive session's comment kept, got %d", len(alive))
	}
	gone, err := s.listReviewComments("gone.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if len(gone) != 0 {
		t.Fatalf("expected orphaned comments reaped, got %d", len(gone))
	}
}

func TestReviewCommentsValidation(t *testing.T) {
	s := &Server{db: newReviewsDB(t)}

	if w := postReviewComment(t, s, "s1.jsonl", `{"startLine":1,"endLine":2}`); w.Code != http.StatusBadRequest {
		t.Fatalf("missing file: got %d", w.Code)
	}
	if w := postReviewComment(t, s, "s1.jsonl", `{"file":"a.go","startLine":5,"endLine":2}`); w.Code != http.StatusBadRequest {
		t.Fatalf("inverted range: got %d", w.Code)
	}
}
