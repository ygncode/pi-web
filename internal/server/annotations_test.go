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

func newAnnotationsDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if _, err := db.Exec(annotationsSchema); err != nil {
		t.Fatalf("create table: %v", err)
	}
	if _, err := db.Exec(annotationsIndex); err != nil {
		t.Fatalf("create index: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func postAnnotation(t *testing.T, s *Server, session, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/annotations?session="+session, bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	s.handleAnnotations(w, req)
	return w
}

func TestAnnotationsCreateAndList(t *testing.T) {
	s := &Server{db: newAnnotationsDB(t)}

	w := postAnnotation(t, s, "s1.jsonl", `{"anchorId":"entry-e2","startOffset":3,"endOffset":10,"text":"fix this","original":"the world"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("create status = %d: %s", w.Code, w.Body.String())
	}
	var created struct {
		Annotation annotation `json:"annotation"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Annotation.ID == "" {
		t.Fatal("expected a generated id")
	}
	if created.Annotation.Kind != "comment" || created.Annotation.Source != "local" {
		t.Fatalf("expected defaults applied, got kind=%q source=%q", created.Annotation.Kind, created.Annotation.Source)
	}
	if created.Annotation.CreatedAt == 0 {
		t.Fatal("expected createdAt to be set")
	}

	// List returns it, scoped to the session.
	req := httptest.NewRequest(http.MethodGet, "/api/annotations?session=s1.jsonl", nil)
	lw := httptest.NewRecorder()
	s.handleAnnotations(lw, req)
	if lw.Code != http.StatusOK {
		t.Fatalf("list status = %d", lw.Code)
	}
	var listed struct {
		Annotations []annotation `json:"annotations"`
	}
	if err := json.Unmarshal(lw.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Annotations) != 1 {
		t.Fatalf("expected 1 annotation, got %d", len(listed.Annotations))
	}
	if listed.Annotations[0].Text != "fix this" || listed.Annotations[0].AnchorID != "entry-e2" {
		t.Fatalf("unexpected annotation: %+v", listed.Annotations[0])
	}

	// A different session sees none.
	req2 := httptest.NewRequest(http.MethodGet, "/api/annotations?session=other.jsonl", nil)
	lw2 := httptest.NewRecorder()
	s.handleAnnotations(lw2, req2)
	var listed2 struct {
		Annotations []annotation `json:"annotations"`
	}
	_ = json.Unmarshal(lw2.Body.Bytes(), &listed2)
	if len(listed2.Annotations) != 0 {
		t.Fatalf("expected session scoping, got %d", len(listed2.Annotations))
	}
}

func TestAnnotationsUpsertAndDelete(t *testing.T) {
	s := &Server{db: newAnnotationsDB(t)}

	// Create with an explicit id, then upsert (same id) updates text in place.
	postAnnotation(t, s, "s1.jsonl", `{"id":"a1","anchorId":"entry-e2","startOffset":0,"endOffset":4,"text":"first"}`)
	postAnnotation(t, s, "s1.jsonl", `{"id":"a1","anchorId":"entry-e2","startOffset":0,"endOffset":4,"text":"second"}`)

	anns, err := s.listAnnotations("s1.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	if len(anns) != 1 || anns[0].Text != "second" {
		t.Fatalf("expected single upserted annotation 'second', got %+v", anns)
	}

	// Delete removes it.
	req := httptest.NewRequest(http.MethodDelete, "/api/annotations?session=s1.jsonl&id=a1", nil)
	w := httptest.NewRecorder()
	s.handleAnnotations(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("delete status = %d", w.Code)
	}
	anns, _ = s.listAnnotations("s1.jsonl")
	if len(anns) != 0 {
		t.Fatalf("expected 0 after delete, got %d", len(anns))
	}
}

func TestAnnotationsValidation(t *testing.T) {
	s := &Server{db: newAnnotationsDB(t)}

	cases := []struct {
		name, session, body string
		method              string
		query               string
		want                int
	}{
		{name: "missing session", session: "", body: `{"anchorId":"entry-e2","startOffset":0,"endOffset":1}`, want: http.StatusBadRequest},
		{name: "missing anchor", session: "s1.jsonl", body: `{"startOffset":0,"endOffset":1}`, want: http.StatusBadRequest},
		{name: "bad offsets", session: "s1.jsonl", body: `{"anchorId":"entry-e2","startOffset":5,"endOffset":2}`, want: http.StatusBadRequest},
		{name: "invalid json", session: "s1.jsonl", body: `{not json`, want: http.StatusBadRequest},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := postAnnotation(t, s, c.session, c.body)
			if w.Code != c.want {
				t.Fatalf("got %d, want %d (%s)", w.Code, c.want, w.Body.String())
			}
		})
	}

	// Unsupported method.
	req := httptest.NewRequest(http.MethodPut, "/api/annotations?session=s1.jsonl", nil)
	w := httptest.NewRecorder()
	s.handleAnnotations(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for PUT, got %d", w.Code)
	}

	// Nil db.
	sNoDB := &Server{}
	wNoDB := postAnnotation(t, sNoDB, "s1.jsonl", `{"anchorId":"entry-e2","startOffset":0,"endOffset":1}`)
	if wNoDB.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for nil db, got %d", wNoDB.Code)
	}
}
